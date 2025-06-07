const Player = require('../types/player');
const { RoleResponseDMs } = require('../utils/response');
const {
  EmbedBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
} = require('discord.js');
const {
  roleTable,
  assignRolesGame,
  convertFactionRoles,
} = require('../utils/role');
const EventEmitter = require('events');
const GameState = require('./gamestate');
const rolesData = require('../data/data.json');
const { createAvatarCollage } = require('./canvas');
const { store } = require('./store');

class GameRoom extends EventEmitter {
  constructor(client, guildId, hostId) {
    super();

    this.client = client;
    this.guildId = guildId;
    this.hostId = hostId;
    this.players = [];
    this.status = 'waiting'; // waiting, starting, ended
    this.gameState = new GameState();
    this.witchMessages = new Map(); // Lưu trữ message của phù thủy
  }

  async fetchUser(userId) {
    try {
      return await this.client.users.fetch(userId);
    } catch (err) {
      console.error(`Không thể fetch user ${userId}`, err);
      return null;
    }
  }

  addPlayer(userId) {
    if (!this.players.some((p) => p.userId === userId)) {
      this.players.push(new Player(userId));
    }
  }

  removePlayer(userId) {
    this.players = this.players.filter((p) => p.userId !== userId);
  }

  hasPlayer(userId) {
    return this.players.some((p) => p.userId === userId);
  }

  isEmpty() {
    return this.players.length === 0;
  }

  assignRoles(playerCount) {
    const roles = [];

    if (playerCount < 4) {
      throw new Error('Cần ít nhất 4 người chơi.');
    }

    const table = roleTable[playerCount];

    if (table) {
      for (const [role, count] of Object.entries(table)) {
        for (let i = 0; i < count; i++) {
          roles.push(Number(role));
        }
      }
    } else {
      const werewolves = Math.floor(playerCount / 4);
      for (let i = 0; i < werewolves; i++) roles.push(0);
      roles.push(2);
      roles.push(6);
      roles.push(8);
      if (playerCount >= 7) roles.push(4);
      if (playerCount >= 7) roles.push(5);
      if (playerCount >= 8) roles.push(3);
      if (playerCount >= 10) roles.push(7);

      const remaining = playerCount - roles.length;
      for (let i = 0; i < remaining; i++) roles.push(1);
    }

    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    return roles;
  }

  async startGame(interaction) {
    if (this.status !== 'waiting')
      throw new Error('Game đã bắt đầu hoặc kết thúc.');

    // lưu vào store
    for (const player of this.players) {
      store.set(player.userId, this.guildId);
    }

    const roles = this.assignRoles(this.players.length);
    const fakeRoles = [0, 2, 4, 6];

    const dmPromises = this.players.map(async (player, i) => {
      const role = assignRolesGame(fakeRoles[i]);
      player.role = role;

      try {
        const user = await interaction.client.users.fetch(player.userId);
        await user.send(
          `🎮 Bạn được phân vai: **${role.name}**. Hãy giữ bí mật!!!`
        );
        await RoleResponseDMs(
          user,
          `${rolesData[role.id].eName.toLowerCase()}.png`,
          role.id,
          convertFactionRoles(rolesData[role.id].faction)
        );
      } catch (err) {
        console.error(`Không thể gửi tin nhắn cho ${player.userId}`, err);
        await interaction.reply({
          content: 'Không thể gửi tin nhắn cho bạn, hãy kiểm tra cài đặt quyền',
          ephemeral: true,
        });
      }
    });
    await Promise.all(dmPromises);

    this.status = 'starting';

    console.log('-----');
    console.log(this.players);

    this.gameState.phase = 'night';
    // this.gameState.nightCount = 0;
    this.gameLoop();
  }

  endGame() {
    this.status = 'ended';
    this.players = [];
  }

  totalVotedWolvesSolve() {
    const totalVotes = this.players.reduce((acc, player) => {
      if (player.role.id === 0 && player.role.voteBite) {
        acc[player.role.voteBite] = (acc[player.role.voteBite] || 0) + 1;
      }
      return acc;
    }, {});

    const voteEntries = Object.entries(totalVotes);

    if (voteEntries.length === 0) return null;

    let maxVotes = 0;
    let candidates = [];

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

    const wolfMessages = [];

    for (const player of this.players) {
      const user = await this.fetchUser(player.userId);
      if (!user) continue;

      const buffer = await createAvatarCollage(this.players, this.client);
      const attachment = new AttachmentBuilder(buffer, { name: 'avatars.png' });

      const embed = new EmbedBuilder()
        .setTitle('📋 Danh sách người chơi')
        .setColor(0x00ae86)
        .setImage('attachment://avatars.png')
        .setTimestamp();

      if (player.role.id === 0) {
        // Sói
        const voteButton = new ButtonBuilder()
          .setCustomId(`vote_target_wolf_${player.userId}`)
          .setLabel('🗳️ Vote người cần giết')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(voteButton);

        await user.send(
          '🌙 Bạn là **Sói**. Hãy vote người cần giết trong 40 giây. Bạn có thể trò chuyện với các Sói khác ngay tại đây.'
        );
        const message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
        wolfMessages.push(message);
      } else if (player.role.id === 2) {
        // Bảo Vệ
        const protectButton = new ButtonBuilder()
          .setCustomId(`protect_target_bodyguard_${player.userId}`)
          .setLabel('🛡️ Bảo vệ người')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(protectButton);

        await user.send(
          '🌙 Bạn là **Bảo Vệ**. Hãy chọn người bạn muốn bảo vệ trong đêm nay. Bạn có thể tự bảo vệ mình.'
        );
        await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
      } else if (player.role.id === 4) {
        // Tiên Tri
        const viewButton = new ButtonBuilder()
          .setCustomId(`view_target_seer_${player.userId}`)
          .setLabel('🔍 Xem vai trò người')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(viewButton);

        await user.send(
          '🌙 Bạn là **Tiên Tri**. Bạn có thể xem vai trò của một người chơi khác trong đêm nay.'
        );
        await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
      } else if (player.role.id === 5) {
        // Thám Tử
        const investigateButton = new ButtonBuilder()
          .setCustomId(`investigate_target_detective_${player.userId}`)
          .setLabel('🔎 Điều tra người')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(investigateButton);

        await user.send(
          '🌙 Bạn là **Thám Tử**. Bạn có thể điều tra hai người chơi để biết họ ở cùng phe hay khác phe.'
        );
        await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
      } else if (player.role.id === 6) {
        // Phù Thuỷ
        const poisonButton = new ButtonBuilder()
          .setCustomId(`poison_target_witch_${player.userId}`)
          .setLabel('💊 Đầu độc người')
          .setStyle(ButtonStyle.Primary);

        const healButton = new ButtonBuilder()
          .setCustomId(`heal_target_witch_${player.userId}`)
          .setLabel('💫 Cứu người')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true);

        const row = new ActionRowBuilder().addComponents(
          poisonButton,
          healButton
        );

        await user.send(
          '🌙 Bạn là **Phù Thuỷ**. Bạn có hai bình thuốc: một để đầu độc và một để cứu người. Bình cứu chỉ có tác dụng nếu người đó bị tấn công.'
        );
        const message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });

        this.witchMessages.set(player.userId, message);
      } else {
        await user.send('🌙 Một đêm yên tĩnh trôi qua. Bạn hãy chờ đến sáng.');
        await user.send({ embeds: [embed], files: [attachment] });
      }
    }

    setTimeout(async () => {
      for (const message of wolfMessages) {
        try {
          const row = ActionRowBuilder.from(message.components[0]);
          row.components[0].setDisabled(true).setLabel('🗳️ Hết thời gian vote');
          await message.edit({ components: [row] });
          await message.reply('⏰ Đã hết thời gian vote!');
        } catch (err) {
          console.error('Không thể cập nhật nút vote của Sói:', err);
        }
      }
      const mostVotedUserId = this.totalVotedWolvesSolve();
      if (mostVotedUserId) {
        for (const player of this.players) {
          if (player.role.id === 6) {
            const user = await this.fetchUser(player.userId);
            if (user) {
              player.role.needHelpPerson = mostVotedUserId;

              const witchMessage = this.witchMessages.get(player.userId);
              if (witchMessage) {
                const row = ActionRowBuilder.from(witchMessage.components[0]);
                row.components[1].setDisabled(false);
                await witchMessage.edit({ components: [row] });
              }
              await user.send(
                `🌙 Sói đã chọn giết người chơi <@${mostVotedUserId}>. ${player.role.needHelpPerson}`
              );
            }
          }
        }
      }
    }, 40_000);

    // Chờ tổng cộng 70 giây cho đêm
    await new Promise((resolve) => setTimeout(resolve, 70_000));
  }

  /**
   *
   * @returns {Promise<void>}
   * Đoạn này xin được phép comment nhiều vì sợ đọc lại không hiểu <(")
   */
  async solvePhase() {
    const mostVotedUserId = this.totalVotedWolvesSolve();
    let killedPlayers = new Set();
    let savedPlayers = new Set();

    // Nếu không ai bị vote
    if (!mostVotedUserId) {
      for (const player of this.players) {
        const user = await this.fetchUser(player.userId);
        if (user) {
          await user.send('🌙 Đêm nay không ai bị tấn công.');
        }
      }
      return;
    }

    // Kiểm tra người bị vote có được bảo vệ không
    for (const player of this.players) {
      // Nếu là người bị vote
      if (mostVotedUserId === player.userId) {
        if (player.role.id === 7) {
          // thằng ngố -> end game
        }

        // Kiểm tra nếu là đêm đầu tiên và người bị tấn công là phù thủy
        if (this.gameState.nightCount === 1 && player.role.id === 6) {
          savedPlayers.add(mostVotedUserId);
          continue;
        }

        if (player.role.id === 2) {
          player.role.hp -= 1;
          if (player.role.hp <= 0) {
            const user = await this.fetchUser(player.userId);
            if (user) {
              await user.send(
                '💀 Bạn đã chết vì bảo vệ người chơi bị tấn công quá nhiều lần.'
              );
            }
            player.alive = false;
            killedPlayers.add(player.userId);
          }
          continue;
        }

        // Kiểm tra có được bảo vệ không
        const isProtected = this.players.some(
          (p) => p.role.id === 2 && p.role.protectedPerson === mostVotedUserId
        );

        // Kiểm tra phù thủy có cứu không
        const isHealedByWitch = this.players.some(
          (p) => p.role.id === 6 && p.role.healedPerson === mostVotedUserId
        );

        if (isProtected || isHealedByWitch) {
          if (isHealedByWitch) {
            if (isProtected) {
              const witch = this.players.find((p) => p.role.id === 6);
              witch.role.healCount = 1;
            }
            if (!isProtected) {
              const witch = this.players.find((p) => p.role.id === 6);
              witch.role.healCount -= 1;
            }
          }
          if (isProtected) {
            const bodyguard = this.players.find((p) => p.role.id === 2);
            bodyguard.role.hp -= 1;

            if (bodyguard.role.hp <= 0) {
              const user = await this.fetchUser(bodyguard.userId);
              if (user) {
                await user.send(
                  '💀 Bạn đã chết vì bảo vệ người chơi bị tấn công quá nhiều lần.'
                );
              }
              bodyguard.alive = false;
              killedPlayers.add(bodyguard.userId);
            }
          }

          savedPlayers.add(mostVotedUserId);
        } else {
          killedPlayers.add(mostVotedUserId);
        }
      }

      // Kiểm tra phù thủy có đầu độc ai không
      if (player.role.id === 6 && player.role.poisonedPerson) {
        player.role.poisonCount -= 1;
        killedPlayers.add(player.role.poisonedPerson);
      }
    }

    // Thông báo kết quả
    for (const player of this.players) {
      const user = await this.fetchUser(player.userId);
      if (!user) continue;

      if (killedPlayers.size === 0) {
        await user.send('🌙 Đêm nay không ai thiệt mạng.');
      } else {
        const killedPlayersList = Array.from(killedPlayers)
          .map((id) => `<@${id}>`)
          .join(', ');
        await user.send(`🌙 Đêm nay, ${killedPlayersList} đã thiệt mạng.`);

        // Nếu người chơi bị giết, thông báo riêng
        if (killedPlayers.has(player.userId)) {
          await user.send('💀 Bạn đã bị giết trong đêm nay.');
          player.alive = false;
        }
      }
    }

    // Reset các hành động của đêm
    for (const player of this.players) {
      player.role.resetDay();
    }
  }

  async dayPhase() {
    this.gameState.phase = 'day';
    this.emit('day', this.guildId, this.players, this.gameState);

    for (const player of this.players) {
      const user = await this.fetchUser(player.userId);
      if (!user) continue;
      await user.send(
        '☀️ Ban ngày đã đến. Hãy thảo luận và bỏ phiếu để loại trừ người khả nghi nhất. Bạn có 30 giây để quyết định.'
      );
    }

    // Chờ 30 giây
    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }

  async votePhase() {
    this.gameState.phase = 'voting';
    this.emit('vote', this.guildId, this.players, this.gameState);

    for (const player of this.players) {
      const user = await this.fetchUser(player.userId);
      if (!user) continue;
      await user.send(
        '🗳️ Thời gian bỏ phiếu đã đến. Hãy chọn người bạn muốn loại trừ trong 30 giây tới.'
      );

      const buffer = await createAvatarCollage(this.players, this.client);
      const attachment = new AttachmentBuilder(buffer, { name: 'avatars.png' });

      const embed = new EmbedBuilder()
        .setTitle('📋 Danh sách người chơi')
        .setColor(0x00ae86)
        .setImage('attachment://avatars.png')
        .setTimestamp();

      const voteButton = new ButtonBuilder()
        .setCustomId(`vote_hanged_${player.userId}`)
        .setLabel('🗳️ Vote người bị treo')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(voteButton);
      await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });
    }

    // Chờ 30 giây
    await new Promise((resolve) => setTimeout(resolve, 30_000));

    this.processVote();

    if (this.checkVictory()) {
      this.endGame();
      return;
    }

    this.gameState.round += 1;
  }

  async gameLoop() {
    while (this.status === 'starting') {
      await this.nightPhase();
      await this.solvePhase();
      await this.dayPhase();
      await this.votePhase();
    }
  }

  processVote() {}

  checkVictory() {}
}

// gameRoom có key là guilId và value là class GameRoom
module.exports = {
  gameRooms: new Map(),
  GameRoom,
  Player,
};
