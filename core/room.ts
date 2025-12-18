import EventEmitter from 'events';

import {
  EmbedBuilder,
  AttachmentBuilder,
  Client,
  Message,
  type Interaction,
  User,
  type MessageCreateOptions,
} from 'discord.js';
import { MessageFlags } from 'discord.js';

import rolesData from '../data/data.json' with { type: 'json' };
import ServerSettings from '../models/ServerSettings.js';
import Player from '../types/player.js';
import Dead from '../types/roles/Dead.js';
import Maid from '../types/roles/Maid.js';
import { RoleResponseDMs } from '../utils/response.js';
import {
  roleTable,
  assignRolesGame,
  convertFactionRoles,
  WEREROLE,
} from '../utils/role.js';

import { createAvatarCollage } from './canvas.js';
import GameState from './gamestate.js';
import { checkEndGame as runCheckEndGame } from './phases/checkEndGame.js';
import { dayPhase as runDayPhase } from './phases/dayPhase.js';
import { nightPhase as runNightPhase } from './phases/nightPhase.js';
import { solvePhase as runSolvePhase } from './phases/solvePhase.js';
import { votePhase as runVotePhase } from './phases/votePhase.js';
import { store } from './store.js';

type GamePhase = 'waiting' | 'starting' | 'ended';

class GameRoom extends EventEmitter {
  client: Client;
  guildId: string;
  hostId: string;
  channelId: string;
  players: Player[];
  status: GamePhase;
  gameState: GameState;
  witchMessages: Map<string, Message>;
  nightMessages: Map<string, Message>;
  voteMessages: Map<string, Message>;
  private timeoutIds: NodeJS.Timeout[] = [];
  private userCache: Map<string, { user: User, timestamp: number  }> = new Map();
  private isCleaningUp = false;
  private activePromises: Set<Promise<unknown>> = new Set();
  private periodicCleanupInterval?: NodeJS.Timeout;
  settings: {
    wolfVoteTime: number;
    nightTime: number;
    discussTime: number;
    voteTime: number;
  };

  constructor(client: Client, guildId: string, hostId: string, channelId: string) {
    super();

    this.client = client;
    this.guildId = guildId;
    this.hostId = hostId;
    this.channelId = channelId;
    this.players = [];
    this.status = 'waiting'; // waiting, starting, ended
    this.gameState = new GameState();
    this.witchMessages = new Map(); // message phù thuỷ
    this.nightMessages = new Map(); // message ban đêm
    this.voteMessages = new Map(); // message vote treo cổ
    this.timeoutIds = [];
    this.settings = {
      wolfVoteTime: 40,
      nightTime: 70,
      discussTime: 90,
      voteTime: 30,
    };

    this.periodicCleanupInterval = setInterval(() => {
      this.performPeriodicCleanup();
    }, 60000); // 1p
  }

  async testSafePromiseAllSettled<T>(promises: Promise<T>[]) {
    return this.safePromiseAllSettled(promises);
  }

  public trackPromise<T>(promise: Promise<T>): Promise<T> {
    this.activePromises.add(promise);
    const cleanup = () => {
      this.activePromises.delete(promise);
    };
    promise.then(cleanup).catch(cleanup);
    return promise;
  }

  public async safePromiseAllSettled<T>(promises: Promise<T>[]) {
    const trackedPromise = Promise.allSettled(promises);
    this.trackPromise(trackedPromise);
    return trackedPromise;
  }

  // eslint-disable-next-line no-unused-vars
  public addTimeout(callback: (...args: unknown[]) => void | Promise<void>, delay: number): NodeJS.Timeout {
    if (this.isCleaningUp) {
      return setTimeout(() => {}, 0); // Trả về dummy timeout if cleaning up
    }
    if (this.timeoutIds.length > 20) {
      console.warn(`GameRoom ${this.guildId}: Too many timeouts (${this.timeoutIds.length}), clearing oldest ones`);
      const oldTimeouts = this.timeoutIds.splice(0, 10);
      oldTimeouts.forEach(id => clearTimeout(id));
    }
    const timeoutId = setTimeout(async () => {
      try {
        await callback();
      } catch (error) {
        console.error('Error in timeout callback:', error);
      } finally {
        this.timeoutIds = this.timeoutIds.filter(id => id !== timeoutId);
      }
    }, delay);

    this.timeoutIds.push(timeoutId);
    return timeoutId;
  }

  async fetchUser(userId: string): Promise<User | null> {
    // Check cache first
    if (this.userCache.has(userId)) {
      const cached = this.userCache.get(userId);
      if (cached && (Date.now() - cached.timestamp < 300000)) { // 5 minutes cache
        return cached.user;
      }
    }

    try {
      const user = await this.client.users.fetch(userId);
      // Cache with timestamp
      this.userCache.set(userId, {
        user,
        timestamp: Date.now(),
      });

      // ✅ FIX: Always cleanup expired entries, not just when size > 100
      this.cleanupExpiredCache();

      return user;
    } catch (err) {
      console.error(`Không thể fetch user ${userId}`, err);
      return null;
    }
  }

  private cleanupExpiredCache() {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [id, cached] of this.userCache) {
      if (now - cached.timestamp > 300000) { // 5 minutes
        expiredKeys.push(id);
      }
    }

    expiredKeys.forEach(key => this.userCache.delete(key));

    if (this.userCache.size > 100) {
      console.warn(`GameRoom ${this.guildId}: Large user cache size: ${this.userCache.size}`);
    }
  }

  async batchSendMessages(
    messages: Array<{userId: string, content: string | MessageCreateOptions}>,
  ) {
    let BATCH_SIZE: number;
    let DELAY_MS: number;
    if (messages.length <= 6) {
      // Nhóm nhỏ: Gửi tất cả cùng lúc
      BATCH_SIZE = messages.length;
      DELAY_MS = 0;
    } else if (messages.length <= 12) {
      // Nhóm trung bình: Batch size 6, delay ngắn
      BATCH_SIZE = 6;
      DELAY_MS = 200;
    } else {
      // Nhóm lớn (13-18): Batch size 5, delay tối ưu
      BATCH_SIZE = 5;
      DELAY_MS = 300;
    }

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async ({userId, content}) => {
        try {
          const user = await this.fetchUser(userId);
          if (user) {
            return await user.send(content);
          }
          return null;
        } catch (error) {
          console.error(`Error sending message to ${userId}:`, error);
          return null;
        }
      });

      await this.safePromiseAllSettled(batchPromises);

      if (i + BATCH_SIZE < messages.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
  };

  private clearAllTimeouts() {
    this.timeoutIds.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    this.timeoutIds = [];
  }

  private async sendGameLogToChannel() {
    if (!this.gameState.log || this.gameState.log.length === 0) {
      return;
    }

    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel?.isSendable()) {
        console.warn(`Channel ${this.channelId} not found or not sendable`);
        return;
      }

      const logEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('📜 LOG GAME MA SÓI')
        .setDescription(
          this.gameState.log.join('\n').slice(0, 4000) || // Discord embed description limit
            '*Không có log nào được ghi lại*',
        )
        .setTimestamp()
        .setFooter({
          text: `Game đã kết thúc • ${this.players.length} người chơi`,
        });

      // Nếu log quá dài, chia thành nhiều embed
      if (this.gameState.log.join('\n').length > 4000) {
        const logText = this.gameState.log.join('\n');
        const chunks = [];
        for (let i = 0; i < logText.length; i += 4000) {
          chunks.push(logText.slice(i, i + 4000));
        }

        for (let i = 0; i < chunks.length; i++) {
          const chunkEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle(i === 0 ? '📜 LOG GAME MA SÓI' : `📜 LOG GAME MA SÓI (Phần ${i + 1})`)
            .setDescription(chunks[i])
            .setTimestamp()
            .setFooter({
              text: `Game đã kết thúc • ${this.players.length} người chơi • Phần ${i + 1}/${chunks.length}`,
            });

          await channel.send({ embeds: [chunkEmbed] });
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } else {
        await channel.send({ embeds: [logEmbed] });
      }

      console.log(`Game log sent to channel ${this.channelId} for guild ${this.guildId}`);
    } catch (error) {
      console.error(`Failed to send game log to channel ${this.channelId}:`, error);
    }
  }

  async cleanup() {
    this.isCleaningUp = true;

    if (this.status === 'ended' && this.gameState.log.length > 0) {
      try {
        await Promise.race([
          this.sendGameLogToChannel(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Game log timeout')), 5000)),
        ]);
      } catch (error) {
        console.error(`Failed to send game log for room ${this.guildId}:`, error);
      }
    }

    if (this.periodicCleanupInterval) {
      clearInterval(this.periodicCleanupInterval);
      this.periodicCleanupInterval = undefined;
    }

    this.clearAllTimeouts();

    if (this.activePromises.size > 0) {
      console.log(`GameRoom ${this.guildId}: Waiting for ${this.activePromises.size} active promises`);
      try {
        await Promise.race([
          Promise.allSettled(Array.from(this.activePromises)),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Active promises timeout')), 3000)),
        ]);
      } catch (error) {
        console.warn(`GameRoom ${this.guildId}: Active promises cleanup timeout:`, error);
      }
    }
    this.activePromises.clear();

    this.userCache.clear();

    this.witchMessages.clear();
    this.nightMessages.clear();
    this.voteMessages.clear();

    this.gameState.reset();

    this.removeAllListeners();

    for (const player of this.players) {
      store.delete(player.userId);
    }

    this.players = [];
    // this.players = [];
    if (global.gc && (process.memoryUsage().heapUsed > 100 * 1024 * 1024)) { // 100MB threshold
      global.gc();
    }
  }

  private performPeriodicCleanup() {
    if (this.isCleaningUp) {
      return;
    }

    if (this.activePromises.size > 10 || this.timeoutIds.length > 5 || this.userCache.size > 50) {
      this.logMemoryStats();
    }

    this.cleanupExpiredCache();

    if (this.activePromises.size > 20) {
      console.warn(`GameRoom ${this.guildId}: High active promises: ${this.activePromises.size}`);
    }

    if (this.timeoutIds.length > 10) {
      console.warn(`GameRoom ${this.guildId}: High active timeouts: ${this.timeoutIds.length}`);
    }

    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > 150 * 1024 * 1024) { // 150MB threshold
      console.warn(`GameRoom ${this.guildId}: High memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      if (this.userCache.size > 20) {
        const entries = Array.from(this.userCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = entries.slice(0, Math.floor(this.userCache.size / 2));
        toRemove.forEach(([key]) => this.userCache.delete(key));
      }
      if (global.gc) {
        console.log(`GameRoom ${this.guildId}: Forcing garbage collection due to memory pressure`);
        global.gc();
      }
    }
  }

  private logMemoryStats() {
    /**
    console.log(`GameRoom ${this.guildId} Memory Stats:`, {
      activePromises: this.activePromises.size,
      activeTimeouts: this.timeoutIds.length,
      userCacheSize: this.userCache.size,
      gameStatus: this.status,
      isCleaningUp: this.isCleaningUp,
    });
     */
  }

  async addPlayer(userId: string) {
    const user = await this.fetchUser(userId);
    if (!user) {
      return;
    }

    const name = user.globalName || user.username;

    if (!this.players.some((p) => p.userId === userId)) {
      this.players.push(new Player(userId, name));
    }
  }

  removePlayer(userId: string) {
    this.players = this.players.filter((p) => p.userId !== userId);
  }

  hasPlayer(userId: string) {
    return this.players.some((p) => p.userId === userId);
  }

  isEmpty() {
    return this.players.length === 0;
  }

  assignRoles(
    playerCount: number,
    customRoles: Record<string | number, number> | null = null,
  ) {
    const roles = [];

    if (playerCount < 4) {
      throw new Error('Cần ít nhất 4 người chơi.');
    }

    if (customRoles) {
      for (const [roleId, count] of Object.entries(customRoles)) {
        for (let i = 0; i < Number(count); i++) {
          roles.push(Number(roleId));
        }
      }
    } else {
      const table =
        roleTable[playerCount.toString() as unknown as keyof typeof roleTable];

      if (table) {
        for (const [role, count] of Object.entries(table)) {
          for (let i = 0; i < count; i++) {
            roles.push(Number(role));
          }
        }
      } else {
        const werewolves = Math.floor(playerCount / 4);
        for (let i = 0; i < werewolves; i++) {
          roles.push(0);
        }
        roles.push(2);
        roles.push(6);
        roles.push(8);
        if (playerCount >= 7) {
          roles.push(4);
        }
        if (playerCount >= 7) {
          roles.push(5);
        }
        if (playerCount >= 8) {
          roles.push(3);
        }
        if (playerCount >= 10) {
          roles.push(7);
        }

        const remaining = playerCount - roles.length;
        for (let i = 0; i < remaining; i++) {
          roles.push(1);
        }
      }
    }

    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    return roles;
  }

  async startGame(
    interaction: Interaction,
    customRoles: Record<string | number, number> | null = null,
  ) {
    if (this.status !== 'waiting') {
      throw new Error('Game đã bắt đầu hoặc kết thúc.');
    }

    // lưu vào store
    for (const player of this.players) {
      store.set(player.userId, this.guildId);
    }

    if (this.guildId) {
      try {
        const dbSettings = await ServerSettings.findOne({
          guildId: this.guildId,
        });
        if (dbSettings) {
          this.settings = {
            wolfVoteTime: dbSettings.wolfVoteTime,
            nightTime: dbSettings.nightTime,
            discussTime: dbSettings.discussTime,
            voteTime: dbSettings.voteTime,
          };
        }
      } catch (error) {
        console.error('Lỗi khi lấy cài đặt từ database:', error);
      }
    }

    const roles = this.assignRoles(this.players.length, customRoles);

    const allWerewolves: string[] = [];

    const dmPromises = this.players.map(async (player, i) => {
      const role = assignRolesGame(roles[i]);
      player.role = role;
      if (player.role.faction === 0) {
        allWerewolves.push(player.userId);
      }

      try {
        const user = await interaction.client.users.fetch(player.userId);
        await user.send(
          `🎮 Bạn được phân vai: **${role.name}**. Hãy giữ bí mật!!!`,
        );
        const keyRole = role.id.toString() as keyof typeof rolesData;
        await RoleResponseDMs(
          user,
          `${rolesData[keyRole].eName.toLowerCase().replace(/\s+/g, '_')}.png`,
          role.id,
          convertFactionRoles(rolesData[keyRole].faction),
        );
      } catch (err) {
        console.error(`Không thể gửi tin nhắn cho ${player.userId}`, err);
        if (interaction.isRepliable()) {
          await interaction.reply({
            content: `Không thể gửi tin nhắn cho bạn (<@${player.userId}>), hãy kiểm tra cài đặt quyền`,
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    });
    await this.safePromiseAllSettled(dmPromises);

    const woPromises = this.players
      .filter((p) => p.role.faction === 0)
      .map(async (player) => {
        try {
          const user = await interaction.client.users.fetch(player.userId);
          await user.send(
            `Đồng đội của bạn: ${
              allWerewolves
                .filter((id) => id !== player.userId)
                .map((id) => {
                  const teammate = this.players.find((p) => p.userId === id);
                  return `**${teammate?.name}** (${teammate?.role.name})`;
                })
                .join(', ') || 'Không có đồng đội.'
            }`,
          );
        } catch (error) {
          console.error(`Không thể gửi tin nhắn cho ${player.userId}`, error);
          if (interaction.isRepliable()) {
            await interaction.reply({
              content:
                'Không thể gửi tin nhắn cho bạn, hãy kiểm tra cài đặt quyền',
              flags: MessageFlags.Ephemeral,
            });
          }
        }
      });
    await this.safePromiseAllSettled(woPromises);

    this.status = 'starting';

    console.log('-----');
    console.log(this.players);

    this.gameState.phase = 'night';
    this.gameLoop();
  }

  endGame() {
    this.status = 'ended';
    this.cleanup().catch(err => console.error('Cleanup error:', err));
  }

  async nightPhase() {
    return runNightPhase(this);
  }

  /**
   * @description Đoạn này xin được phép comment nhiều vì sợ đọc lại không hiểu <(")
   */
  async solvePhaseV2() {
    return runSolvePhase(this);
  }

  async dayPhase() {
    return runDayPhase(this);
  }

  async votePhase() {
    return runVotePhase(this);
  }

  async checkEndGame() {
    return runCheckEndGame(this);
  }

  async gameLoop() {
    try {
      while (this.status === 'starting') {
        await this.nightPhase();
        await this.solvePhaseV2();
        if (await this.checkEndGame()) {
          console.log('END GAME');
          break;
        }
        await this.dayPhase();
        await this.votePhase();
      }
    } catch (error) {
      console.error(`GameRoom ${this.guildId} error in gameLoop:`, error);
      await this.cleanup();
      gameRooms.delete(this.guildId);
      console.log(`✅ Room ${this.guildId} removed in gameLoop error handler`);
    } finally {
      if (!this.isCleaningUp) {
        await this.cleanup();
      }
      if (gameRooms.has(this.guildId)) {
        gameRooms.delete(this.guildId);
        console.log(`✅ Room ${this.guildId} removed in gameLoop finally. Remaining rooms: ${gameRooms.size}`);
      }
    }
  }

  /**
   *
   * @param {Player} deadPlayer
   */
  async checkIfMasterIsDead(deadPlayer: Player) {
    const maid = this.players.find(
      (p) =>
        p.role.id === WEREROLE.MAID &&
        p.role instanceof Maid &&
        p.role.master === deadPlayer.userId,
    );
    let maidNewRole = null;
    if (maid) {
      maid.role = assignRolesGame(
        deadPlayer.role instanceof Dead ? deadPlayer.role.originalRoleId ??
        deadPlayer.role.id :
          deadPlayer.role.id,
      );
      maidNewRole = maid.role.name;

      const maidUser = await this.fetchUser(maid.userId);
      // phần thông báo cho maid
      if (maidUser) {
        await maidUser.send(
          `### 👑 Chủ của bạn đã bị chết, bạn đã trở thành **${maid.role.name}**`,
        );
      }

      // phần log
      this.gameState.addLog(
        `👒 **Hầu Gái** đã lên thay vai trò **${maid.role.name}** của chủ vì chủ đã bị chết.`,
      );
    }
    return maidNewRole;
  }

  async updateAllPlayerList() {
    const dmPromises = this.players.map(async (player) => {
      const user = await this.fetchUser(player.userId);
      if (!user) {
        return;
      }

      const buffer = await createAvatarCollage(this.players, this.client);
      const attachment = new AttachmentBuilder(buffer, { name: 'avatars.png' });

      const embed = new EmbedBuilder()
        .setTitle('📋 Danh sách người chơi đã cập nhật')
        .setColor(0x00ae86)
        .setImage('attachment://avatars.png')
        .setTimestamp();

      await user.send({
        embeds: [embed],
        files: [attachment],
      });
    });

    await this.safePromiseAllSettled(dmPromises);
  }
}

/**
 * @description [guildId]: phòng chơi
 */
export const gameRooms = new Map<string, GameRoom>();

export { GameRoom };
