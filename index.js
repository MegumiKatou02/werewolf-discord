const { Client, GatewayIntentBits, Collection, EmbedBuilder, AttachmentBuilder } = require('discord.js')
const fs = require('node:fs');
const path = require('node:path');
const EmbedBuilderWerewolf = require('./utils/embed')
require('dotenv').config();

const roles = require('./data/data.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
})

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

client.once('ready', () => {
    console.log('Bot online với tên', client.user.tag);
})

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (message.content === '!soi') {
    const { embed, file } = EmbedBuilderWerewolf('werewolf.png', {
      title: roles["0"].title,
      description: roles["0"].description
    })
    
    await message.reply({ embeds: [embed], files: [file] });
  }
  if (message.content === '!danlang') {
    const { embed, file } = EmbedBuilderWerewolf('villager.png', {
      title: roles["1"].title,
      description: roles["1"].description
    })
    
    await message.reply({ embeds: [embed], files: [file] });
  }
})

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    return await interaction.reply({ content: 'Lệnh không tồn tại!', ephemeral: true });
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'Có lỗi xảy ra khi thực thi lệnh!', ephemeral: true });
  }
});

client.login(process.env.TOKEN);