import EventEmitter from 'events';

import {
  EmbedBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  Client,
  Message,
  type Interaction,
  type APIActionRowComponent,
  type APIButtonComponent,
  User,
  type MessageCreateOptions,
} from 'discord.js';
import { MessageFlags } from 'discord.js';

import rolesData from '../data/data.json' with { type: 'json' };
import ServerSettings from '../models/ServerSettings.js';
import { Faction } from '../types/faction.js';
import Player from '../types/player.js';
import AlphaWerewolf from '../types/roles/AlphaWerewolf.js';
import Bodyguard from '../types/roles/Bodyguard.js';
import Dead from '../types/roles/Dead.js';
import Detective from '../types/roles/Detective.js';
import Elder from '../types/roles/Elder.js';
import FoxSpirit from '../types/roles/FoxSpirit.js';
import Gunner from '../types/roles/Gunner.js';
import Maid from '../types/roles/Maid.js';
import Medium from '../types/roles/Medium.js';
import Puppeteer from '../types/roles/Puppeteer.js';
import Seer from '../types/roles/Seer.js';
import Stalker from '../types/roles/Stalker.js';
import Villager from '../types/roles/Villager.js';
import VoodooWerewolf from '../types/roles/VoodooWerewolf.js';
import Werewolf from '../types/roles/WereWolf.js';
import Witch from '../types/roles/Witch.js';
import WolfSeer from '../types/roles/WolfSeer.js';
import { RoleResponseDMs } from '../utils/response.js';
import {
  roleTable,
  assignRolesGame,
  convertFactionRoles,
  WEREROLE,
} from '../utils/role.js';

import { createAvatarCollage } from './canvas.js';
import GameState from './gamestate.js';
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
  kittenWolfDeathNight: number;
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
    this.kittenWolfDeathNight = 0;
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

  private trackPromise<T>(promise: Promise<T>): Promise<T> {
    this.activePromises.add(promise);
    const cleanup = () => {
      this.activePromises.delete(promise);
    };
    promise.then(cleanup).catch(cleanup);
    return promise;
  }

  private async safePromiseAllSettled<T>(promises: Promise<T>[]) {
    const trackedPromise = Promise.allSettled(promises);
    this.trackPromise(trackedPromise);
    return trackedPromise;
  }

  // eslint-disable-next-line no-unused-vars
  private addTimeout(callback: (...args: unknown[]) => void | Promise<void>, delay: number): NodeJS.Timeout {
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

  totalVotedWolvesSolve() {
    const totalVotes = this.players.reduce(
      (acc: Record<string, number>, player) => {
        if (player.role.faction === Faction.WEREWOLF && 'voteBite' in player.role && typeof player.role.voteBite === 'string') {
          acc[player.role.voteBite] = (acc[player.role.voteBite] || 0) + 1;
        }
        return acc;
      },
      {},
    );

    const voteEntries = Object.entries(totalVotes);

    console.log(totalVotes);

    if (voteEntries.length === 0) {
      return null;
    }

    let maxVotes = 0;
    let candidates: string[] = [];

    for (const [userId, count] of voteEntries) {
      if (count > maxVotes) {
        maxVotes = count;
        candidates = [userId];
      } else if (count === maxVotes) {
        candidates.push(userId);
      }
    }

    if (candidates.length === 1) {
      return candidates[0];
    }

    return null;
  }

  async nightPhase() {
    this.gameState.phase = 'night';
    this.gameState.nightCount += 1;

    this.emit('night', this.guildId, this.players, this.gameState);

    const wolfMessages: Message[] = [];

    const dmPromises = this.players.map(async (player) => {
      const user = await this.fetchUser(player.userId);
      if (!user) {
        return;
      }

      await user.send(
        `# 🌑 Đêm ${this.gameState.nightCount === 1 ? 'đầu tiên' : `thứ ${this.gameState.nightCount}`}.`,
      );

      const buffer = await createAvatarCollage(this.players, this.client);
      const attachment = new AttachmentBuilder(buffer, { name: 'avatars.png' });

      const embed = new EmbedBuilder()
        .setTitle('📋 Danh sách người chơi')
        .setColor(0x00ae86)
        .setImage('attachment://avatars.png')
        .setTimestamp();

      let message;

      if (player.role.id === WEREROLE.WEREWOLF) {
        // Sói
        const voteButton = new ButtonBuilder()
          .setCustomId(`vote_target_wolf_${player.userId}`)
          .setLabel('🗳️ Vote người cần giết')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          voteButton,
        );

        await user.send(
          `🌙 Bạn là **Sói**. Hãy vote người cần giết trong ${this.settings.wolfVoteTime} giây. Bạn có thể trò chuyện với các Sói khác ngay tại đây.`,
        );
        message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
        wolfMessages.push(message);
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.WOLFSEER) {
        // Sói Tiên Tri
        const viewButton = new ButtonBuilder()
          .setCustomId(`view_target_wolfseer_${player.userId}`)
          .setLabel('🔍 Xem vai trò')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          viewButton,
        );

        await user.send(
          '🌙 Bạn là **Sói Tiên Tri**. Bạn có thể xem vai trò của một người chơi có phải là tiên tri hay không.',
        );
        message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.ALPHAWEREWOLF) {
        // Sói Trùm
        const maskButton = new ButtonBuilder()
          .setCustomId(`mask_target_alphawerewolf_${player.userId}`)
          .setLabel('👤 Che sói')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          maskButton,
        );

        await user.send(
          '🌙 Bạn là **Sói Trùm**. Bạn có thể che sói khỏi tiên tri, mỗi đêm 1 sói, được phép che liên tục một sói.',
        );
        message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.BODYGUARD) {
        // Bảo Vệ
        const protectButton = new ButtonBuilder()
          .setCustomId(`protect_target_bodyguard_${player.userId}`)
          .setLabel('🛡️ Bảo vệ người')
          .setStyle(ButtonStyle.Secondary);

        if (!player.canUseSkill) {
          protectButton.setDisabled(true);
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          protectButton,
        );

        await user.send(
          '🌙 Bạn là **Bảo Vệ**. Hãy chọn người bạn muốn bảo vệ trong đêm nay. Bạn có thể tự bảo vệ mình.',
        );
        message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.SEER) {
        // Tiên Tri
        const viewButton = new ButtonBuilder()
          .setCustomId(`view_target_seer_${player.userId}`)
          .setLabel('🔍 Xem phe')
          .setStyle(ButtonStyle.Secondary);

        if (!player.canUseSkill) {
          viewButton.setDisabled(true);
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          viewButton,
        );

        await user.send(
          '🌙 Bạn là **Tiên Tri**. Bạn có thể xem phe của một người chơi khác trong đêm nay.',
        );
        message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.DETECTIVE) {
        // Thám Tử
        const investigateButton = new ButtonBuilder()
          .setCustomId(`investigate_target_detective_${player.userId}`)
          .setLabel('🔎 Điều tra người')
          .setStyle(ButtonStyle.Secondary);

        if (!player.canUseSkill) {
          investigateButton.setDisabled(true);
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          investigateButton,
        );

        await user.send(
          '🌙 Bạn là **Thám Tử**. Bạn có thể điều tra hai người chơi để biết họ ở cùng phe hay khác phe.',
        );
        message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
        this.nightMessages.set(player.userId, message);
      } else if (
        player.role.id === WEREROLE.WITCH &&
        player.role instanceof Witch
      ) {
        // Phù Thuỷ
        const poisonButton = new ButtonBuilder()
          .setCustomId(`poison_target_witch_${player.userId}`)
          .setLabel('💊 Đầu độc người')
          .setStyle(ButtonStyle.Secondary);

        if (player.role.poisonCount <= 0) {
          poisonButton.setDisabled(true);
        }

        const healButton = new ButtonBuilder()
          .setCustomId(`heal_target_witch_${player.userId}`)
          .setLabel('💫 Cứu người')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true);

        if (!player.canUseSkill) {
          poisonButton.setDisabled(true);
          healButton.setDisabled(true);
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          poisonButton,
          healButton,
        );

        await user.send(
          `🌙 Bạn là **Phù Thuỷ**. Bạn có hai bình thuốc: một để đầu độc và một để cứu người. Bình cứu chỉ có tác dụng nếu người đó bị tấn công.\n (Bình độc: ${player.role.poisonCount}, Bình cứu: ${Math.max(0, player.role.healCount)}).`,
        );
        message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });

        this.witchMessages.set(player.userId, message);
        this.nightMessages.set(player.userId, message);
      } else if (
        player.role.id === WEREROLE.MEDIUM &&
        player.role instanceof Medium
      ) {
        // Thầy Đồng
        const reviveButton = new ButtonBuilder()
          .setCustomId(`revive_target_medium_${player.userId}`)
          .setLabel('🔮 Hồi sinh người')
          .setStyle(ButtonStyle.Secondary);

        if (player.role.revivedCount <= 0) {
          reviveButton.setDisabled(true);
        }

        if (!player.canUseSkill) {
          reviveButton.setDisabled(true);
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          reviveButton,
        );

        const villagerDead = this.players
          .filter((player) => {
            return player.role.faction === 1 && !player.alive;
          })
          // .map((player) => `<@${player.userId}>`)
          .map((player) => `**${player.name}**`)
          .join(', ');
        await user.send(
          '🌙 Bạn là **Thầy Đồng**. Bạn có thể hồi sinh một người phe dân đã chết trong đêm nay. Bạn chỉ có thể làm điều này một lần trong ván đấu.',
        );
        if (player.alive && villagerDead.length > 0) {
          await user.send(
            `${villagerDead} là những người thuộc phe dân làng đã bị chết, bạn có thể hồi sinh trong số họ.`,
          );
        }
        message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.DEAD) {
        await user.send(
          '💀 Bạn đã bị chết, hãy trò chuyện với hội người âm của bạn.',
        );

        message = await user.send({ embeds: [embed], files: [attachment] });
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.FOOL) {
        await user.send(
          '⚜️ Bạn là thằng ngố, nhiệm vụ của bạn là lừa những người khác vote bạn để chiến thắng.',
        );

        message = await user.send({ embeds: [embed], files: [attachment] });
        this.nightMessages.set(player.userId, message);
      } else if (
        player.role.id === WEREROLE.FOXSPIRIT &&
        player.role instanceof FoxSpirit
      ) {
        // Cáo
        await user.send(
          '🦊 Bạn là **Cáo**. Mỗi đêm dậy soi 3 người tự chọn trong danh sách, nếu 1 trong 3 người đó là sói thì được báo \\"Có sói\\", nếu đoán hụt thì mất chức năng.',
        );

        const viewButton = new ButtonBuilder()
          .setCustomId(`view_target_foxspirit_${player.userId}`)
          .setLabel('🔍 Tìm sói')
          .setStyle(ButtonStyle.Secondary);

        if (!player.canUseSkill || !player.role.isHaveSkill) {
          viewButton.setDisabled(true);
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          viewButton,
        );

        message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.MAID) {
        let chooseMasterButton = null;
        if (this.gameState.nightCount === 1) {
          chooseMasterButton = new ButtonBuilder()
            .setCustomId(`choose_master_maid_${player.userId}`)
            .setLabel('👑 Chọn chủ')
            .setStyle(ButtonStyle.Secondary);
        } else {
          chooseMasterButton = new ButtonBuilder()
            .setCustomId(`choose_master_maid_${player.userId}`)
            .setLabel('👑 Đã chọn chủ')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);
        }

        if (!player.canUseSkill && chooseMasterButton) {
          chooseMasterButton.setDisabled(true);
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          chooseMasterButton,
        );

        await user.send(
          '🌙 Bạn là **Hầu Gái**. Hãy chọn một người làm chủ của bạn (chỉ được chọn trong đêm đầu tiên).',
        );
        message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.LYCAN) {
        await user.send(
          '🤷 Bạn là **Lycan**. Hãy chấp nhận số phận của mình đi!!!',
        );

        message = await user.send({ embeds: [embed], files: [attachment] });
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.ELDER) {
        await user.send(
          '👴 Bạn là **Già Làng**. Sói phải cắn 2 lần thì Già làng mới chết.',
        );

        message = await user.send({ embeds: [embed], files: [attachment] });
        this.nightMessages.set(player.userId, message);
      } else if (
        player.role.id === WEREROLE.STALKER &&
        player.role instanceof Stalker
      ) {
        await user.send(
          `👀 Bạn là **Stalker**. Bạn có thể theo dõi 1 người chơi và biết đêm đó họ có hành động hay không. Bạn còn có thể chọn người để ám sát, nếu ám sát trúng người không làm gì đêm đó thì người đó chết. Thắng khi là người duy nhất sống sót. (Theo dõi: ${player.role.stalkCount}, Ám sát: ${player.role.killCount})`,
        );

        const stalkButton = new ButtonBuilder()
          .setCustomId(`stalk_target_stalker_${player.userId}`)
          .setLabel('👀 Theo dõi')
          .setStyle(ButtonStyle.Secondary);

        if (player.role.stalkCount <= 0) {
          stalkButton.setDisabled(true);
        }

        const killButton = new ButtonBuilder()
          .setCustomId(`kill_target_stalker_${player.userId}`)
          .setLabel('🔪 Ám sát')
          .setStyle(ButtonStyle.Secondary);

        if (player.role.killCount <= 0) {
          killButton.setDisabled(true);
        }

        if (!player.canUseSkill) {
          stalkButton.setDisabled(true);
          killButton.setDisabled(true);
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          stalkButton,
          killButton,
        );

        message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
        this.nightMessages.set(player.userId, message);
      } else if (
        player.role.id === WEREROLE.GUNNER &&
        player.role instanceof Gunner
      ) {
        await user.send(
          `🔫 Bạn là **Xạ thủ**. Bạn có hai viên đạn, bạn có thể sử dụng đạn để bắn người chơi khác. Bạn chỉ có thể bắn một viên đạn mỗi ngày (Đạn: ${player.role.bullets}).`,
        );

        message = await user.send({ embeds: [embed], files: [attachment] });
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.KITTENWOLF) {
        await user.send(
          '🐺 Bạn là **Sói Mèo Con**. Khi bạn bị giết, cuộc bỏ phiếu của sói tiếp theo sẽ biến đổi một dân làng thành ma sói thay vì giết chết họ.',
        );

        message = await user.send({ embeds: [embed], files: [attachment] });
        this.nightMessages.set(player.userId, message);
      } else if (
        player.role.id === WEREROLE.PUPPETEER &&
        player.role instanceof Puppeteer
      ) {
        await user.send(
          '🐕‍🦺 Bạn là **Người Múa Rối**. Một lần duy nhất trong suốt ván chơi, bạn có thể chỉ định Sói ăn thịt một người. Người đó có thể là một người khác so với sự thống nhất ban đầu của Sói. Bạn cũng có thể buộc Sói ăn thịt một Sói khác.',
        );
        const puppetButton = new ButtonBuilder()
          .setCustomId(`puppet_target_puppeteer_${player.userId}`)
          .setStyle(ButtonStyle.Secondary)
          .setLabel('🎭 Chỉ định mục tiêu');

        if (!player.canUseSkill) {
          puppetButton.setDisabled(true);
        }

        if (player.role.targetCount <= 0) {
          puppetButton.setLabel('🎭 Đã chỉ định mục tiêu');
          puppetButton.setDisabled(true);
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          puppetButton,
        );

        message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
        this.nightMessages.set(player.userId, message);
      } else if (
        player.role.id === WEREROLE.VOODOO &&
        player.role instanceof VoodooWerewolf
      ) {
        const voteButton = new ButtonBuilder()
          .setCustomId(`vote_target_wolf_${player.userId}`)
          .setLabel('🗳️ Vote người cần giết')
          .setStyle(ButtonStyle.Secondary);

        const silentButton = new ButtonBuilder()
          .setCustomId(`voodoo_silent_${player.userId}`)
          .setLabel('🔇 Làm câm lặng')
          .setStyle(ButtonStyle.Secondary);

        if (player.role.silentCount <= 0) {
          silentButton.setDisabled(true);
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          voteButton,
          silentButton,
        );
        await user.send(
          '🐺 Bạn là **Sói Tà Thuật**. Bạn có thể làm câm lặng một người chơi, ngăn chặn họ nói chuyện và bỏ phiếu. Ngoài ra, một lần trong trò chơi, bạn có thể đưa một người chơi chìm vào cơn ác mộng, ngăn chặn mọi hành động ban đêm của họ.',
        );
        message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });

        wolfMessages.push(message);
        this.nightMessages.set(player.userId, message);
      } else {
        await user.send(`🌙 Bạn là dân làng, một đêm yên tĩnh trôi qua. Bạn hãy chờ ${this.settings.nightTime} giây cho đến sáng.`);

        message = await user.send({ embeds: [embed], files: [attachment] });
        this.nightMessages.set(player.userId, message);
      }
    });

    await this.safePromiseAllSettled(dmPromises);

    this.addTimeout(
      async () => {
        const wolfMessages = this.players
          .filter((p) => p.role.faction === Faction.WEREWOLF)
          .map(wolf => ({
            userId: wolf.userId,
            content: '### ⚠️ Thông báo: sói còn **10** giây để vote!',
          }));

        await this.batchSendMessages(wolfMessages);
      },
      this.settings.wolfVoteTime * 1000 - 10000,
    );

    this.addTimeout(async () => {
      for (const message of wolfMessages) {
        try {
          const row = ActionRowBuilder.from(
            message.components[0] as APIActionRowComponent<APIButtonComponent>,
          ) as ActionRowBuilder<ButtonBuilder>;

          row.components.forEach((component) => {
            const data = (component as ButtonBuilder).data;
            if ('custom_id' in data && data.custom_id?.startsWith('vote_target_wolf_')) {
              (component as ButtonBuilder)
                .setDisabled(true)
                .setLabel('🗳️ Hết thời gian vote');
            }
          });

          await message.edit({ components: [row] });
          await message.reply('⏰ Đã hết thời gian vote!\n');
        } catch (err) {
          console.error('Không thể cập nhật nút vote của Sói:', err);
        }
      }
      const mostVotedUserId = this.totalVotedWolvesSolve();
      if (mostVotedUserId) {
        for (const player of this.players) {
          // nếu phù thuỷ còn bình mới được gửi
          if (
            player.role.id === WEREROLE.WITCH &&
            player.role instanceof Witch &&
            player.role.healCount > 0
          ) {
            const user = await this.fetchUser(player.userId);
            if (user) {
              player.role.needHelpPerson = mostVotedUserId;

              const witchMessage = this.witchMessages.get(player.userId);
              if (witchMessage) {
                const row = ActionRowBuilder.from(
                  witchMessage
                    .components[0] as APIActionRowComponent<APIButtonComponent>,
                ) as ActionRowBuilder<ButtonBuilder>;
                (row.components[1] as ButtonBuilder).setDisabled(false);
                await witchMessage.edit({ components: [row] });
              }
              const victim = this.players.find(
                (p) => p.userId === mostVotedUserId,
              );
              const victimIndex =
                this.players.findIndex((p) => p.userId === mostVotedUserId) + 1;
              await user.send(
                `🌙 Sói đã chọn giết người chơi **${victim?.name}** (${victimIndex}).`,
              );
            }
          }
        }
      }
    }, this.settings.wolfVoteTime * 1000);

    this.addTimeout(
      async () => {
        const playerMessages = this.players.map(player => ({
          userId: player.userId,
          content: '### ⚠️ Thông báo: còn **10** giây nữa trời sẽ sáng!',
        }));

        await this.batchSendMessages(playerMessages);
      },
      this.settings.nightTime * 1000 - 10000,
    );

    this.addTimeout(async () => {
      for (const [playerId, message] of this.nightMessages) {
        try {
          if (message.components && message.components.length > 0) {
            const rows = message.components.map((row) => {
              const newRow = ActionRowBuilder.from(
                row as APIActionRowComponent<APIButtonComponent>,
              ) as ActionRowBuilder<ButtonBuilder>;
              newRow.components.forEach((component) => {
                (component as ButtonBuilder).setDisabled(true);
                const buttonComponent = component as ButtonBuilder;
                if (
                  buttonComponent.data &&
                  'label' in buttonComponent.data &&
                  buttonComponent.data.label
                ) {
                  buttonComponent.setLabel(
                    `${buttonComponent.data.label} (Hết hạn)`,
                  );
                }
              });
              return newRow;
            });
            await message.edit({ components: rows });
          }
        } catch (err) {
          console.error(`Không thể disable button cho ${playerId}:`, err);
        }
      }
      this.nightMessages.clear();
    }, this.settings.nightTime * 1000);

    await new Promise((resolve) =>
      this.addTimeout(() => resolve(undefined), this.settings.nightTime * 1000),
    );
  }

  /**
   * @description Đoạn này xin được phép comment nhiều vì sợ đọc lại không hiểu <(")
   */
  async solvePhase2() {
    this.gameState.addLog(`## Đêm thứ ${this.gameState.nightCount}`);

    let mostVotedUserId = this.totalVotedWolvesSolve();
    const killedPlayers = new Set(); // vẫn có thể cứu được
    const sureDieInTheNight = new Set(); // 100% chết ngay trong đêm đó (không thể cứu hay bảo vệ)
    // let savedPlayers = new Set();
    const revivedPlayers = new Set();
    let maidNewRole = null; // Lưu thông tin về vai trò mới của hầu gái
    let giaLangBiTanCong = false;

    // Người múa rối ép sói ăn thịt mục tiêu được chỉ định
    const puppeteer = this.players.find(
      (p) => p.role.id === WEREROLE.PUPPETEER,
    );
    if (
      puppeteer &&
      puppeteer.role instanceof Puppeteer &&
      puppeteer.role.targetWolf
    ) {
      mostVotedUserId = puppeteer.role.targetWolf;
      this.gameState.addLog(
        `Người múa rối đã chỉ định sói ăn thịt **${this.players.find((p) => p.userId === mostVotedUserId)?.name}**`,
      );
    }

    const witch = this.players.find((p) => p.role.id === WEREROLE.WITCH);
    if (mostVotedUserId) {
      this.gameState.addLog(
        `Sói đã chọn cắn **${this.players.find((p) => p.userId === mostVotedUserId)?.name}**`,
      );
      const nguoiBiChoCan = this.players.find(
        (p) => p.userId === mostVotedUserId,
      );
      if (
        witch &&
        nguoiBiChoCan &&
        nguoiBiChoCan.userId === witch.userId &&
        this.gameState.nightCount === 1
      ) {
        // Đêm đầu tiên phù thuỷ không bị sao cả
        this.gameState.addLog(
          'Vì là đêm đầu tiên nên phù thuỷ không bị sao cả',
        );
      } else if (
        nguoiBiChoCan &&
        nguoiBiChoCan.role.id === WEREROLE.ELDER &&
        nguoiBiChoCan.role instanceof Elder
      ) {
        nguoiBiChoCan.role.hp -= 1;
        giaLangBiTanCong = true;
        if (nguoiBiChoCan.role.hp <= 0) {
          killedPlayers.add(nguoiBiChoCan.userId);
        }
      } else {
        if (nguoiBiChoCan) {
          killedPlayers.add(nguoiBiChoCan.userId);
        }
      }
    }
    if (witch && witch.role instanceof Witch && witch.role.poisonedPerson) {
      const witchRole = witch.role;
      const nguoiBiDinhDoc = this.players.find(
        (p) => p.userId === witchRole.poisonedPerson,
      );
      if (nguoiBiDinhDoc) {
        this.gameState.addLog(
          `Phù thuỷ đã đầu độc **${nguoiBiDinhDoc.name}**`,
        );
        sureDieInTheNight.add(nguoiBiDinhDoc.userId);
        killedPlayers.delete(nguoiBiDinhDoc.userId);
      }
      witch.role.poisonCount -= 1;
    }
    // Stalker giết
    const stalker = this.players.find((p) => p.role.id === WEREROLE.STALKER);
    for (const player of this.players) {
      // Trường hợp stalker theo dõi và người này có hành động
      if (
        stalker &&
        stalker.role instanceof Stalker &&
        stalker.role.stalkedPerson &&
        stalker.role.stalkedPerson === player.userId &&
        this.isActivity(player.role.id)
      ) {
        const user = await this.fetchUser(stalker.userId);
        if (user) {
          await user.send(
            `**Thông báo:** 🔍 bạn đã theo dõi **${player.name}** và người này đã hành động.`,
          );
        }
      }
      // Trường hợp stalker theo dõi và người này không có hành động
      if (
        stalker &&
        stalker.role instanceof Stalker &&
        stalker.role.stalkedPerson &&
        stalker.role.stalkedPerson === player.userId &&
        !this.isActivity(player.role.id)
      ) {
        const user = await this.fetchUser(stalker.userId);
        if (user) {
          await user.send(
            `**Thông báo:** 🔍 bạn đã theo dõi **${player.name}** và người này không hành động.`,
          );
        }
      }
      // Trường hợp stalker chọn giết người này và người này hành động
      if (
        stalker &&
        stalker.role instanceof Stalker &&
        stalker.role.killedPerson &&
        stalker.role.killedPerson === player.userId &&
        this.isActivity(player.role.id)
      ) {
        const user = await this.fetchUser(stalker.userId);
        if (user) {
          await user.send(
            `Vì **${player.name}** đã hành động nên bạn không thể giết được người này.`,
          );
        }
      }
      // Trường hợp stalker chọn giết người này và người này không hành động
      if (
        stalker &&
        stalker.role instanceof Stalker &&
        stalker.role.killedPerson &&
        stalker.role.killedPerson === player.userId &&
        !this.isActivity(player.role.id)
      ) {
        const user = await this.fetchUser(stalker.userId);
        if (user) {
          await user.send(
            `Vì **${player.name}** không hành động nên bạn đã giết được người này.`,
          );
          this.gameState.addLog(`Stalker đã giết **${player.name}**`);
          sureDieInTheNight.add(player.userId);
          killedPlayers.delete(player.userId);
        }
      }
    }
    const guard = this.players.find((p) => p.role.id === WEREROLE.BODYGUARD);
    const giaLang = this.players.find((p) => p.role.id === WEREROLE.ELDER);
    for (const killedId of killedPlayers) {
      // người bị chó cắn
      if (!guard || !guard.alive) {
        break;
      }

      if (
        guard.role instanceof Bodyguard &&
        (killedId === guard.role.protectedPerson || killedId === guard.userId)
      ) {
        const hp = (guard.role.hp -= 1);
        this.gameState.addLog(
          `Bảo vệ đã bảo vệ **${this.players.find((p) => p.userId === killedId)?.name}**, anh ấy còn ${hp} máu`,
        );
        // được bảo vệ đỡ đạn
        killedPlayers.delete(killedId);
        if (hp <= 0) {
          // sureDieInTheNight.add(guard.userId);
          killedPlayers.add(guard.userId);
          this.gameState.addLog('Bảo vệ đã chết do chịu 2 lần cắn của sói');
        }

        if (
          giaLangBiTanCong &&
          giaLang &&
          giaLang.role instanceof Elder &&
          giaLang.userId === killedId
        ) {
          giaLang.role.hp += 1;
          giaLangBiTanCong = false;
        }
      }
    }
    if (witch && witch.role instanceof Witch && witch.role.healedPerson) {
      const witchRole = witch.role;
      const saved = this.players.find(
        (p) => p.userId === witchRole.healedPerson,
      );
      // chưa được ai bảo vệ trước đó
      this.gameState.addLog(`Phù thuỷ đã chọn cứu **${saved?.name}**`);
      if (
        saved &&
        killedPlayers.has(saved.userId) &&
        killedPlayers.has(witch.role.healedPerson)
      ) {
        this.gameState.addLog(`Phù thuỷ cứu được **${saved.name}**`);

        witch.role.healCount -= 1;
        killedPlayers.delete(saved.userId);
      }
    }

    const medium = this.players.find((p) => p.role.id === WEREROLE.MEDIUM);
    if (medium && medium.role instanceof Medium && medium.role.revivedPerson) {
      const mediumRole = medium.role;
      const saved = this.players.find(
        (p) => p.userId === mediumRole.revivedPerson && !p.alive,
      );
      if (saved && saved.role instanceof Dead) {
        this.gameState.addLog(
          `Thầy đồng đã hồi sinh thành công **${saved.name}**`,
        );

        saved.role = assignRolesGame(saved.role.originalRoleId);
        saved.alive = true;
        revivedPlayers.add(saved.userId);

        medium.role.revivedCount -= 1;
      }
    }

    // chỗ này không có chỗ nạn nhân của phù thuỷ :v
    for (const killedId of killedPlayers) {
      const killed = this.players.find((p) => p.userId === killedId);
      if (
        killed &&
        killed.role.id === WEREROLE.CURSED &&
        mostVotedUserId &&
        killed.userId === mostVotedUserId
      ) {
        this.gameState.addLog(`Bán sói **${killed.name}** đã biến thành sói`);
        const user = await this.fetchUser(killed.userId);
        if (user) {
          await user.send('### Bạn đã bị sói cắn và biến thành sói');
        }

        killed.role = new Werewolf();
        killed.alive = true;
        killedPlayers.delete(killedId);
      } else if (killed) {
        killed.role = new Dead(killed.role.faction, killed.role.id);
        killed.alive = false;
      }
    }
    for (const killedId of sureDieInTheNight) {
      const killed = this.players.find((p) => p.userId === killedId);
      if (killed) {
        killed.role = new Dead(killed.role.faction, killed.role.id);
        killed.alive = false;
      }
    }

    const allDeadTonight = new Set([...killedPlayers, ...sureDieInTheNight]);

    for (const killedId of Array.from(allDeadTonight)) {
      const killed = this.players.find((p) => p.userId === killedId);
      if (killed) {
        maidNewRole = await this.checkIfMasterIsDead(killed);
      }
    }

    // cần fix role id ELder vì Elder đã chết (new Dead())
    if (giaLang && !giaLang.alive) {
      this.gameState.addLog(
        '👴 Già làng đã chết, tất cả những người thuộc phe dân làng đều sẽ bị mất chức năng.',
      );
      const dmVillagerPromise = this.players
        .filter(
          (p) =>
            (p.alive && p.role.faction === 1) || p.role.id === WEREROLE.ELDER,
        )
        .map(async (player) => {
          const user = await this.fetchUser(player.userId);
          if (!user) {
            return;
          }
          await user.send(
            '### 👴 Già làng đã chết, tất cả những người thuộc phe dân làng đều sẽ bị mất chức năng.',
          );
          player.role = new Villager();
        });
      await this.safePromiseAllSettled(dmVillagerPromise);
    }

    if (allDeadTonight.size !== 0) {
      this.gameState.addLog(
        `${Array.from(allDeadTonight)
          .map((id) => {
            const player = this.players.find((p) => p.userId === id);
            return `**${player?.name}**`;
          })
          .join(', ')} đã thiệt mạng\n`,
      );
    }

    if (allDeadTonight.size === 0) {
      this.gameState.addLog('Không có ai thiệt mạng\n');
    }

    const dmPromises = this.players.map(async (player) => {
      const user = await this.fetchUser(player.userId);
      if (!user) {
        return;
      }

      try {
        if (allDeadTonight.size === 0) {
          await user.send('🌙 Đêm nay không ai thiệt mạng.\n');
        } else {
          const killedPlayersList = Array.from(allDeadTonight)
            .map((id) => {
              const player = this.players.find((p) => p.userId === id);
              return `**${player?.name}**`;
            })
            .join(', ');

          await user.send(`🌙 Đêm nay, ${killedPlayersList} đã thiệt mạng.\n`);

          if (allDeadTonight.has(player.userId)) {
            await user.send('💀 Bạn đã bị giết trong đêm nay.');
            player.alive = false;
          }
        }

        if (maidNewRole) {
          await user.send(
            `### 👒 Hầu gái đã lên thay vai trò **${maidNewRole}** của chủ vì chủ đã chết.\n`,
          );
        }

        if (revivedPlayers.size > 0) {
          const revivedPlayersList = Array.from(revivedPlayers)
            .map((id) => {
              const player = this.players.find((p) => p.userId === id);
              return `**${player?.name}**`;
            })
            .join(', ');
          await user.send(
            `### 🔮 ${revivedPlayersList} đã được hồi sinh bởi Thầy Đồng.\n`,
          );

          if (revivedPlayers.has(player.userId)) {
            await user.send('### ✨ Bạn đã được Thầy Đồng hồi sinh!');
          }
        }
      } catch (err) {
        console.error(`Không thể gửi tin nhắn cho ${player.userId}`, err);
      }
    });

    await this.safePromiseAllSettled(dmPromises);

    for (const player of this.players) {
      player.resetDay();
      player.role.resetDay();
    }

    console.log(this.gameState.log);
  }

  async dayPhase() {
    if (this.status === 'ended') {
      return;
    }
    this.gameState.phase = 'day';
    this.emit('day', this.guildId, this.players, this.gameState);

    const isFirstDay = this.gameState.nightCount === 1;
    const dmPromises = this.players.map(async (player) => {
      const user = await this.fetchUser(player.userId);
      if (!user) {
        return;
      }
      await user.send(
        `# ☀️ Ban ngày đã đến. \nHãy thảo luận và bỏ phiếu để loại trừ người khả nghi nhất. Bạn có ${this.settings.discussTime} giây để thảo luận.`,
      );

      const buffer = await createAvatarCollage(this.players, this.client);
      const attachment = new AttachmentBuilder(buffer, { name: 'avatars.png' });

      const embed = new EmbedBuilder()
        .setTitle('📋 Danh sách người chơi')
        .setColor(0x00ae86)
        .setImage('attachment://avatars.png')
        .setTimestamp();

      if (
        player.role.id === WEREROLE.GUNNER &&
        player.role instanceof Gunner &&
        !isFirstDay &&
        player.role.bullets > 0
      ) {
        const shootButton = new ButtonBuilder()
          .setCustomId(`gunner_shoot_${player.userId}`)
          .setLabel('🔫 Bắn người')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          shootButton,
        );

        await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
      } else if (player.role.id === WEREROLE.VOODOO &&
        player.role instanceof VoodooWerewolf &&
        player.role.voodooCount > 0
      ) {
        const voodooButton = new ButtonBuilder()
          .setCustomId(`voodoo_voodoo_${player.userId}`)
          .setLabel('🌘 Ác mộng')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          voodooButton,
        );

        await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
      } else {
        await user.send({
          embeds: [embed],
          files: [attachment],
        });
      }
    });

    await this.safePromiseAllSettled(dmPromises);

    this.addTimeout(
      async () => {
        const playerMessages = this.players.map(player => ({
          userId: player.userId,
          content: '### ⚠️ Thông báo: còn **10** giây để thảo luận!',
        }));

        await this.batchSendMessages(playerMessages);
      },
      this.settings.discussTime * 1000 - 10000,
    );

    await new Promise((resolve) =>
      this.addTimeout(() => resolve(undefined), this.settings.discussTime * 1000),
    );
  }

  async votePhase() {
    if (this.status === 'ended') {
      return;
    }
    this.gameState.phase = 'voting';
    this.emit('vote', this.guildId, this.players, this.gameState);

    const dmPromises = this.players.map(async (player) => {
      const user = await this.fetchUser(player.userId);
      if (!user) {
        return;
      }
      await user.send(
        `🗳️ Thời gian bỏ phiếu đã đến. Người có số phiếu cao nhất và có ít nhất 2 phiếu sẽ bị treo cổ. Hãy chọn người bạn muốn loại trừ trong ${this.settings.voteTime} giây tới.\n💡 Nhập số 0 hoặc 36 để bỏ qua vote.`,
      );

      const buffer = await createAvatarCollage(this.players, this.client);
      const attachment = new AttachmentBuilder(buffer, { name: 'avatars.png' });

      const embed = new EmbedBuilder()
        .setTitle('📋 Danh sách người chơi')
        .setColor(0x00ae86)
        .setImage('attachment://avatars.png')
        .setTimestamp();

      /**
       * @description Con song thi co button, khong du dung duoc thi disable, chet thi khong co button
      */
      const components = [];
      if (player.alive) {
        const voteButton = new ButtonBuilder()
          .setCustomId(`vote_hanged_${player.userId}`)
          .setLabel('🗳️ Vote người bị treo')
          .setStyle(ButtonStyle.Primary);

        if (!player.canVote) {
          voteButton.setDisabled(true);
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          voteButton,
        );
        components.push(row);
      }
      const message = await user.send({
        embeds: [embed],
        files: [attachment],
        components,
      });
      this.voteMessages.set(player.userId, message);
    });

    await this.safePromiseAllSettled(dmPromises);

    const timeoutPromise = new Promise((resolve) =>
      this.addTimeout(() => resolve('timeout'), this.settings.voteTime * 1000),
    );

    // eslint-disable-next-line no-unused-vars
    let voteCompleteResolve: ((value: unknown) => void) | undefined;
    const voteCompletePromise = new Promise((resolve) => {
      voteCompleteResolve = resolve;
      this.once('voteComplete', resolve);
    });

    const notificationPromise = new Promise<void>((resolve) => {
      this.addTimeout(
        async () => {
          const playerMessages = this.players.map(player => ({
            userId: player.userId,
            content: '### ⚠️ Thông báo: còn **10** giây nữa hết thời gian vote!',
          }));

          await this.batchSendMessages(playerMessages);
          resolve();
        },
        this.settings.voteTime * 1000 - 10000,
      );
    });

    this.trackPromise(timeoutPromise);
    this.trackPromise(voteCompletePromise);
    this.trackPromise(notificationPromise);

    try {
      await Promise.race([timeoutPromise, voteCompletePromise]);
    } finally {
      if (voteCompleteResolve) {
        this.removeListener('voteComplete', voteCompleteResolve);
      }
    }

    for (const [playerId, message] of this.voteMessages) {
      try {
        if (message.components && message.components.length > 0) {
          const row = ActionRowBuilder.from(
            message.components[0] as APIActionRowComponent<APIButtonComponent>,
          ) as ActionRowBuilder<ButtonBuilder>;
          (row.components[0] as ButtonBuilder)
            .setDisabled(true)
            .setLabel('🗳️ Vote (Hết hạn)');
          await message.edit({ components: [row] });
        }
      } catch (err) {
        console.error(`Không thể disable button cho ${playerId}:`, err);
      }
    }
    this.voteMessages.clear();

    const resultHangedPlayer = this.processVote();

    if (!resultHangedPlayer) {
      this.gameState.addLog('Không ai bị treo cổ do không đủ phiếu bầu\n');
      const noHangPromises = this.players.map(async (player) => {
        const user = await this.fetchUser(player.userId);
        if (!user) {
          return;
        }
        await user.send(
          '🎭 Không đủ số phiếu hoặc có nhiều người cùng số phiếu cao nhất, không ai bị treo cổ trong ngày hôm nay.',
        );
      });
      await this.safePromiseAllSettled(noHangPromises);
    } else {
      this.gameState.addLog(
        `**${resultHangedPlayer.hangedPlayer.name}** đã bị dân làng treo cổ`,
      );
      if (resultHangedPlayer.hangedPlayer.role.id === WEREROLE.FOOL) {
        this.gameState.addLog(
          `**${resultHangedPlayer.hangedPlayer.name}** là Thằng Ngố - Thằng Ngố thắng!`,
        );
        this.status = 'ended';
        const foolMessages = this.players.map(async (player) => {
          const user = await this.fetchUser(player.userId);
          if (!user) {
            return;
          }
          await user.send(
            `🎭 **${resultHangedPlayer.hangedPlayer.name}** là **Ngố** và đã bị treo cổ. \n🎉 **Ngố** thắng !!.`,
          );
          const roleRevealEmbed = this.revealRoles();
          await user.send({ embeds: [roleRevealEmbed] });
        });
        await this.safePromiseAllSettled(foolMessages);
        return;
      }

      resultHangedPlayer.hangedPlayer.alive = false;
      resultHangedPlayer.hangedPlayer.role = new Dead(
        resultHangedPlayer.hangedPlayer.role.faction,
        resultHangedPlayer.hangedPlayer.role.id,
      );

      const maidNewRole = await this.checkIfMasterIsDead(resultHangedPlayer.hangedPlayer);

      const hangMessages = this.players.map(async (player) => {
        const user = await this.fetchUser(player.userId);
        if (!user) {
          return;
        }
        await user.send(
          `🎭 **${resultHangedPlayer.hangedPlayer.name}** đã bị dân làng treo cổ vì có số phiếu cao nhất (${resultHangedPlayer.maxVotes} phiếu).`,
        );
        if (resultHangedPlayer.hangedPlayer.userId === player.userId) {
          await user.send('💀 Bạn đã bị dân làng treo cổ.');
        }
        if (maidNewRole) {
          await user.send(
            `### 👒 Hầu gái đã lên thay vai trò **${maidNewRole}** của chủ vì chủ đã bị treo cổ.\n`,
          );
        }
      });

      await this.safePromiseAllSettled(hangMessages);
    }

    const normalWolvesAlive = this.players.filter(
      (p) => p.alive && p.role.faction === 0 && p.role.id === WEREROLE.WEREWOLF,
    );
    const otherWolvesAlive = this.players.filter(
      (p) => p.alive && p.role.faction === 0 && p.role.id !== WEREROLE.WEREWOLF,
    );

    if (normalWolvesAlive.length === 0 && otherWolvesAlive.length > 0) {
      const wolfTransformPromises = otherWolvesAlive.map(async (wolf) => {
        wolf.role = new Werewolf();
        const user = await this.fetchUser(wolf.userId);
        if (user) {
          return user.send(
            '### 🐺 Vì không còn Sói thường nào sống sót, bạn đã biến thành Sói thường!',
          );
        }
      });

      await this.safePromiseAllSettled(wolfTransformPromises);

      this.gameState.addLog(
        `🐺 **${otherWolvesAlive.length}** Sói chức năng đã biến thành **Sói thường** vì không còn Sói thường nào sống sót.`,
      );
    }

    // Tìm già làng bị chết (bị gắn role dead nên dùng originalRoleId)
    const giaLang = this.players.find(
      (p) =>
        !p.alive &&
        p.role.id === WEREROLE.DEAD &&
        p.role instanceof Dead &&
        p.role.originalRoleId === WEREROLE.ELDER,
    );
    if (giaLang && !giaLang.alive) {
      const dmVillagerPromise = this.players
        .filter(
          (p) =>
            (p.alive && p.role.faction === 1) || p.role.id === WEREROLE.ELDER,
        )
        .map(async (player) => {
          const user = await this.fetchUser(player.userId);
          if (!user) {
            return;
          }
          await user.send(
            '### 👴 Già làng đã chết, tất cả những người thuộc phe dân làng đều sẽ bị mất chức năng.',
          );
          this.gameState.addLog(
            '👴 Già làng đã chết, tất cả những người thuộc phe dân làng đều sẽ bị mất chức năng.',
          );
          player.role = new Villager();
        });
      await this.safePromiseAllSettled(dmVillagerPromise);
    }

    // Reset vote and restrict
    for (const player of this.players) {
      player.role.voteHanged = null;
      player.resetRestrict();
    }

    await this.checkEndGame();
  }

  revealRoles() {
    const roleRevealEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('Tiết Lộ Vai Trò')
      .setDescription('```Danh sách vai trò của tất cả người chơi:```')
      .addFields(
        this.players.map((player) => {
          let nameRole = player.role.name;
          if (player.role.id === WEREROLE.DEAD && player.role instanceof Dead) {
            const keyRole =
              player.role.originalRoleId.toString() as keyof typeof rolesData;
            nameRole = rolesData[keyRole].title;
            if (player.role.originalRoleId === WEREROLE.CURSED) {
              nameRole = `${nameRole} (Bán Sói)`;
            }
          }
          let roleEmoji = '👤';
          // Nếu là người chết thì lấy originalRoleId, còn người chưa chết thì lấy id
          switch (
            (player.role instanceof Dead && player.role.originalRoleId) ||
            player.role.id
          ) {
          case 0:
            roleEmoji = '🐺';
            break;
          case 1:
            roleEmoji = '👥';
            break;
          case 2:
            roleEmoji = '🛡️';
            break;
          case 3:
            roleEmoji = '🌙';
            break;
          case 4:
            roleEmoji = '👁️';
            break;
          case 5:
            roleEmoji = '🔍';
            break;
          case 6:
            roleEmoji = '🧪';
            break;
          case 7:
            roleEmoji = '🃏';
            break;
          case 8:
            roleEmoji = '🔮';
            break;
          case 10:
            roleEmoji = '👒';
            break;
          case 11:
            roleEmoji = '🤷';
            break;
          case 12:
            roleEmoji = '🐺';
            break;
          case 13:
            roleEmoji = '🐺';
            break;
          case 14:
            roleEmoji = '🦊';
            break;
          case 15:
            roleEmoji = '👴';
            break;
          case 16:
            roleEmoji = '👀';
            break;
          case 17:
            roleEmoji = '🔫';
            break;
          case 18:
            roleEmoji = '🐺';
            break;
          case 19:
            roleEmoji = '🐕‍🦺';
            break;
          case 20:
            roleEmoji = '🐺';
            break;
          }
          return {
            name: `${roleEmoji} ${nameRole}`,
            value: `**${player.name}**${!player.alive ? ' (💀 Đã chết)' : ''}`,
            inline: true,
          };
        }),
      )
      .setTimestamp()
      .setFooter({ text: 'Hẹ hẹ hẹ' });
    return roleRevealEmbed;
  }

  processVote() {
    const totalVotes = this.players.reduce(
      (acc: Record<string, number>, player) => {
        if (
          player.alive &&
          player.role.voteHanged &&
          player.role.voteHanged !== 'skip'
        ) {
          acc[player.role.voteHanged] = (acc[player.role.voteHanged] || 0) + 1;
        }
        return acc;
      },
      {},
    );

    const voteEntries = Object.entries(totalVotes);

    if (voteEntries.length === 0) {
      return null;
    }

    let maxVotes = 0;
    let candidates: string[] = [];

    for (const [userId, count] of voteEntries) {
      if (count > maxVotes) {
        maxVotes = count;
        candidates = [userId];
      } else if (count === maxVotes) {
        candidates.push(userId);
      }
    }

    if (candidates.length === 1 && maxVotes >= 2) {
      const hangedPlayer = this.players.find((p) => p.userId === candidates[0]);
      if (hangedPlayer && hangedPlayer.alive) {
        hangedPlayer.alive = false;
        return {
          hangedPlayer,
          maxVotes,
        };
      }
    }

    return null;
  }

  async checkEndGame() {
    const victoryResult = this.checkVictory();
    if (victoryResult) {
      this.status = 'ended';
      let winMessage = '';
      switch (victoryResult.winner) {
      case 'werewolf':
        winMessage = '🐺 **Ma Sói thắng!** Họ đã tiêu diệt tất cả dân làng.';
        break;
      case 'village':
        winMessage = '👥 **Dân Làng thắng!** Họ đã tiêu diệt tất cả Ma Sói.';
        break;
      case 'solo':
        winMessage =
            '🎭 **Phe Solo thắng!** Họ đã hoàn thành mục tiêu của mình.';
        break;
      }

      const roleRevealEmbed = this.revealRoles();
      const endGameMessages = this.players.map(player => ({
        userId: player.userId,
        content: {
          content: winMessage,
          embeds: [roleRevealEmbed],
        },
      }));

      try {
        await Promise.race([
          this.batchSendMessages(endGameMessages).catch((error) => console.error('Loi roi', error)),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('End game messages timeout')), 10000),
          ),
        ]);
      } catch (error) {
        console.error(`GameRoom ${this.guildId}: Failed to send end game messages:`, error);
      }

      console.log(this.gameState.log);
      this.status = 'ended';
      // Xoá người chơi trong guild khỏi store
      for (const player of this.players) {
        store.delete(player.userId);
      }
      try {
        await Promise.race([
          this.cleanup(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Cleanup timeout')), 5000),
          ),
        ]);
      } catch (error) {
        console.error(`GameRoom ${this.guildId}: Cleanup timeout in checkEndGame:`, error);
      }

      return true;
    }

    return false;
  }

  async gameLoop() {
    try {
      while (this.status === 'starting') {
        await this.nightPhase();
        await this.solvePhase2();
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
    } finally {
      if (!this.isCleaningUp) {
        await this.cleanup();
      }
    }
  }

  /**
   * @property {string} winner -  ('werewolf', 'village', 'solo').
   * @property {number} faction -  (0: sói, 1: dân, 2: solo)
   */
  checkVictory() {
    const alivePlayers = this.players.filter((p) => p.alive);
    const aliveWolves = alivePlayers.filter((p) => p.role.faction === 0);
    // const aliveVillagers = alivePlayers.filter((p) => p.role.faction === 1);
    const aliveSolos = alivePlayers.filter((p) => p.role.faction === 2);

    if (alivePlayers.length === aliveSolos.length && aliveSolos.length > 0) {
      return { winner: 'solo', faction: 2 };
    }

    if (aliveWolves.length === 0) {
      return { winner: 'village', faction: 1 };
    }

    const nonWolves = alivePlayers.length - aliveWolves.length;
    if (aliveWolves.length >= nonWolves) {
      return { winner: 'werewolf', faction: 0 };
    }

    return null;
  }
  /**
   *
   * @description Dùng hàm này trước resetday
   */
  isActivity(role: number) {
    const player = this.players.find((p) => p.role.id === role);
    if (!player) {
      return false;
    }
    // **check: tinh ca soi thuong va soi co chuc nang vote
    if (
      player.role.faction === Faction.WEREWOLF &&
      'voteBite' in player.role &&
      typeof player.role.voteBite === 'string' &&
      player.role.voteBite
    ) {
      return true;
    }
    // **check
    if (
      player.role.id === WEREROLE.BODYGUARD &&
      player.role instanceof Bodyguard &&
      player.role.protectedPerson
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.SEER &&
      player.role instanceof Seer &&
      player.role.viewCount <= 0
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.DETECTIVE &&
      player.role instanceof Detective &&
      player.role.investigatedPairs.length > 0
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.WITCH &&
      player.role instanceof Witch &&
      player.role.poisonedPerson
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.WITCH &&
      player.role instanceof Witch &&
      player.role.healedPerson
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.MEDIUM &&
      player.role instanceof Medium &&
      player.role.revivedPerson
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.WOLFSEER &&
      player.role instanceof WolfSeer &&
      player.role.seerCount <= 0
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.ALPHAWEREWOLF &&
      player.role instanceof AlphaWerewolf &&
      player.role.maskWolf
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.FOXSPIRIT &&
      player.role instanceof FoxSpirit &&
      player.role.threeViewed.length > 0
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.PUPPETEER &&
      player.role instanceof Puppeteer &&
      player.role.targetWolf
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.VOODOO &&
      player.role instanceof VoodooWerewolf &&
      player.role.silentPlayer
    ) {
      return true;
    }

    return false;
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
