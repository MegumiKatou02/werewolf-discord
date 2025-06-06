const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { RoleResponse } = require('./utils/response');
const { FactionRole } = require('./types/faction');
require('dotenv').config();

const roles = require('./data/data.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
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
  if (message.author.bot) return;

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
});

client.on('interactionCreate', async (interaction) => {
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
