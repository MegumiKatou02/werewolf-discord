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

    if (this.guildId && serverSettings.get(this.guildId)) {
      this.settings = serverSettings.get(this.guildId);
    }

    const roles = this.assignRoles(this.players.length);
    const fakeRoles = [0, 1, 8, 7];

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
          `${rolesData[role.id].eName.toLowerCase()}.png`,
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
        const message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
        wolfMessages.push(message);
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
        await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
      } else if (player.role.id === WEREROLE.SEER) {
        // Tiên Tri
        const viewButton = new ButtonBuilder()
          .setCustomId(`view_target_seer_${player.userId}`)
          .setLabel('🔍 Xem vai trò')
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
        await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
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
        const message = await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });

        this.witchMessages.set(player.userId, message);
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
        await user.send({
          embeds: [embed],
          files: [attachment],
          components: [row],
        });
      } else if (player.role.id === WEREROLE.DEAD) {
        await user.send(
          '💀 Bạn đã bị chết, hãy trò chuyện với hội người âm của bạn.'
        );
        await user.send({ embeds: [embed], files: [attachment] });
      } else if (player.role.id === WEREROLE.FOOL) {
        await user.send(
          '⚜️ Bạn là thằng ngố, nhiệm vụ của bạn là lừa những người khác vote bạn để chiến thắng.'
        );
        await user.send({ embeds: [embed], files: [attachment] });
      } else {
        await user.send('🌙 Một đêm yên tĩnh trôi qua. Bạn hãy chờ đến sáng.');
        await user.send({ embeds: [embed], files: [attachment] });
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
          if (player.role.id === WEREROLE.WITCH) {
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
                `🌙 Sói đã chọn giết người chơi **${this.players.find((p) => p.userId === mostVotedUserId).name}**.`
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
    this.gameState.log.push(`Đêm thứ ${this.gameState.nightCount}`);

    const mostVotedUserId = this.totalVotedWolvesSolve();
    let killedPlayers = new Set(); // vẫn có thể cứu được
    let sureDieInTheNight = new Set(); // 100% chết ngay trong đêm đó (không thể cứu hay bảo vệ)
    // let savedPlayers = new Set();
    let revivedPlayers = new Set();

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

    const guard = this.players.find((p) => p.role.id === WEREROLE.BODYGUARD);
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
        if (hp <= 0) {
          sureDieInTheNight.add(guard.userId);
          this.gameState.log.push(`Bảo vệ đã chết do chịu 2 lần cắn của sói`);
        }
        killedPlayers.delete(killedId);
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

    if (allDeadTonight.length !== 0) {
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

  /**
   *
   * @returns {Promise<void>}
   * Đoạn này xin được phép comment nhiều vì sợ đọc lại không hiểu <(")
   */
  async solvePhase() {
    const mostVotedUserId = this.totalVotedWolvesSolve();
    let killedPlayers = new Set();
    let savedPlayers = new Set();
    let revivedPlayers = new Set();

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
          player.alive = false;
          killedPlayers.add(mostVotedUserId);
        }
      }

      // Kiểm tra phù thủy có đầu độc ai không
      if (player.role.id === 6 && player.role.poisonedPerson) {
        player.role.poisonCount -= 1;
        const killed = this.players.find(
          (p) => p.userId === player.role.poisonedPerson
        );
        killed.alive = false;
        killedPlayers.add(player.role.poisonedPerson);
      }

      // Kiểm tra thầy đồng có hồi sinh ai không
      if (player.role.id === 8 && player.role.revivedPerson) {
        console.log('Người được cứu', player.role.revivedPerson);
        const revivedPlayer = this.players.find(
          (p) => p.userId === player.role.revivedPerson
        );
        if (
          revivedPlayer &&
          !revivedPlayer.alive &&
          revivedPlayer.role.faction === 1
        ) {
          console.log('true');

          revivedPlayer.alive = true;
          revivedPlayers.add(revivedPlayer.userId);
          revivedPlayer.role = assignRolesGame(revivedPlayer.role.id);
          player.role.reviveCount -= 1;
        } else {
          console.log('false');
        }
      }
    }

    for (const revived of revivedPlayers) {
      killedPlayers.delete(revived);
    }

    for (const player of this.players.filter((p) => p.alive === false)) {
      player.role = new Dead(player.role.factio, player.role.id);
    }

    for (const player of this.players) {
      const user = await this.fetchUser(player.userId);
      if (!user) continue;

      if (killedPlayers.size === 0) {
        await user.send('🌙 Đêm nay không ai thiệt mạng.\n');
      } else {
        const killedPlayersList = Array.from(killedPlayers)
          .map((id) => {
            const player = this.players.find((p) => p.userId === id);
            return `**${player.name}**`;
          })
          .join(', ');
        await user.send(`🌙 Đêm nay, ${killedPlayersList} đã thiệt mạng.\n`);

        if (killedPlayers.has(player.userId)) {
          await user.send('💀 Bạn đã bị giết trong đêm nay.');
          player.alive = false;
        }
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
    }

    for (const player of this.players) {
      player.role.resetDay();
    }
  }

  async dayPhase() {
    this.gameState.phase = 'day';
    this.emit('day', this.guildId, this.players, this.gameState);

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

      await user.send({
        embeds: [embed],
        files: [attachment],
      });
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
    this.gameState.phase = 'voting';
    this.emit('vote', this.guildId, this.players, this.gameState);

    const dmPromises = this.players.map(async (player) => {
      const user = await this.fetchUser(player.userId);
      if (!user) return;
      await user.send(
        `🗳️ Thời gian bỏ phiếu đã đến. Người có số phiếu cao nhất và có ít nhất 2 phiếu sẽ bị treo cổ. Hãy chọn người bạn muốn loại trừ trong ${this.settings.voteTime} giây tới.`
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
    });

    await Promise.allSettled(dmPromises);

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
      },
      this.settings.voteTime * 1000 - 10000
    );

    await new Promise((resolve) =>
      setTimeout(resolve, this.settings.voteTime * 1000)
    );

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
          const roleRevealEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🎭 Tiết Lộ Vai Trò')
            .setDescription('```Danh sách vai trò của tất cả người chơi:```')
            .addFields(
              this.players.map((player) => {
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
                }
                return {
                  name: `${roleEmoji} ${player.role.name}`,
                  value: `**${player.name}**${!player.alive ? ' (�� Đã chết)' : ''}`,
                  inline: true,
                };
              })
            )
            .setTimestamp()
            .setFooter({ text: 'Hẹ hẹ hẹ' });
          await user.send({ embeds: [roleRevealEmbed] });
        });
        await Promise.allSettled(foolMessages);
        return; //
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
      });

      await Promise.allSettled(hangMessages);
    }

    // Reset vote
    for (const player of this.players) {
      player.role.voteHanged = null;
    }

    await this.checkEndGame();
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

      const roleRevealEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🎭 Tiết Lộ Vai Trò')
        .setDescription('```Danh sách vai trò của tất cả người chơi:```')
        .addFields(
          this.players.map((player) => {
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
            }
            return {
              name: `${roleEmoji} ${player.role.name}`,
              value: `**${player.name}**${!player.alive ? ' (💀 Đã chết)' : ''}`,
              inline: true,
            };
          })
        )
        .setTimestamp()
        .setFooter({ text: 'Hẹ hẹ hẹ' });

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
      return true;
    }

    return false;
  }

  async gameLoop() {
    while (this.status === 'starting') {
      await this.nightPhase();
      await this.solvePhase2();
      if (await this.checkEndGame()) {
        break;
      }
      await this.dayPhase();
      await this.votePhase();
    }
  }

  /**
   *
   * @returns {Player|null}
   */
  processVote() {
    const totalVotes = this.players.reduce((acc, player) => {
      if (player.alive && player.role.voteHanged) {
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
}

module.exports = {
  gameRooms: new Map(),
  GameRoom,
  Player,
};
