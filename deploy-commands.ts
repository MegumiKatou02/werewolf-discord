import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
// const guildId = process.env.GUILD_ID;

if (!token) {
  throw new Error('TOKEN không được tìm thấy trong file .env');
}

if (!clientId) {
  throw new Error('CLIENT_ID không được tìm thấy trong file .env');
}

(async () => {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file: string) => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(pathToFileURL(filePath).href);
    commands.push(command.default.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('🛠️ Đang đăng ký slash command...');
    console.log(
      'Lệnh sẽ được đăng ký:',
      commands.map((c) => c.name)
    );
    await rest.put(Routes.applicationCommands(clientId), {
      // co s
      body: commands,
    });
    console.log('✅ Slash command đã được đăng ký!');
  } catch (error) {
    console.error('❌ Lỗi khi đăng ký:', error);
  }
})();
