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
  WEREROLE,
} = require('../utils/role');
const EventEmitter = require('events');
const GameState = require('./gamestate');
const rolesData = require('../data/data.json');
const { createAvatarCollage } = require('./canvas');
const { store, serverSettings } = require('./store');
const Dead = require('../types/roles/Dead');
const Werewolf = require('../types/roles/WereWolf');
const Maid = require('../types/roles/Maid');
const Villager = require('../types/roles/Villager');

class GameRoom extends EventEmitter {
  constructor(client, guildId, hostId) {
    super();

    this.client = client;
    this.guildId = guildId;
    this.hostId = hostId;
    this.players = [];
    this.status = 'waiting'; // waiting, starting, ended
    this.gameState = new GameState();
    this.witchMessages = new Map(); // message phù thuỷ
    this.nightMessages = new Map(); // message ban đêm
    this.voteMessages = new Map(); // message vote treo cổ
    this.settings = {
      wolfVoteTime: 40,
      nightTime: 70,
      discussTime: 90,
      voteTime: 30,
    };
  }

  async fetchUser(userId) {
    try {
      return await this.client.users.fetch(userId);
    } catch (err) {
      console.error(`Không thể fetch user ${userId}`, err);
      return null;
    }
  }

  async addPlayer(userId) {
    const user = await this.fetchUser(userId);
    if (!user) return;

    const name = user.globalName || user.username;

    if (!this.players.some((p) => p.userId === userId)) {
      this.players.push(new Player(userId, name));
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

  assignRoles(playerCount, customRoles = null) {
    const roles = [];

    if (playerCount < 4) {
      throw new Error('Cần ít nhất 4 người chơi.');
    }

    if (customRoles) {
      for (const [roleId, count] of Object.entries(customRoles)) {
        for (let i = 0; i < count; i++) {
          roles.push(Number(roleId));
        }
      }
    } else {
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
    }

    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    return roles;
  }

  async startGame(interaction, customRoles = null) {
    if (this.status !== 'waiting')
      throw new Error('Game đã bắt đầu hoặc kết thúc.');

    // lưu vào store
    for (const player of this.players) {
      store.set(player.userId, this.guildId);
    }

    if (this.guildId && serverSettings.get(this.guildId)) {
      this.settings = serverSettings.get(this.guildId);
    }

    const roles = this.assignRoles(this.players.length, customRoles);
    const fakeRoles = [
      WEREROLE.LYCAN,
      WEREROLE.SEER,
      WEREROLE.DETECTIVE,
      WEREROLE.WEREWOLF,
    ];

    const allWerewolves = [];

    const dmPromises = this.players.map(async (player, i) => {
      const role = assignRolesGame(roles[i]);
      player.role = role;
      if (player.role.faction === 0) {
        allWerewolves.push(player.userId);
      }

      try {
        const user = await interaction.client.users.fetch(player.userId);
        await user.send(
          `🎮 Bạn được phân vai: **${role.name}**. Hãy giữ bí mật!!!`
        );
        await RoleResponseDMs(
          user,
          `${rolesData[role.id].eName.toLowerCase().replace(/\s+/g, '_')}.png`,
          role.id,
          convertFactionRoles(rolesData[role.id].faction)
        );
      } catch (err) {
        console.error(`Không thể gửi tin nhắn cho ${player.userId}`, err);
        await interaction.reply({
          content: `Không thể gửi tin nhắn cho bạn (<@${player.userId}>), hãy kiểm tra cài đặt quyền`,
          ephemeral: true,
        });
      }
    });
    await Promise.allSettled(dmPromises);

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
                  return `**${teammate.name}**`;
                })
                .join(', ') || 'Không có đồng đội.'
            }`
          );
        } catch (error) {
          console.error(`Không thể gửi tin nhắn cho ${player.userId}`, err);
          await interaction.reply({
            content:
              'Không thể gửi tin nhắn cho bạn, hãy kiểm tra cài đặt quyền',
            ephemeral: true,
          });
        }
      });
    await Promise.allSettled(woPromises);

    this.status = 'starting';

    console.log('-----');
    console.log(this.players);

    this.gameState.phase = 'night';
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

    console.log(totalVotes);

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

    const dmPromises = this.players.map(async (player) => {
      const user = await this.fetchUser(player.userId);
      if (!user) return;

      await user.send(
        `# 🌑 Đêm ${this.gameState.nightCount === 1 ? 'đầu tiên' : `thứ ${this.gameState.nightCount}`}.`
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

        const row = new ActionRowBuilder().addComponents(voteButton);

        await user.send(
          `🌙 Bạn là **Sói**. Hãy vote người cần giết trong ${this.settings.wolfVoteTime} giây. Bạn có thể trò chuyện với các Sói khác ngay tại đây.`
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
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(viewButton);

        await user.send(
          '🌙 Bạn là **Sói Tiên Tri**. Bạn có thể xem vai trò của một người chơi có phải là tiên tri hay không.'
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
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(maskButton);

        await user.send(
          '🌙 Bạn là **Sói Trùm**. Bạn có thể che sói khỏi tiên tri, mỗi đêm 1 sói, được phép che liên tục một sói.'
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
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(protectButton);

        await user.send(
          '🌙 Bạn là **Bảo Vệ**. Hãy chọn người bạn muốn bảo vệ trong đêm nay. Bạn có thể tự bảo vệ mình.'
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
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(viewButton);

        await user.send(
          '🌙 Bạn là **Tiên Tri**. Bạn có thể xem phe của một người chơi khác trong đêm nay.'
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
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(investigateButton);

        await user.send(
          '🌙 Bạn là **Thám Tử**. Bạn có thể điều tra hai người chơi để biết họ ở cùng phe hay khác phe.'
        );
        message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.WITCH) {
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
          `🌙 Bạn là **Phù Thuỷ**. Bạn có hai bình thuốc: một để đầu độc và một để cứu người. Bình cứu chỉ có tác dụng nếu người đó bị tấn công.\n (Bình độc: ${player.role.poisonCount}, Bình cứu: ${player.role.healCount}).`
        );
        message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });

        this.witchMessages.set(player.userId, message);
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.MEDIUM) {
        // Thầy Đồng
        const reviveButton = new ButtonBuilder()
          .setCustomId(`revive_target_medium_${player.userId}`)
          .setLabel('🔮 Hồi sinh người')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(reviveButton);

        const villagerDead = this.players
          .filter((player) => {
            return player.role.faction === 1 && !player.alive;
          })
          .map((player) => `<@${player.userId}>`)
          .join(', ');
        await user.send(
          '🌙 Bạn là **Thầy Đồng**. Bạn có thể hồi sinh một người phe dân đã chết trong đêm nay. Bạn chỉ có thể làm điều này một lần trong ván đấu.'
        );
        if (player.alive && villagerDead.length > 0) {
          await user.send(
            `${villagerDead} là những người thuộc phe dân làng đã bị chết, bạn có thể hồi sinh trong số họ.`
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
          '💀 Bạn đã bị chết, hãy trò chuyện với hội người âm của bạn.'
        );

        message = await user.send({ embeds: [embed], files: [attachment] });
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.FOOL) {
        await user.send(
          '⚜️ Bạn là thằng ngố, nhiệm vụ của bạn là lừa những người khác vote bạn để chiến thắng.'
        );

        message = await user.send({ embeds: [embed], files: [attachment] });
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.FOXSPIRIT) {
        // Cáo
        await user.send(
          '🦊 Bạn là **Cáo**. Mỗi đêm dậy soi 3 người tự chọn trong danh sách, nếu 1 trong 3 người đó là sói thì được báo \"Có sói\", nếu đoán hụt thì mất chức năng.'
        );

        const viewButton = new ButtonBuilder()
          .setCustomId(`view_target_foxspirit_${player.userId}`)
          .setLabel('🔍 Tìm sói')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(viewButton);

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
            .setStyle(ButtonStyle.Primary);
        } else {
          chooseMasterButton = new ButtonBuilder()
            .setCustomId(`choose_master_maid_${player.userId}`)
            .setLabel('👑 Đã chọn chủ')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true);
        }

        const row = new ActionRowBuilder().addComponents(chooseMasterButton);

        await user.send(
          '🌙 Bạn là **Hầu Gái**. Hãy chọn một người làm chủ của bạn.'
        );
        message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.LYCAN) {
        await user.send(
          '🤷 Bạn là **Lycan**. Hãy chấp nhận số phận của mình đi!!!'
        );

        message = await user.send({ embeds: [embed], files: [attachment] });
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.ELDER) {
        await user.send(
          '👴 Bạn là **Già Làng**. Sói phải cắn 2 lần thì Già làng mới chết.'
        );

        message = await user.send({ embeds: [embed], files: [attachment] });
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.STALKER) {
        await user.send(
          `👀 Bạn là **Stalker**. Bạn có thể theo dõi 1 người chơi và biết đêm đó họ có hành động hay không. Bạn còn có thể chọn người để ám sát, nếu ám sát trúng người không làm gì đêm đó thì người đó chết. Thắng khi là người duy nhất sống sót. (Theo dõi: ${player.role.stalkCount}, Ám sát: ${player.role.killCount})`
        );

        const stalkButton = new ButtonBuilder()
          .setCustomId(`stalk_target_stalker_${player.userId}`)
          .setLabel('👀 Theo dõi')
          .setStyle(ButtonStyle.Primary);

        const killButton = new ButtonBuilder()
          .setCustomId(`kill_target_stalker_${player.userId}`)
          .setLabel('🔪 Ám sát')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(
          stalkButton,
          killButton
        );

        message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
        this.nightMessages.set(player.userId, message);
      } else if (player.role.id === WEREROLE.GUNNER) {
        await user.send(
          `🔫 Bạn là **Xạ thủ**. Bạn có hai viên đạn, bạn có thể sử dụng đạn để bắn người chơi khác. Bạn chỉ có thể bắn một viên đạn mỗi đêm (Đạn: ${player.role.bullets}).`
        );

        message = await user.send({ embeds: [embed], files: [attachment] });
        this.nightMessages.set(player.userId, message);
      } else {
        await user.send('🌙 Một đêm yên tĩnh trôi qua. Bạn hãy chờ đến sáng.');

        message = await user.send({ embeds: [embed], files: [attachment] });
        this.nightMessages.set(player.userId, message);
      }
    });

    await Promise.allSettled(dmPromises);

    setTimeout(
      async () => {
        const notifyWolves = this.players
          .filter((p) => p.role.id === WEREROLE.WEREWOLF)
          .map(async (wolf) => {
            try {
              const user = await this.fetchUser(wolf.userId);
              await user.send(`### ⚠️ Thông báo: còn **10** giây để vote!`);
            } catch (err) {
              console.error(`Không thể gửi tin nhắn cho ${wolf.userId}`, err);
            }
          });
        await Promise.allSettled(notifyWolves);
      },
      this.settings.wolfVoteTime * 1000 - 10000
    );

    setTimeout(async () => {
      for (const message of wolfMessages) {
        try {
          const row = ActionRowBuilder.from(message.components[0]);
          row.components[0].setDisabled(true).setLabel('🗳️ Hết thời gian vote');
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
          if (player.role.id === WEREROLE.WITCH && player.role.healCount > 0) {
            const user = await this.fetchUser(player.userId);
            if (user) {
              player.role.needHelpPerson = mostVotedUserId;

              const witchMessage = this.witchMessages.get(player.userId);
              if (witchMessage) {
                const row = ActionRowBuilder.from(witchMessage.components[0]);
                row.components[1].setDisabled(false);
                await witchMessage.edit({ components: [row] });
              }
              const victim = this.players.find(
                (p) => p.userId === mostVotedUserId
              );
              const victimIndex =
                this.players.findIndex((p) => p.userId === mostVotedUserId) + 1;
              await user.send(
                `🌙 Sói đã chọn giết người chơi **${victim.name}** (${victimIndex}).`
              );
            }
          }
        }
      }
    }, this.settings.wolfVoteTime * 1000);

    setTimeout(
      async () => {
        const notifyPlayers = this.players.map(async (player) => {
          try {
            const user = await this.fetchUser(player.userId);
            await user.send(
              `### ⚠️ Thông báo: còn **10** giây nữa trời sẽ sáng!`
            );
          } catch (err) {
            console.error(`Không thể gửi tin nhắn cho ${player.userId}`, err);
          }
        });
        await Promise.allSettled(notifyPlayers);
      },
      this.settings.nightTime * 1000 - 10000
    );

    setTimeout(async () => {
      for (const [playerId, message] of this.nightMessages) {
        try {
          if (message.components && message.components.length > 0) {
            const rows = message.components.map((row) => {
              const newRow = ActionRowBuilder.from(row);
              newRow.components.forEach((component) => {
                component.setDisabled(true);
                if (component.data.label) {
                  component.setLabel(`${component.data.label} (Hết hạn)`);
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
      setTimeout(resolve, this.settings.nightTime * 1000)
    );
  }

  /**
   *
   * @returns {Promise<void>}
   * Đoạn này xin được phép comment nhiều vì sợ đọc lại không hiểu <(")
   */
  async solvePhase2() {
    this.gameState.log.push(`## Đêm thứ ${this.gameState.nightCount}`);

    const mostVotedUserId = this.totalVotedWolvesSolve();
    let killedPlayers = new Set(); // vẫn có thể cứu được
    let sureDieInTheNight = new Set(); // 100% chết ngay trong đêm đó (không thể cứu hay bảo vệ)
    // let savedPlayers = new Set();
    let revivedPlayers = new Set();
    let maidNewRole = null; // Lưu thông tin về vai trò mới của hầu gái
    let giaLangBiTanCong = false;

    const witch = this.players.find((p) => p.role.id === WEREROLE.WITCH);
    if (mostVotedUserId) {
      this.gameState.log.push(
        `Sói đã chọn cắn **${this.players.find((p) => p.userId === mostVotedUserId).name}**`
      );
      const nguoiBiChoCan = this.players.find(
        (p) => p.userId === mostVotedUserId
      );
      if (
        witch &&
        nguoiBiChoCan.userId === witch.userId &&
        this.gameState.nightCount === 1
      ) {
        // Đêm đầu tiên phù thuỷ không bị sao cả
        this.gameState.log.push(
          `Vì là đêm đầu tiên nên phù thuỷ không bị sao cả`
        );
      } else if (nguoiBiChoCan.role.id === WEREROLE.ELDER) {
        nguoiBiChoCan.role.hp -= 1;
        giaLangBiTanCong = true;
        if (nguoiBiChoCan.role.hp <= 0) {
          killedPlayers.add(nguoiBiChoCan.userId);
        }
      } else {
        killedPlayers.add(nguoiBiChoCan.userId);
      }
    }
    if (witch && witch.role.poisonedPerson) {
      const nguoiBiDinhDoc = this.players.find(
        (p) => p.userId === witch.role.poisonedPerson
      );
      this.gameState.log.push(`Phù thuỷ đã đầu độc **${nguoiBiDinhDoc.name}**`);
      sureDieInTheNight.add(nguoiBiDinhDoc.userId);
      killedPlayers.delete(nguoiBiDinhDoc.userId);

      witch.role.poisonCount -= 1;
    }
    // Stalker giết
    const stalker = this.players.find((p) => p.role.id === WEREROLE.STALKER);
    let stalkerPerson = null;
    let stalkerKillPersion = null;
    for (const player of this.players) {
      // Trường hợp stalker theo dõi và người này có hành động
      if (
        stalker &&
        stalker.role.stalkedPerson &&
        stalker.role.stalkedPerson === player.userId &&
        this.isActivity(player.role.id)
      ) {
        const user = await this.fetchUser(stalker.userId);
        if (user) {
          await user.send(
            `**Thông báo:** 🔍 bạn đã theo dõi **${player.name}** và người này đã hành động.`
          );
        }
      }
      // Trường hợp stalker theo dõi và người này không có hành động
      if (
        stalker &&
        stalker.role.stalkedPerson &&
        stalker.role.stalkedPerson === player.userId &&
        !this.isActivity(player.role.id)
      ) {
        const user = await this.fetchUser(stalker.userId);
        if (user) {
          await user.send(
            `**Thông báo:** 🔍 bạn đã theo dõi **${player.name}** và người này không hành động.`
          );
        }
      }
      // Trường hợp stalker chọn giết người này và người này hành động
      if (
        stalker &&
        stalker.role.killedPerson &&
        stalker.role.killedPerson === player.userId &&
        this.isActivity(player.role.id)
      ) {
        const user = await this.fetchUser(stalker.userId);
        if (user) {
          await user.send(
            `**Thông báo:** Vì **${player.name}** đã hành động nên bạn không thể giết được người này.`
          );
        }
      }
      // Trường hợp stalker chọn giết người này và người này không hành động
      if (
        stalker &&
        stalker.role.killedPerson &&
        stalker.role.killedPerson === player.userId &&
        !this.isActivity(player.role.id)
      ) {
        const user = await this.fetchUser(stalker.userId);
        if (user) {
          await user.send(
            `**Thông báo:** Vì **${player.name}** không hành động nên bạn đã giết được người này.`
          );
          this.gameState.log.push(`Stalker đã giết **${player.name}**`);
          sureDieInTheNight.add(player.userId);
          killedPlayers.delete(player.userId);
        }
      }
    }
    const guard = this.players.find((p) => p.role.id === WEREROLE.BODYGUARD);
    const giaLang = this.players.find((p) => p.role.id === WEREROLE.ELDER);
    for (const killedId of killedPlayers) {
      // người bị chó cắn
      if (!guard || !guard.alive) break;

      if (
        killedId === guard.role.protectedPerson ||
        killedId === guard.userId
      ) {
        const hp = (guard.role.hp -= 1);
        this.gameState.log.push(
          `Bảo vệ đã bảo vệ **${this.players.find((p) => p.userId === killedId).name}**, anh ấy còn ${hp} máu`
        );
        // được bảo vệ đỡ đạn
        killedPlayers.delete(killedId);
        if (hp <= 0) {
          // sureDieInTheNight.add(guard.userId);
          killedPlayers.add(guard.userId);
          this.gameState.log.push(`Bảo vệ đã chết do chịu 2 lần cắn của sói`);
        }

        if (giaLangBiTanCong && giaLang && giaLang.userId === killedId) {
          giaLang.role.hp += 1;
          giaLangBiTanCong = false;
        }
      }
    }
    if (witch && witch.role.healedPerson) {
      const saved = this.players.find(
        (p) => p.userId === witch.role.healedPerson
      );
      // chưa được ai bảo vệ trước đó
      this.gameState.log.push(`Phù thuỷ đã chọn cứu **${saved.name}**`);
      if (
        saved &&
        killedPlayers.has(saved.userId) &&
        killedPlayers.has(witch.role.healedPerson)
      ) {
        this.gameState.log.push(`Phù thuỷ cứu được **${saved.name}**`);

        witch.role.healCount -= 1;
        killedPlayers.delete(saved.userId);
      }
    }

    const medium = this.players.find((p) => p.role.id === WEREROLE.MEDIUM);
    if (medium && medium.role.revivedPerson) {
      const saved = this.players.find(
        (p) => p.userId === medium.role.revivedPerson && !p.alive
      );
      if (saved) {
        this.gameState.log.push(
          `Thầy đồng đã hồi sinh thành công **${saved.name}**`
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
        killed.role.id === WEREROLE.CURSED &&
        mostVotedUserId &&
        killed.userId === mostVotedUserId
      ) {
        this.gameState.log.push(`Bán sói **${killed.name}** đã biến thành sói`);
        const user = await this.fetchUser(killed.userId);
        if (user) {
          await user.send(`### Bạn đã bị sói cắn và biến thành sói`);
        }

        killed.role = new Werewolf();
        killed.alive = true;
        killedPlayers.delete(killedId);
      } else {
        killed.role = new Dead(killed.role.faction, killed.role.id);
        killed.alive = false;
      }
    }
    for (const killedId of sureDieInTheNight) {
      const killed = this.players.find((p) => p.userId === killedId);
      killed.role = new Dead(killed.role.faction, killed.role.id);
      killed.alive = false;
    }

    const allDeadTonight = new Set([...killedPlayers, ...sureDieInTheNight]);

    for (const killedId of Array.from(allDeadTonight)) {
      const maid = this.players.find(
        (p) => p.role.id === WEREROLE.MAID && p.role.master === killedId
      );
      if (maid) {
        const deadMaster = this.players.find((p) => p.userId === killedId);
        const oldRole = maid.role.name;

        maid.role = assignRolesGame(
          deadMaster.role?.originalRoleId ?? deadMaster.role.id
        );
        maidNewRole = {
          maidName: maid.name,
          oldRole: oldRole,
          newRole: maid.role.name,
        };

        const user = await this.fetchUser(maid.userId);
        if (user) {
          await user.send(
            `### 👑 Chủ của bạn đã chết, bạn đã trở thành **${maid.role.name}**`
          );
          this.gameState.log.push(
            `### 👒 Hầu gái đã lên thay vai trò **${maidNewRole.newRole}** của chủ vì chủ đã chết.`
          );
        }
      }
    }

    // cần fix role id ELder vì Elder đã chết (new Dead())
    if (giaLang && !giaLang.alive) {
      const dmVillagerPromise = this.players
        .filter(
          (p) =>
            (p.alive && p.role.faction === 1) || p.role.id === WEREROLE.ELDER
        )
        .map(async (player) => {
          const user = await this.fetchUser(player.userId);
          if (!user) return;
          await user.send(
            `### 👴 Già làng đã chết, tất cả những người thuộc phe dân làng đều sẽ bị mất chức năng.`
          );
          this.gameState.log.push(
            `👴 Già làng đã chết, tất cả những người thuộc phe dân làng đều sẽ bị mất chức năng.`
          );
          player.role = new Villager();
        });
      await Promise.allSettled(dmVillagerPromise);
    }

    if (allDeadTonight.size !== 0) {
      this.gameState.log.push(
        `${Array.from(allDeadTonight)
          .map((id) => {
            const player = this.players.find((p) => p.userId === id);
            return `**${player.name}**`;
          })
          .join(', ')} đã thiệt mạng\n`
      );
    }

    if (allDeadTonight.size === 0) {
      this.gameState.log.push(`Không có ai thiệt mạng\n`);
    }

    const dmPromises = this.players.map(async (player) => {
      const user = await this.fetchUser(player.userId);
      if (!user) return;

      try {
        if (allDeadTonight.size === 0) {
          await user.send('🌙 Đêm nay không ai thiệt mạng.\n');
        } else {
          const killedPlayersList = Array.from(allDeadTonight)
            .map((id) => {
              const player = this.players.find((p) => p.userId === id);
              return `**${player.name}**`;
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
            `### 👒 Hầu gái đã lên thay vai trò **${maidNewRole.newRole}** của chủ vì chủ đã chết.\n`
          );
        }

        if (revivedPlayers.size > 0) {
          const revivedPlayersList = Array.from(revivedPlayers)
            .map((id) => {
              const player = this.players.find((p) => p.userId === id);
              return `**${player.name}**`;
            })
            .join(', ');
          await user.send(
            `### 🔮 ${revivedPlayersList} đã được hồi sinh bởi Thầy Đồng.\n`
          );

          if (revivedPlayers.has(player.userId)) {
            await user.send('### ✨ Bạn đã được Thầy Đồng hồi sinh!');
          }
        }
      } catch (err) {
        console.error(`Không thể gửi tin nhắn cho ${player.userId}`, err);
      }
    });

    await Promise.allSettled(dmPromises);

    for (const player of this.players) {
      player.role.resetDay();
    }

    console.log(this.gameState.log);
  }

  async dayPhase() {
    if (this.status === 'ended') return;
    this.gameState.phase = 'day';
    this.emit('day', this.guildId, this.players, this.gameState);

    const isFirstDay = this.gameState.nightCount === 1;
    const dmPromises = this.players.map(async (player) => {
      const user = await this.fetchUser(player.userId);
      if (!user) return;
      await user.send(
        `# ☀️ Ban ngày đã đến. \nHãy thảo luận và bỏ phiếu để loại trừ người khả nghi nhất. Bạn có ${this.settings.discussTime} giây để thảo luận.`
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
        !isFirstDay &&
        player.role.bullets > 0
      ) {
        const shootButton = new ButtonBuilder()
          .setCustomId(`gunner_shoot_${player.userId}`)
          .setLabel('🔫 Bắn người')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(shootButton);

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

    await Promise.allSettled(dmPromises);

    setTimeout(
      async () => {
        const notifyPlayers = this.players.map(async (player) => {
          try {
            const user = await this.fetchUser(player.userId);
            await user.send(`### ⚠️ Thông báo: còn **10** giây để thảo luận!`);
          } catch (err) {
            console.error(`Không thể gửi tin nhắn cho ${player.userId}`, err);
          }
        });
        await Promise.allSettled(notifyPlayers);
      },
      this.settings.discussTime * 1000 - 10000
    );

    await new Promise((resolve) =>
      setTimeout(resolve, this.settings.discussTime * 1000)
    );
  }

  async votePhase() {
    if (this.status === 'ended') return;
    this.gameState.phase = 'voting';
    this.emit('vote', this.guildId, this.players, this.gameState);

    const dmPromises = this.players.map(async (player) => {
      const user = await this.fetchUser(player.userId);
      if (!user) return;
      await user.send(
        `🗳️ Thời gian bỏ phiếu đã đến. Người có số phiếu cao nhất và có ít nhất 2 phiếu sẽ bị treo cổ. Hãy chọn người bạn muốn loại trừ trong ${this.settings.voteTime} giây tới.\n💡 Nhập số 0 hoặc 36 để bỏ qua vote.`
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
      const message = await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });
      this.voteMessages.set(player.userId, message);
    });

    await Promise.allSettled(dmPromises);

    const timeoutPromise = new Promise((resolve) =>
      setTimeout(resolve, this.settings.voteTime * 1000)
    );

    const voteCompletePromise = new Promise((resolve) => {
      this.once('voteComplete', resolve);
    });

    const notificationPromise = new Promise((resolve) => {
      setTimeout(
        async () => {
          const notifyPlayers = this.players.map(async (player) => {
            try {
              const user = await this.fetchUser(player.userId);
              await user.send(`### ⚠️ Thông báo: còn **10** giây để vote!`);
            } catch (err) {
              console.error(`Không thể gửi tin nhắn cho ${player.userId}`, err);
            }
          });
          await Promise.allSettled(notifyPlayers);
          resolve();
        },
        this.settings.voteTime * 1000 - 10000
      );
    });

    await Promise.race([timeoutPromise, voteCompletePromise]);

    for (const [playerId, message] of this.voteMessages) {
      try {
        if (message.components && message.components.length > 0) {
          const row = ActionRowBuilder.from(message.components[0]);
          row.components[0].setDisabled(true).setLabel('🗳️ Vote (Hết hạn)');
          await message.edit({ components: [row] });
        }
      } catch (err) {
        console.error(`Không thể disable button cho ${playerId}:`, err);
      }
    }
    this.voteMessages.clear();

    const hangedPlayer = this.processVote();

    if (!hangedPlayer) {
      this.gameState.log.push('Không ai bị treo cổ do không đủ phiếu bầu\n');
      const noHangPromises = this.players.map(async (player) => {
        const user = await this.fetchUser(player.userId);
        if (!user) return;
        await user.send(
          '🎭 Không đủ số phiếu hoặc có nhiều người cùng số phiếu cao nhất, không ai bị treo cổ trong ngày hôm nay.'
        );
      });
      await Promise.allSettled(noHangPromises);
    } else {
      this.gameState.log.push(
        `**${hangedPlayer.name}** đã bị dân làng treo cổ`
      );
      if (hangedPlayer.role.id === WEREROLE.FOOL) {
        this.gameState.log.push(
          `**${hangedPlayer.name}** là Thằng Ngố - Thằng Ngố thắng!`
        );
        this.status = 'ended';
        const foolMessages = this.players.map(async (player) => {
          const user = await this.fetchUser(player.userId);
          if (!user) return;
          await user.send(
            `🎭 **${hangedPlayer.name}** là **Ngố** và đã bị treo cổ. \n🎉 **Ngố** thắng !!.`
          );
          const roleRevealEmbed = this.revealRoles();
          await user.send({ embeds: [roleRevealEmbed] });
        });
        await Promise.allSettled(foolMessages);
        return;
      }

      const maid = this.players.find(
        (p) =>
          p.role.id === WEREROLE.MAID && p.role.master === hangedPlayer.userId
      );
      let maidNewRole = null;
      if (maid) {
        maid.role = assignRolesGame(
          hangedPlayer.role?.originalRoleId ?? hangedPlayer.role.id
        );
        maidNewRole = maid.role.name;

        const maidUser = await this.fetchUser(maid.userId);
        if (maidUser) {
          await maidUser.send(
            `### 👑 Chủ của bạn đã bị treo cổ, bạn đã trở thành **${maid.role.name}**`
          );
        }

        this.gameState.log.push(
          `### 👒 Hầu gái đã lên thay vai trò **${maid.role.name}** của chủ vì chủ đã bị treo cổ.`
        );
      }

      hangedPlayer.alive = false;
      hangedPlayer.role = new Dead(
        hangedPlayer.role.faction,
        hangedPlayer.role.id
      );

      const hangMessages = this.players.map(async (player) => {
        const user = await this.fetchUser(player.userId);
        if (!user) return;
        await user.send(
          `🎭 **${hangedPlayer.name}** đã bị dân làng treo cổ vì có số phiếu cao nhất.`
        );
        if (hangedPlayer.userId === player.userId) {
          await user.send('💀 Bạn đã bị dân làng treo cổ.');
        }
        if (maidNewRole) {
          await user.send(
            `### 👒 Hầu gái đã lên thay vai trò **${maidNewRole}** của chủ vì chủ đã bị treo cổ.\n`
          );
        }
      });

      await Promise.allSettled(hangMessages);
    }

    const normalWolvesAlive = this.players.filter(
      (p) => p.alive && p.role.faction === 0 && p.role.id === WEREROLE.WEREWOLF
    );
    const otherWolvesAlive = this.players.filter(
      (p) => p.alive && p.role.faction === 0 && p.role.id !== WEREROLE.WEREWOLF
    );

    if (normalWolvesAlive.length === 0 && otherWolvesAlive.length > 0) {
      const wolfTransformPromises = otherWolvesAlive.map(async (wolf) => {
        wolf.role = new Werewolf();
        const user = await this.fetchUser(wolf.userId);
        if (user) {
          return user.send(
            '### 🐺 Vì không còn Sói thường nào sống sót, bạn đã biến thành Sói thường!'
          );
        }
      });

      await Promise.allSettled(wolfTransformPromises);

      this.gameState.log.push(
        `🐺 **${otherWolvesAlive.length}** Sói chức năng đã biến thành **Sói thường** vì không còn Sói thường nào sống sót.`
      );
    }

    // Tìm già làng bị chết (bị gắn role dead nên dùng originalRoleId)
    const giaLang = this.players.find(
      (p) =>
        !p.alive &&
        p.role.id === WEREROLE.DEAD &&
        p.role.originalRoleId === WEREROLE.ELDER
    );
    if (giaLang && !giaLang.alive) {
      const dmVillagerPromise = this.players
        .filter(
          (p) =>
            (p.alive && p.role.faction === 1) || p.role.id === WEREROLE.ELDER
        )
        .map(async (player) => {
          const user = await this.fetchUser(player.userId);
          if (!user) return;
          await user.send(
            `### 👴 Già làng đã chết, tất cả những người thuộc phe dân làng đều sẽ bị mất chức năng.`
          );
          this.gameState.log.push(
            `👴 Già làng đã chết, tất cả những người thuộc phe dân làng đều sẽ bị mất chức năng.`
          );
          player.role = new Villager();
        });
      await Promise.allSettled(dmVillagerPromise);
    }

    // Reset vote
    for (const player of this.players) {
      player.role.voteHanged = null;
    }

    await this.checkEndGame();
  }

  /**
   *
   * @returns {EmbedBuilder}
   */
  revealRoles() {
    const roleRevealEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('🎭 Tiết Lộ Vai Trò')
      .setDescription('```Danh sách vai trò của tất cả người chơi:```')
      .addFields(
        this.players.map((player) => {
          let nameRole = player.role.name;
          if (player.role.id === WEREROLE.DEAD) {
            nameRole = rolesData[player.role.originalRoleId].title;
            if (player.role.originalRoleId === WEREROLE.CURSED) {
              nameRole = `${nameRole} (Bán Sói)`;
            }
          }
          let roleEmoji = '👤';
          switch (player.role.originalRoleId || player.role.id) {
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
          }
          return {
            name: `${roleEmoji} ${nameRole}`,
            value: `**${player.name}**${!player.alive ? ' (💀 Đã chết)' : ''}`,
            inline: true,
          };
        })
      )
      .setTimestamp()
      .setFooter({ text: 'Hẹ hẹ hẹ' });
    return roleRevealEmbed;
  }

  processVote() {
    const totalVotes = this.players.reduce((acc, player) => {
      if (
        player.alive &&
        player.role.voteHanged &&
        player.role.voteHanged !== 'skip'
      ) {
        acc[player.role.voteHanged] = (acc[player.role.voteHanged] || 0) + 1;
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

    if (candidates.length === 1 && maxVotes >= 2) {
      const hangedPlayer = this.players.find((p) => p.userId === candidates[0]);
      if (hangedPlayer && hangedPlayer.alive) {
        hangedPlayer.alive = false;
        return hangedPlayer;
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
          winMessage = `🐺 **Ma Sói thắng!** Họ đã tiêu diệt tất cả dân làng.`;
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
      const endGameMessages = this.players.map(async (player) => {
        const user = await this.fetchUser(player.userId);
        if (!user) return;

        return Promise.all([
          user.send(winMessage),
          user.send({ embeds: [roleRevealEmbed] }),
        ]);
      });

      await Promise.allSettled(endGameMessages);

      console.log(this.gameState.log);
      this.status = 'ended';
      return true;
    }

    return false;
  }

  async gameLoop() {
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
  }

  /**
   *
   * @returns {Object|null}
   * @property {string} winner -  ('werewolf', 'village', 'solo').
   * @property {number} faction -  (0: sói, 1: dân, 2: solo)
   */
  checkVictory() {
    const alivePlayers = this.players.filter((p) => p.alive);
    const aliveWolves = alivePlayers.filter((p) => p.role.faction === 0);
    const aliveVillagers = alivePlayers.filter((p) => p.role.faction === 1);
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
  isActivity(role) {
    const player = this.players.find((p) => p.role.id === role);
    if (!player) return false;
    if (player.role.id === WEREROLE.WEREWOLF && player.role.voteBite)
      return true;
    if (player.role.id === WEREROLE.BODYGUARD && player.role.protectedPerson)
      return true;
    if (player.role.id === WEREROLE.SEER && player.role.viewCount <= 0)
      return true;
    if (
      player.role.id === WEREROLE.DETECTIVE &&
      player.role.investigatedPairs.length > 0
    )
      return true;
    if (player.role.id === WEREROLE.WITCH && player.role.poisonedPerson)
      return true;
    if (player.role.id === WEREROLE.WITCH && player.role.healedPerson)
      return true;
    if (player.role.id === WEREROLE.MEDIUM && player.role.revivedPerson)
      return true;
    if (player.role.id === WEREROLE.WOLFSEER && player.role.seerCount <= 0)
      return true;
    if (player.role.id === WEREROLE.ALPHA_WEREWOLF && player.role.maskWolf)
      return true;
    if (
      player.role.id === WEREROLE.FOX_SPIRIT &&
      player.role.threeViewed.length > 0
    )
      return true;

    return false;
  }

  async updateAllPlayerList() {
    const dmPromises = this.players.map(async (player) => {
      const user = await this.fetchUser(player.userId);
      if (!user) return;

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

    await Promise.allSettled(dmPromises);
  }
}

module.exports = {
  gameRooms: new Map(),
  GameRoom,
  Player,
};
