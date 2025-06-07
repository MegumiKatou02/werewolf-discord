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
  }

  if (interaction.isModalSubmit()) {
    const guildId = store.get(interaction.user.id);
    const gameRoom = gameRooms.get(guildId);

    if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

    const sender = gameRoom.players.find(
      (p) => p.userId === interaction.user.id
    ); // player
    if (!sender) return;

    if (interaction.customId.startsWith('submit_vote_wolf_')) {
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
