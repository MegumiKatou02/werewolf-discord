import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  Client,
  GatewayIntentBits,
  Collection,
  Partials,
  ActivityType,
  SlashCommandBuilder,
  type Interaction,
} from 'discord.js';
import { config } from 'dotenv';
config();

import connectDB from './config/database.js';
import { startSpamCleanup } from './src/bot/antiSpam.js';
import { initializeCache } from './src/bot/cache.js';
import registerInteractionCreate from './src/bot/handlers/interactionCreate.js';
import registerMessageCreate from './src/bot/handlers/messageCreate.js';
import attachGracefulShutdown from './src/bot/lifecycle.js';

interface SlashCommand {
  data: SlashCommandBuilder;
  // eslint-disable-next-line no-unused-vars
  execute: (_interaction: Interaction) => Promise<void>;
}

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, SlashCommand>;
  }
}

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = await import(pathToFileURL(filePath).href);

  client.commands.set(command.default.data.name, command.default);
}

client.once('ready', () => {
  console.log('Bot online với tên', client.user?.tag);
  client.user?.setPresence({
    activities: [{ name: '/huongdan', type: ActivityType.Watching }],
    status: 'dnd',
  });
});

initializeCache(client);
startSpamCleanup();

registerMessageCreate(client);
registerInteractionCreate(client);

client.login(process.env.TOKEN);

attachGracefulShutdown(client);
