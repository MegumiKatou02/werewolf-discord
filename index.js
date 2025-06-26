const {
  Client,
  GatewayIntentBits,
  Collection,
  ChannelType,
  Partials,
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActivityType,
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { RoleResponse } = require('./utils/response');
const { FactionRole } = require('./types/faction');
const { store } = require('./core/store');
const { gameRooms } = require('./core/room');
const { WEREROLE } = require('./utils/role');
const Dead = require('./types/roles/Dead');
const ServerSettings = require('./models/ServerSettings');
const connectDB = require('./config/database');
const commandHandler = require('./src/client/handlers/commandHandler');
const defaultRoles = require('./src/client/events/interactions/defaultRoles');
const customizeRolesJson = require('./src/client/events/interactions/customizeRolesJson');
const wolfInteraction = require('./src/client/events/interactions/wolfInteraction');
const wolfSeerInteraction = require('./src/client/events/interactions/wolfSeerInteraction');
const alphawerewolfInteraction = require('./src/client/events/interactions/alphawerewolfInteraction');
const bodyguardInteraction = require('./src/client/events/interactions/bodyguardInteraction');
const seerInteraction = require('./src/client/events/interactions/seerInteraction');
require('dotenv').config();

connectDB();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.User,
  ],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

client.once('ready', () => {
  console.log('Bot online với tên', client.user.tag);
  client.user.setPresence({
    activities: [{ name: '/huongdan', type: ActivityType.Watching }],
    status: 'dnd',
  });
});

client.on('messageCreate', async (message) => {
  commandHandler(message);

  if (message.channel.type === ChannelType.DM) {
    console.log(`Tin nhắn DM từ ${message.author.tag}: ${message.content}`);

    const gameRoom = Array.from(gameRooms.values()).find(
      (room) =>
        room.status === 'starting' &&
        room.players.some((p) => p.userId === message.author.id)
    );

    if (!gameRoom) return;

    const sender = gameRoom.players.find((p) => p.userId === message.author.id);
    if (!sender) return;

    if (gameRoom.gameState.phase === 'night') {
      // Gửi tin nhắn cho các sói khác
      if (sender.role.id === WEREROLE.WOLFSEER) {
        try {
          const user = await client.users.fetch(sender.userId);
          await user.send(`_⚠️ Những sói khác sẽ không thấy bạn nhắn gì_`);
        } catch (err) {
          console.error('Không gửi được tin nhắn cho Sói khác', err);
        }
      }
      /**
       * Nếu là sói và không phải sói tiên tri thì có thể gửi tin nhắn cho các sói khác
       * (Sói còn sống mới gửi tin nhắn được)
       */
      if (
        sender.role.faction === 0 &&
        sender.role.id !== WEREROLE.WOLFSEER &&
        sender.alive
      ) {
        // lọc ra những sói khác (còn sống)
        const wolves = gameRoom.players.filter(
          (p) => p.role.faction === 0 && p.alive && p.userId !== sender.userId
        );
        const notifyPromises = wolves.map(async (wolf) => {
          try {
            const user = await client.users.fetch(wolf.userId);
            await user.send(`🐺 **${sender.name}**: ${message.content}`);
          } catch (err) {
            console.error('Không gửi được tin nhắn cho Sói khác', err);
          }
        });
        await Promise.allSettled(notifyPromises);
      }

      if (sender.role.id === WEREROLE.MEDIUM || sender.alive === false) {
        // Gửi tin nhắn cho hội người âm
        const playersDead = gameRoom.players.filter((p) => {
          return (
            p.userId !== sender.userId &&
            (p.alive === false || p.role.id === WEREROLE.MEDIUM)
          );
        });

        const notifyPromises = playersDead.map(async (player) => {
          try {
            const user = await client.users.fetch(player.userId);
            if (sender.role.id === WEREROLE.MEDIUM && sender.alive) {
              await user.send(`_🔮 **Thầy Đồng**: ${message.content}_`);
            } else {
              await user.send(`_💀 **${sender.name}**: ${message.content}_`);
            }
          } catch (err) {
            console.error('Không gửi được tin nhắn cho người chơi', err);
          }
        });
        await Promise.allSettled(notifyPromises);
      }
    }
    if (
      gameRoom.gameState.phase === 'day' ||
      gameRoom.gameState.phase === 'voting'
    ) {
      // Gửi tin nhắn cho tất cả người chơi
      const playersInGame = gameRoom.players.filter(
        (p) => p.userId !== sender.userId
      );

      const notifyPromises = playersInGame.map(async (player) => {
        try {
          const user = await client.users.fetch(player.userId);
          if (!sender.alive) {
            if (!player.alive) {
              await user.send(`_💀 **${sender.name}**: ${message.content}_`);
            }
          } else {
            await user.send(`🗣️ **${sender.name}**: ${message.content}`);
          }
        } catch (err) {
          console.error('Không gửi được tin nhắn cho người chơi', err);
        }
      });
      await Promise.allSettled(notifyPromises);
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    const guildId = interaction.guild?.id || store.get(interaction.user.id);

    if (!guildId) {
      return interaction.reply({
        content: 'Không tìm thấy guild liên kết với người dùng này.',
        ephemeral: true,
      });
    }

    const gameRoom = gameRooms.get(guildId);

    //
    await defaultRoles.isButton(interaction, gameRooms);

    await customizeRolesJson.isButton(interaction);

    await wolfInteraction.isButton(interaction);
    
    await wolfSeerInteraction.isButton(interaction);

    await alphawerewolfInteraction.isButton(interaction);

    await bodyguardInteraction.isButton(interaction);

    await seerInteraction.isButton(interaction);
    if (interaction.customId.startsWith('investigate_target_detective_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_investigate_detective_${playerId}`)
        .setTitle('Điều tra người chơi');

      const input1 = new TextInputBuilder()
        .setCustomId('investigate_index_1')
        .setLabel('Nhập số thứ tự người chơi 1 (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const input2 = new TextInputBuilder()
        .setCustomId('investigate_index_2')
        .setLabel('Nhập số thứ tự người chơi 2 (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 4')
        .setRequired(true);

      const row1 = new ActionRowBuilder().addComponents(input1);
      const row2 = new ActionRowBuilder().addComponents(input2);
      modal.addComponents(row1, row2);

      await interaction.showModal(modal);
    }
    if (interaction.customId.startsWith('poison_target_witch_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }
      try {
        const witch = gameRoom.players.find(
          (p) => p.role.id === WEREROLE.WITCH
        );

        if (witch && witch.role.healedPerson) {
          return interaction.reply({
            content: 'Bạn không thể dùng 2 bình trong 1 đêm.',
            ephemeral: true,
          });
        }
      } catch (err) {
        console.error('❌ Lỗi khi fetch user:', err);
        return interaction.reply({
          content: 'Không tìm thấy người chơi.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_poison_witch_${playerId}`)
        .setTitle('Chọn người chơi để dùng thuốc');

      const input = new TextInputBuilder()
        .setCustomId('poison_index_witch')
        .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      try {
        await interaction.showModal(modal);
      } catch (err) {
        console.error('❌ Lỗi khi showModal:', err);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Tương tác đã hết hạn hoặc xảy ra lỗi. Vui lòng thử lại.',
            ephemeral: true,
          });
        }
      }
    }
    if (interaction.customId.startsWith('heal_target_witch_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      try {
        const witch = gameRoom.players.find(
          (p) => p.role.id === WEREROLE.WITCH
        );

        if (witch && witch.role.poisonedPerson) {
          return interaction.reply({
            content: 'Bạn không thể dùng 2 bình trong 1 đêm.',
            ephemeral: true,
          });
        }
      } catch (err) {
        console.error('❌ Lỗi khi fetch user:', err);
        return interaction.reply({
          content: 'Không tìm thấy người chơi.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_heal_witch_${playerId}`)
        .setTitle('Chọn người chơi để cứu');

      const input = new TextInputBuilder()
        .setCustomId('heal_index_witch')
        .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      try {
        await interaction.showModal(modal);
      } catch (err) {
        console.error('❌ Lỗi khi showModal:', err);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Tương tác đã hết hạn hoặc xảy ra lỗi. Vui lòng thử lại.',
            ephemeral: true,
          });
        }
      }
    }
    if (interaction.customId.startsWith('vote_hanged_')) {
      const playerId = interaction.customId.split('_')[2];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_vote_hanged_${playerId}`)
        .setTitle('Vote người chơi để treo cổ');

      const input = new TextInputBuilder()
        .setCustomId('vote_index_hanged')
        .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      try {
        await interaction.showModal(modal);
      } catch (err) {
        console.error('❌ Lỗi khi showModal:', err);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Tương tác đã hết hạn hoặc xảy ra lỗi. Vui lòng thử lại.',
            ephemeral: true,
          });
        }
      }
    }
    if (interaction.customId.startsWith('revive_target_medium_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_revive_medium_${playerId}`)
        .setTitle('Hồi sinh người chơi');

      const input = new TextInputBuilder()
        .setCustomId('revive_index_medium')
        .setLabel('Số thứ tự người chết (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      try {
        await interaction.showModal(modal);
      } catch (err) {
        console.error('❌ Lỗi khi showModal:', err);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Tương tác đã hết hạn hoặc xảy ra lỗi. Vui lòng thử lại.',
            ephemeral: true,
          });
        }
      }
    }
    if (interaction.customId.startsWith('choose_master_maid_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_choose_master_maid_${playerId}`)
        .setTitle('Chọn chủ');

      const input = new TextInputBuilder()
        .setCustomId('master_index_maid')
        .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      try {
        await interaction.showModal(modal);
      } catch (err) {
        console.error('❌ Lỗi khi showModal:', err);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Tương tác đã hết hạn hoặc xảy ra lỗi. Vui lòng thử lại.',
            ephemeral: true,
          });
        }
      }
    }
    if (interaction.customId.startsWith('view_target_foxspirit_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      try {
        const foxSpirit = gameRoom.players.find(
          (p) => p.role.id === WEREROLE.FOXSPIRIT
        );

        if (!foxSpirit.role.isHaveSkill) {
          return interaction.reply({
            content: 'Bạn đã bị mất chức năng.',
            ephemeral: true,
          });
        }
      } catch (err) {
        console.error('❌ Lỗi khi fetch user:', err);
        return interaction.reply({
          content: 'Không tìm thấy người chơi.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_view_foxspirit_${playerId}`)
        .setTitle('Chọn 3 người chơi');

      const input1 = new TextInputBuilder()
        .setCustomId('view_index_1')
        .setLabel('Nhập số thứ tự người chơi 1 (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const input2 = new TextInputBuilder()
        .setCustomId('view_index_2')
        .setLabel('Nhập số thứ tự người chơi 2 (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 4')
        .setRequired(true);

      const input3 = new TextInputBuilder()
        .setCustomId('view_index_3')
        .setLabel('Nhập số thứ tự người chơi 3 (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 5')
        .setRequired(true);

      const row1 = new ActionRowBuilder().addComponents(input1);
      const row2 = new ActionRowBuilder().addComponents(input2);
      const row3 = new ActionRowBuilder().addComponents(input3);
      modal.addComponents(row1, row2, row3);

      try {
        await interaction.showModal(modal);
      } catch (err) {
        console.error('❌ Lỗi khi showModal:', err);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Tương tác đã hết hạn hoặc xảy ra lỗi. Vui lòng thử lại.',
            ephemeral: true,
          });
        }
      }
    }
    if (interaction.customId.startsWith('stalk_target_stalker_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      try {
        const stalker = gameRoom.players.find(
          (p) => p.role.id === WEREROLE.STALKER
        );

        if (stalker && stalker.role.killedPerson) {
          return interaction.reply({
            content: 'Bạn đã chọn ám sát người chơi khác rồi.',
            ephemeral: true,
          });
        }
      } catch (err) {
        console.error('❌ Lỗi khi fetch user:', err);
        return interaction.reply({
          content: 'Không tìm thấy người chơi.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_stalk_stalker_${playerId}`)
        .setTitle('Chọn người chơi để theo dõi');

      const input = new TextInputBuilder()
        .setCustomId('stalk_index_stalker')
        .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      try {
        await interaction.showModal(modal);
      } catch (err) {
        console.error('❌ Lỗi khi showModal:', err);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Tương tác đã hết hạn hoặc xảy ra lỗi. Vui lòng thử lại.',
            ephemeral: true,
          });
        }
      }
    }
    if (interaction.customId.startsWith('kill_target_stalker_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      try {
        const stalker = gameRoom.players.find(
          (p) => p.role.id === WEREROLE.STALKER
        );

        if (stalker && stalker.role.stalkedPerson) {
          return interaction.reply({
            content: 'Bạn đã theo dõi người chơi khác rồi.',
            ephemeral: true,
          });
        }
      } catch (err) {
        console.error('❌ Lỗi khi fetch user:', err);
        return interaction.reply({
          content: 'Không tìm thấy người chơi.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_kill_stalker_${playerId}`)
        .setTitle('Chọn người chơi để ám sát');

      const input = new TextInputBuilder()
        .setCustomId('kill_index_stalker')
        .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      try {
        await interaction.showModal(modal);
      } catch (err) {
        console.error('❌ Lỗi khi showModal:', err);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Tương tác đã hết hạn hoặc xảy ra lỗi. Vui lòng thử lại.',
            ephemeral: true,
          });
        }
      }
    }
    if (interaction.customId.startsWith('gunner_shoot_')) {
      const playerId = interaction.customId.split('_')[2];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_gunner_shoot_${playerId}`)
        .setTitle('Chọn người để bắn');

      const input = new TextInputBuilder()
        .setCustomId('shoot_index_gunner')
        .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      try {
        await interaction.showModal(modal);
      } catch (err) {
        console.error('❌ Lỗi khi showModal:', err);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Tương tác đã hết hạn hoặc xảy ra lỗi. Vui lòng thử lại.',
            ephemeral: true,
          });
        }
      }
    }
  }

  if (interaction.isModalSubmit()) {
    const guildId = interaction.guild?.id || store.get(interaction.user.id);

    if (!guildId) {
      return interaction.reply({
        content: 'Không tìm thấy guild liên kết với người dùng này.',
        ephemeral: true,
      });
    }

    const gameRoom = gameRooms.get(guildId);
    let sender = null;
    if (gameRoom) {
      sender = gameRoom.players.find((p) => p.userId === interaction.user.id); // player
      if (!sender) return;
    }

    await wolfInteraction.isModalSubmit(interaction, gameRoom, sender, client);
    await wolfSeerInteraction.isModalSubmit(interaction, gameRoom, sender, client);
    await alphawerewolfInteraction.isModalSubmit(interaction, gameRoom, sender, client);
    
    await bodyguardInteraction.isModalSubmit(interaction, gameRoom, sender, client);

    await seerInteraction.isModalSubmit(interaction, gameRoom, sender, client);
    if (interaction.customId.startsWith('submit_investigate_detective_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const index1Str = interaction.fields.getTextInputValue(
        'investigate_index_1'
      );
      const index2Str = interaction.fields.getTextInputValue(
        'investigate_index_2'
      );
      const index1 = parseInt(index1Str, 10);
      const index2 = parseInt(index2Str, 10);

      if (
        isNaN(index1) ||
        isNaN(index2) ||
        index1 < 1 ||
        index2 < 1 ||
        index1 > gameRoom.players.length ||
        index2 > gameRoom.players.length ||
        index1 === index2
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ hoặc trùng nhau.',
          ephemeral: true,
        });
      }

      const targetPlayer1 = gameRoom.players[index1 - 1];
      const targetPlayer2 = gameRoom.players[index2 - 1];

      if (sender.role.id === 5) {
        if (!targetPlayer1.alive || !targetPlayer2.alive) {
          return interaction.reply({
            content: 'Không có tác dụng lên người chết',
            ephemeral: true,
          });
        }

        if (sender.role.investigatedCount <= 0) {
          return interaction.reply({
            content: 'Bạn đã hết lượt dùng chức năng',
            ephemeral: true,
          });
        }

        sender.role.investigatedPairs.push(
          targetPlayer1.userId,
          targetPlayer2.userId
        );
        sender.role.investigatedCount -= 1; // soi rồi không chọn lại được nữa

        const checkFaction = () => {
          if (targetPlayer1.role.faction === targetPlayer2.role.faction) {
            if (
              targetPlayer1.role.id === WEREROLE.LYCAN ||
              targetPlayer2.role.id === WEREROLE.LYCAN
            ) {
              return false;
            }
            return true;
          }
          if (
            targetPlayer1.role.faction === 3 &&
            targetPlayer2.role.faction === 1 &&
            targetPlayer1.role.id !== WEREROLE.LYCAN &&
            targetPlayer2.role.id !== WEREROLE.LYCAN
          )
            return true;
          if (
            targetPlayer1.role.faction === 1 &&
            targetPlayer2.role.faction === 3 &&
            targetPlayer1.role.id !== WEREROLE.LYCAN &&
            targetPlayer2.role.id !== WEREROLE.LYCAN
          )
            return true;

          if (
            targetPlayer1.role.id === WEREROLE.LYCAN ||
            (targetPlayer2.role.id === WEREROLE.LYCAN &&
              (targetPlayer1.role.faction === 0 ||
                targetPlayer2.role.faction === 0))
          ) {
            return true;
          }
          return false;
        };

        try {
          const user = await client.users.fetch(playerId);
          await user.send(
            `🔎 Bạn đã điều tra: **${targetPlayer1.name}** và **${targetPlayer2.name}**. Họ ${checkFaction() ? 'cùng phe' : 'khác phe'}.`
          );
        } catch (err) {
          console.error(`Không thể gửi DM cho ${playerId}:`, err);
        }
      }

      await interaction.reply({
        content: '✅ Điều tra thành công.',
        ephemeral: true,
      });
    }
    if (interaction.customId.startsWith('submit_poison_witch_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const pointIndexStr =
        interaction.fields.getTextInputValue('poison_index_witch');
      const pointIndex = parseInt(pointIndexStr, 10);

      if (
        isNaN(pointIndex) ||
        pointIndex < 1 ||
        pointIndex > gameRoom.players.length
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[pointIndex - 1];
      if (sender.role.id === WEREROLE.WITCH) {
        if (!targetPlayer.alive) {
          return interaction.reply({
            content: 'Không có tác dụng lên người chết',
            ephemeral: true,
          });
        }

        if (sender.role.poisonCount <= 0) {
          return interaction.reply({
            content: 'Bạn đã hết lượt dùng chức năng',
            ephemeral: true,
          });
        }

        if (targetPlayer.userId === sender.userId) {
          return interaction.reply({
            content: 'Bạn không thể chọn chính bản thân bạn.',
            ephemeral: true,
          });
        }

        // sender.role.poisonCount -= 1; // lỡ chọn lại
        sender.role.poisonedPerson = targetPlayer.userId;
      }

      try {
        const user = await client.users.fetch(playerId);
        await user.send(
          `💉 Bạn đã chọn người chơi để dùng thuốc: **${targetPlayer.name}**.`
        );
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }

      await interaction.reply({
        content: '✅ Chọn người chơi thành công.',
        ephemeral: true,
      });
    }
    if (interaction.customId.startsWith('submit_heal_witch_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const healIndexStr =
        interaction.fields.getTextInputValue('heal_index_witch');
      const healIndex = parseInt(healIndexStr, 10);

      if (
        isNaN(healIndex) ||
        healIndex < 1 ||
        healIndex > gameRoom.players.length
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[healIndex - 1];
      if (sender.role.id === WEREROLE.WITCH) {
        if (!targetPlayer.alive) {
          return interaction.reply({
            content: 'Không có tác dụng lên người chết',
            ephemeral: true,
          });
        }

        if (sender.role.healCount <= 0) {
          return interaction.reply({
            content: 'Bạn đã hết lượt dùng chức năng',
            ephemeral: true,
          });
        }
        if (targetPlayer.userId === sender.userId) {
          return interaction.reply({
            content: 'Bạn không thể cứu chính bản thân bạn.',
            ephemeral: true,
          });
        }

        if (targetPlayer.userId !== sender.role.needHelpPerson) {
          return interaction.reply({
            content: 'Bạn chỉ có thể cứu người chơi đã được yêu cầu giúp đỡ.',
            ephemeral: true,
          });
        }

        sender.role.healCount -= 1; // cứu rồi không cứu lại được nữa
        sender.role.healedPerson = targetPlayer.userId;
      }

      try {
        const user = await client.users.fetch(playerId);
        await user.send(
          `💫 Bạn đã chọn người chơi để cứu: **${targetPlayer.name}**.`
        );
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }

      await interaction.reply({
        content: '✅ Chọn người chơi thành công.',
        ephemeral: true,
      });
    }
    if (interaction.customId.startsWith('submit_vote_hanged_')) {
      if (!gameRoom) return;

      if (gameRoom.gameState.phase === 'day') {
        return interaction.reply({
          content: 'Bạn chưa thể vote ngay lúc này',
          ephemeral: true,
        });
      }

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const voteIndexStr =
        interaction.fields.getTextInputValue('vote_index_hanged');
      const voteIndex = parseInt(voteIndexStr, 10);

      if (
        voteIndex !== 0 &&
        voteIndex !== 36 &&
        (isNaN(voteIndex) ||
          voteIndex < 1 ||
          voteIndex > gameRoom.players.length)
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ. Nhập 0 hoặc 36 để bỏ qua vote.',
          ephemeral: true,
        });
      }

      if (!sender.alive) {
        return interaction.reply({
          content: 'Người chết không thể vote.',
          ephemeral: true,
        });
      }

      if (voteIndex === 0 || voteIndex === 36) {
        sender.role.voteHanged = 'skip';
      } else {
        const targetPlayer = gameRoom.players[voteIndex - 1];

        if (targetPlayer.userId === sender.userId) {
          return interaction.reply({
            content: 'Bạn không thể vote chính mình.',
            ephemeral: true,
          });
        }

        if (!targetPlayer.alive) {
          return interaction.reply({
            content: 'Không thể vote người đã chết.',
            ephemeral: true,
          });
        }

        sender.role.voteHanged = targetPlayer.userId;
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        const notifyPromises = gameRoom.players.map(async (player) => {
          const targetUser = await client.users.fetch(player.userId);
          if (player.userId !== playerId) {
            return targetUser.send(`✅ **${sender.name}** đã vote.`);
          } else {
            if (voteIndex === 0 || voteIndex === 36) {
              return targetUser.send(`✅ Bạn đã chọn bỏ qua vote.`);
            } else {
              const targetPlayer = gameRoom.players[voteIndex - 1];
              return targetUser.send(
                `✅ Bạn đã vote treo cổ: **${targetPlayer.name}**.`
              );
            }
          }
        });

        await Promise.allSettled(notifyPromises);

        const alivePlayers = gameRoom.players.filter((p) => p.alive);
        const allVoted = alivePlayers.every((p) => p.role.voteHanged !== null);

        if (allVoted) {
          const notifyEndVote = gameRoom.players.map(async (player) => {
            const user = await client.users.fetch(player.userId);
            return user.send(
              `### ⚡ Tất cả mọi người đã vote xong! Kết quả sẽ được công bố ngay lập tức.`
            );
          });
          await Promise.allSettled(notifyEndVote);

          gameRoom.emit('voteComplete');
        }
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }
      await interaction.editReply({
        content: '✅ Vote thành công.',
      });
    }
    if (interaction.customId.startsWith('submit_revive_medium_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const reviveIndexStr = interaction.fields.getTextInputValue(
        'revive_index_medium'
      );
      const reviveIndex = parseInt(reviveIndexStr, 10);

      if (
        isNaN(reviveIndex) ||
        reviveIndex < 1 ||
        reviveIndex > gameRoom.players.length
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[reviveIndex - 1];
      if (sender.role.id === 8) {
        if (sender.role.revivedCount <= 0) {
          return interaction.reply({
            content: 'Bạn đã hết lượt dùng chức năng',
            ephemeral: true,
          });
        }

        if (targetPlayer.alive) {
          return interaction.reply({
            content: 'Người chơi này vẫn còn sống, không thể hồi sinh.',
            ephemeral: true,
          });
        }

        if (targetPlayer.role.faction !== 1) {
          return interaction.reply({
            content: `Người chơi này không thuộc phe dân làng, không thể hồi sinh.`,
            ephemeral: true,
          });
        }

        // sender.role.revivedCount -= 1; // Lỡ chọn lại
        sender.role.revivedPerson = targetPlayer.userId;
      }

      try {
        const user = await client.users.fetch(playerId);
        await user.send(
          `💫 Bạn đã chọn người chơi để hồi sinh: **${targetPlayer.name}**.`
        );
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }
      await interaction.reply({
        content: '✅ Chọn người chơi thành công.',
        ephemeral: true,
      });
    }
    if (interaction.customId === 'settings_modal') {
      const newSettings = {
        wolfVoteTime: parseInt(
          interaction.fields.getTextInputValue('wolfVoteTime')
        ),
        nightTime: parseInt(interaction.fields.getTextInputValue('nightTime')),
        discussTime: parseInt(
          interaction.fields.getTextInputValue('discussTime')
        ),
        voteTime: parseInt(interaction.fields.getTextInputValue('voteTime')),
      };

      await interaction.deferUpdate();

      if (
        Object.values(newSettings).some(
          (value) => isNaN(value) || value < 10 || value > 300
        )
      ) {
        await interaction.editReply({
          content: '❌ Vui lòng nhập số từ 10 đến 300 giây!',
          ephemeral: true,
        });
        return;
      }

      if (newSettings.wolfVoteTime >= newSettings.nightTime) {
        return interaction.editReply({
          content:
            'Thời gian sói vote không thể lớn hơn hoặc bằng thời gian trong đêm.',
          ephemeral: true,
        });
      }

      const guildId = interaction.guild.id;
      // serverSettings.set(guildId, newSettings);

      await ServerSettings.findOneAndUpdate({ guildId }, newSettings, {
        new: true,
        upsert: true,
      });

      const updatedEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('⚙️ CÀI ĐẶT GAME MA SÓI')
        .setDescription('```✅ Cài đặt đã được cập nhật thành công!```')
        .addFields(
          {
            name: '🐺 Thời Gian Sói Vote',
            value: `\`${newSettings.wolfVoteTime}\` giây`,
            inline: true,
          },
          {
            name: '🌙 Thời Gian Ban Đêm',
            value: `\`${newSettings.nightTime}\` giây`,
            inline: true,
          },
          {
            name: '💭 Thời Gian Thảo Luận',
            value: `\`${newSettings.discussTime}\` giây`,
            inline: true,
          },
          {
            name: '🗳️ Thời Gian Vote Treo Cổ',
            value: `\`${newSettings.voteTime}\` giây`,
            inline: true,
          }
        )
        .setFooter({
          text: '💡 Cài đặt sẽ được áp dụng cho các game tiếp theo',
        });

      await interaction.editReply({
        embeds: [updatedEmbed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('edit_settings')
              .setLabel('🔧 Điều Chỉnh Cài Đặt')
              .setStyle(ButtonStyle.Primary)
          ),
        ],
      });
    }
    if (interaction.customId.startsWith('submit_choose_master_maid_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[4];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const masterIndexStr =
        interaction.fields.getTextInputValue('master_index_maid');
      const masterIndex = parseInt(masterIndexStr, 10);

      await interaction.deferReply({ ephemeral: true });

      if (
        isNaN(masterIndex) ||
        masterIndex < 1 ||
        masterIndex > gameRoom.players.length
      ) {
        return interaction.editReply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[masterIndex - 1];
      if (sender.role.id === WEREROLE.MAID) {
        if (!targetPlayer.alive) {
          return interaction.editReply({
            content: 'Không thể chọn người chết làm chủ',
            ephemeral: true,
          });
        }

        if (targetPlayer.userId === sender.userId) {
          return interaction.editReply({
            content: 'Bạn không thể chọn chính mình làm chủ.',
            ephemeral: true,
          });
        }

        sender.role.master = targetPlayer.userId;
      }

      try {
        const user = await client.users.fetch(playerId);
        await user.send(
          `👑 Bạn đã chọn **${targetPlayer.name}** làm chủ của mình.`
        );
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }

      await interaction.editReply({
        content: '✅ Chọn chủ thành công.',
        ephemeral: true,
      });
    }
    await customizeRolesJson.isModalSubmit(interaction, gameRooms);
    if (interaction.customId.startsWith('submit_view_foxspirit_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const index1Str = interaction.fields.getTextInputValue('view_index_1');
      const index2Str = interaction.fields.getTextInputValue('view_index_2');
      const index3Str = interaction.fields.getTextInputValue('view_index_3');

      const index1 = parseInt(index1Str, 10);
      const index2 = parseInt(index2Str, 10);
      const index3 = parseInt(index3Str, 10);

      if (
        isNaN(index1) ||
        isNaN(index2) ||
        isNaN(index3) ||
        index1 < 1 ||
        index2 < 1 ||
        index3 < 1 ||
        index1 > gameRoom.players.length ||
        index2 > gameRoom.players.length ||
        index3 > gameRoom.players.length ||
        index1 === index2 ||
        index1 === index3 ||
        index2 === index3
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ hoặc trùng nhau.',
          ephemeral: true,
        });
      }

      const targetPlayers = [
        gameRoom.players[index1 - 1],
        gameRoom.players[index2 - 1],
        gameRoom.players[index3 - 1],
      ];

      if (sender.role.id === WEREROLE.FOXSPIRIT) {
        await interaction.deferReply({ ephemeral: true });
        if (
          !targetPlayers[0].alive ||
          !targetPlayers[1].alive ||
          !targetPlayers[2].alive
        ) {
          return interaction.editReply({
            content: 'Không có tác dụng lên người chết.',
            ephemeral: true,
          });
        }
        if (sender.role.viewCount <= 0) {
          return interaction.editReply({
            content: 'Bạn đã hết lượt dùng chức năng.',
            ephemeral: true,
          });
        }

        sender.role.threeViewed.push(
          targetPlayers[0].userId,
          targetPlayers[1].userId,
          targetPlayers[2].userId
        );
        sender.role.viewCount -= 1;
        const isHaveWolf = () => {
          const AlphaWerewolf = gameRoom.players.find(
            (p) => p.role.id === WEREROLE.ALPHAWEREWOLF
          );
          for (const player of targetPlayers) {
            if (
              (player.role.faction === 0 && !AlphaWerewolf) ||
              (player.role.faction === 0 &&
                AlphaWerewolf &&
                AlphaWerewolf.role.maskWolf !== player.userId) ||
              player.role.id === WEREROLE.LYCAN
            ) {
              return true;
            }
          }
          return false;
        };
        try {
          const user = await client.users.fetch(playerId);

          await user.send(
            `🔎 Trong 3 người bạn chọn: **${targetPlayers[0].name}**, **${targetPlayers[1].name}** và **${targetPlayers[2].name}** ${isHaveWolf() ? 'có Sói' : 'không có Sói'}.`
          );
          if (!isHaveWolf()) {
            await user.send(
              `Bạn bị mất chức năng vì không có Sói trong 3 người bạn chọn.`
            );
            sender.role.isHaveSkill = false;
          }
        } catch (err) {
          console.error(`Không thể gửi DM cho ${playerId}:`, err);
        }
      }
      await interaction.editReply({
        content: '✅ Đã xem xét.',
        ephemeral: true,
      });
    }
    if (interaction.customId.startsWith('submit_stalk_stalker_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const stalkIndexStr = interaction.fields.getTextInputValue(
        'stalk_index_stalker'
      );
      const stalkIndex = parseInt(stalkIndexStr, 10);

      if (
        isNaN(stalkIndex) ||
        stalkIndex < 1 ||
        stalkIndex > gameRoom.players.length
      ) {
        return interaction.editReply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[stalkIndex - 1];
      if (sender.role.id === WEREROLE.STALKER) {
        if (!targetPlayer.alive) {
          return interaction.editReply({
            content: 'Không có tác dụng lên người chết',
            ephemeral: true,
          });
        }

        if (sender.role.stalkCount <= 0) {
          return interaction.editReply({
            content: 'Bạn đã hết lượt dùng chức năng',
            ephemeral: true,
          });
        }

        if (sender.role.stalkedPerson) {
          return interaction.editReply({
            content: 'Bạn đã theo dõi người chơi khác rồi.',
            ephemeral: true,
          });
        }

        if (targetPlayer.userId === sender.userId) {
          return interaction.editReply({
            content: 'Bạn không thể chọn chính bản thân bạn.',
            ephemeral: true,
          });
        }

        sender.role.stalkedPerson = targetPlayer.userId;
        sender.role.stalkCount -= 1;
      }

      try {
        const user = await client.users.fetch(playerId);
        await user.send(
          `👀 Bạn đã chọn người chơi để theo dõi: **${targetPlayer.name}**.`
        );
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }

      await interaction.editReply({
        content: '✅ Chọn người chơi thành công.',
        ephemeral: true,
      });
    }
    if (interaction.customId.startsWith('submit_kill_stalker_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const killIndexStr =
        interaction.fields.getTextInputValue('kill_index_stalker');
      const killIndex = parseInt(killIndexStr, 10);

      if (
        isNaN(killIndex) ||
        killIndex < 1 ||
        killIndex > gameRoom.players.length
      ) {
        return interaction.editReply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[killIndex - 1];
      if (sender.role.id === WEREROLE.STALKER) {
        if (!targetPlayer.alive) {
          return interaction.editReply({
            content: 'Không có tác dụng lên người chết',
            ephemeral: true,
          });
        }

        if (sender.role.killCount <= 0) {
          return interaction.editReply({
            content: 'Bạn đã hết lượt dùng chức năng',
            ephemeral: true,
          });
        }
        if (sender.role.killedPerson) {
          return interaction.editReply({
            content: 'Bạn đã ám sát người chơi khác rồi.',
            ephemeral: true,
          });
        }
        if (targetPlayer.userId === sender.userId) {
          return interaction.editReply({
            content: 'Bạn không thể ám sát chính bản thân bạn.',
            ephemeral: true,
          });
        }

        sender.role.killCount -= 1;
        sender.role.killedPerson = targetPlayer.userId;
      }

      try {
        const user = await client.users.fetch(playerId);
        await user.send(
          `🔪 Bạn đã chọn người chơi để ám sát: **${targetPlayer.name}**.`
        );
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }

      await interaction.editReply({
        content: '✅ Chọn người chơi thành công.',
        ephemeral: true,
      });
    }
    if (interaction.customId.startsWith('submit_gunner_shoot_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'day') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const shootIndexStr =
        interaction.fields.getTextInputValue('shoot_index_gunner');
      const shootIndex = parseInt(shootIndexStr, 10);

      if (
        isNaN(shootIndex) ||
        shootIndex < 1 ||
        shootIndex > gameRoom.players.length
      ) {
        return interaction.editReply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[shootIndex - 1];
      if (sender.role.id === WEREROLE.GUNNER) {
        if (!targetPlayer.alive) {
          return interaction.editReply({
            content: 'Không thể bắn người đã chết.',
            ephemeral: true,
          });
        }

        if (sender.role.bullets <= 0) {
          return interaction.editReply({
            content: 'Bạn đã hết đạn.',
            ephemeral: true,
          });
        }

        if (targetPlayer.userId === sender.userId) {
          return interaction.editReply({
            content: 'Bạn không thể bắn chính mình.',
            ephemeral: true,
          });
        }

        sender.role.bullets -= 1;
        targetPlayer.alive = false;
        targetPlayer.role = new Dead(
          targetPlayer.role.faction,
          targetPlayer.role.id
        );

        const notifyPromises = gameRoom.players.map(async (player) => {
          const user = await client.users.fetch(player.userId);
          if (!user) return;

          if (player.userId === targetPlayer.userId) {
            await user.send('💀 Bạn đã bị Xạ thủ bắn chết.');
          }
          if (sender.role.bullets === 1) {
            await user.send(
              `🔫 **${sender.name}** đã bắn chết **${targetPlayer.name}**!`
            );
          } else {
            await user.send(
              `🔫 **Xạ Thủ** đã bắn chết **${targetPlayer.name}**!`
            );
          }
        });

        await Promise.allSettled(notifyPromises);

        await gameRoom.updateAllPlayerList();

        // Kiểm tra master của hầu gái
        const maidNewRole = await gameRoom.checkIfMasterIsDead(targetPlayer);

        if (maidNewRole) {
          const notifyPromises = gameRoom.players.map(async (player) => {
            const user = await client.users.fetch(player.userId);
            if (!user) return;

            await user.send(
              `### 👒 Hầu gái đã lên thay vai trò **${maidNewRole}** của chủ vì chủ đã bị bắn.\n`
            );
          });
          await Promise.allSettled(notifyPromises);
        }
        await gameRoom.checkEndGame();
      }

      await interaction.editReply({
        content: '✅ Bắn thành công.',
        ephemeral: true,
      });
    }
  }

  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    return await interaction.reply({
      content: 'Lệnh không tồn tại!',
      ephemeral: true,
    });
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: 'Có lỗi xảy ra khi thực thi lệnh!',
      ephemeral: true,
    });
  }
});

client.login(process.env.TOKEN);
