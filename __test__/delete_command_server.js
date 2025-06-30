import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Đang xoá tất cả slash command trong guild...');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: [],
    });
    console.log('Đã xoá toàn bộ slash command trong guild!');
  } catch (error) {
    console.error('Lỗi khi xoá command:', error);
  }
})();
