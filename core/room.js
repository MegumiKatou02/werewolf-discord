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
    const fakeRoles = [0, 4, 5, 2];

    const dmPromises = this.players.map(async (player, i) => {
      const role = assignRolesGame(fakeRoles[i]);
      player.role = role;

      try {
        const user = await interaction.client.users.fetch(player.userId);
        await user.send(
          `🎮 Bạn được phân vai: **${role.name}**. Hãy giữ bí mật! 🤫`
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

  async nightPhase() {
    this.gameState.phase = 'night';
    this.gameState.nightCount += 1;

    this.emit('night', this.guildId, this.players, this.gameState);

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
          '🌙 Bạn là **Sói**. Hãy vote người cần giết. Bạn có thể trò chuyện với các Sói khác ngay tại đây.'
        );
        await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
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
      } else if( player.role.id === 4) {
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
          .setLabel('🩹 Cứu người')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(poisonButton, healButton);

        await user.send(
          '🌙 Bạn là **Phù Thuỷ**. Bạn có hai bình thuốc: một để đầu độc và một để cứu người. Bình cứu chỉ có tác dụng nếu người đó bị tấn công.'
        );
        await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
      } else {
        await user.send('🌙 Một đêm yên tĩnh trôi qua. Bạn hãy chờ đến sáng.');
        await user.send({ embeds: [embed], files: [attachment] });
      }
    }

    // Chờ 60 giây
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  }

  async dayPhase() {
    this.emit('day', this.guildId, this.players, this.gameState);

    for (const player of this.players) {
      const user = await this.fetchUser(player.userId);
      if (!user) continue;
      await user.send(
        '☀️ Ban ngày đã đến. Hãy thảo luận và bỏ phiếu để loại trừ người khả nghi nhất. Bạn có 30 giây để quyết định.'
      );
    }

    for (const p of this.players) {
      if (p.role.id === 0) {
        console.log(`${p.userId} -> ${p.role.voteBite}`);
      }
      if (p.role.id === 2) {
        console.log(`${p.userId} -> ${p.role.protectedPerson}`);
      }
    }

    // Chờ 30 giây
    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }

  async votePhase() {
    this.emit('vote', this.guildId, this.players, this.gameState);

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
