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
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { RoleResponse } = require('./utils/response');
const { FactionRole } = require('./types/faction');
const { store } = require('./core/store');
const { gameRooms } = require('./core/room');
const { send } = require('node:process');

require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
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
});

client.on('messageCreate', async (message) => {
  // if (message.author.bot) return;

  await RoleResponse(message, '!soi', 'werewolf.png', 0, FactionRole.Werewolf);
  await RoleResponse(
    message,
    '!danlang',
    'villager.png',
    1,
    FactionRole.Village
  );
  await RoleResponse(
    message,
    '!baove',
    'bodyguard.png',
    2,
    FactionRole.Village
  );
  await RoleResponse(
    message,
    '!bansoi',
    'cursed.png',
    3,
    FactionRole['Vi-Wolf']
  );
  await RoleResponse(message, '!tientri', 'seer.png', 4, FactionRole.Village);
  await RoleResponse(
    message,
    '!thamtu',
    'detective.png',
    5,
    FactionRole.Village
  );
  await RoleResponse(message, '!phuthuy', 'witch.png', 6, FactionRole.Village);
  await RoleResponse(message, '!thangngo', 'fool.png', 7, FactionRole.Solo);
  await RoleResponse(
    message,
    '!thaydong',
    'medium.png',
    8,
    FactionRole.Village
  );

  if (message.channel.type === ChannelType.DM) {
    console.log(`Tin nhắn DM từ ${message.author.tag}: ${message.content}`);

    const gameRoom = Array.from(gameRooms.values()).find(
      (room) =>
        room.status === 'starting' &&
        room.players.some((p) => p.userId === message.author.id)
    );

    if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

    const sender = gameRoom.players.find((p) => p.userId === message.author.id);
    if (!sender) return;

    const senderUser = await client.users.fetch(sender.userId);
    const senderName = senderUser.globalName || senderUser.username;

    // Gửi tin nhắn cho các sói khác
    if (sender.role.id === 0) {
      const wolves = gameRoom.players.filter(
        (p) => p.role.id === 0 && p.userId !== sender.userId
      );
      for (const wolf of wolves) {
        try {
          const user = await client.users.fetch(wolf.userId);

          await user.send(`🐺 [${senderName}]: ${message.content}`);
        } catch (err) {
          console.error('Không gửi được tin nhắn cho Sói khác', err);
        }
      }
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('vote_target_wolf_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_vote_wolf_${playerId}`)
        .setTitle('Vote người chơi cần giết');

      const input = new TextInputBuilder()
        .setCustomId('vote_index_wolf')
        .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }
    if (interaction.customId.startsWith('protect_target_bodyguard_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_protect_bodyguard_${playerId}`)
        .setTitle('Chọn người cần bảo vệ');

      const input = new TextInputBuilder()
        .setCustomId('protect_index_bodyguard')
        .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }
    if (interaction.customId.startsWith('view_target_seer_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_view_seer_${playerId}`)
        .setTitle('Xem vai trò người chơi');

      const input = new TextInputBuilder()
        .setCustomId('view_index_seer')
        .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }
  }

  if (interaction.isModalSubmit()) {
    const guildId = store.get(interaction.user.id);
    const gameRoom = gameRooms.get(guildId);

    const sender = gameRoom.players.find(
      (p) => p.userId === interaction.user.id
    ); // player
    if (!sender) return;

    if (interaction.customId.startsWith('submit_vote_wolf_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const voteIndexStr =
        interaction.fields.getTextInputValue('vote_index_wolf');
      const voteIndex = parseInt(voteIndexStr, 10);

      if (
        isNaN(voteIndex) ||
        voteIndex < 1 ||
        voteIndex > gameRoom.players.length
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[voteIndex - 1];

      if (sender.role.id === 0) {
        if (targetPlayer.role.faction === 0) { // FactionRole.Werewolf
          return interaction.reply({
            content: 'Bạn không thể vote giết đồng minh của mình.',
            ephemeral: true,
          });
        }
        sender.role.voteBite = targetPlayer.userId;
      }

      try {
        const user = await client.users.fetch(playerId);
        await user.send(`✅ Bạn đã vote giết: **${targetPlayer.userId}**.`);
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }

      await interaction.reply({
        content: '✅ Vote của bạn đã được ghi nhận.',
        ephemeral: true,
      });
    }
    if (interaction.customId.startsWith('submit_protect_bodyguard_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const protectIndexStr =
        interaction.fields.getTextInputValue('protect_index_bodyguard');
      const protectIndex = parseInt(protectIndexStr, 10);

      if (
        isNaN(protectIndex) ||
        protectIndex < 1 ||
        protectIndex > gameRoom.players.length
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[protectIndex - 1];
      if (sender.role.id === 2) {
        sender.role.protectedPerson = targetPlayer.userId;
      }

      try {
        const user = await client.users.fetch(playerId);
        await user.send(`✅ Bạn đã bảo vệ: **${targetPlayer.userId}**.`);
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }

      await interaction.reply({
        content: '✅ Bảo vệ thành công.',
        ephemeral: true,
      });
    }
    if (interaction.customId.startsWith('submit_view_seer_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const viewIndexStr =
        interaction.fields.getTextInputValue('view_index_seer');
      const viewIndex = parseInt(viewIndexStr, 10);

      if (
        isNaN(viewIndex) ||
        viewIndex < 1 ||
        viewIndex > gameRoom.players.length
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[viewIndex - 1];
      if (sender.role.id === 4 && sender.role.viewCount > 0) {
        if (sender.role.id === targetPlayer.role.id) {
          return interaction.reply({
            content: 'Bạn không thể xem vai trò của đồng minh.',
            ephemeral: true,
          });
        }

        sender.role.viewCount -= 1;
        await interaction.reply({
          content: `Vai trò của **${targetPlayer.userId}** là: **${targetPlayer.role.name}**.`,
          ephemeral: false,
        });
      }

      try {
        const user = await client.users.fetch(playerId);
        await user.send(`✅ Bạn đã xem vai trò của: **${targetPlayer.userId}**.`);
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }
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
