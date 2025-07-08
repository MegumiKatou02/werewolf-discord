import { Client, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';

config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  const guildId = process.env.IGNORE_SERVER;
  const guild = client.guilds.cache.get(guildId);

  if (guild) {
    guild.leave()
      .then(g => console.log(`Bot đã rời khỏi server: ${g.name}`))
      .catch(console.error);
  } else {
    console.log('Bot không có trong server này hoặc ID sai.');
  }
});

client.login(process.env.TOKEN); 
