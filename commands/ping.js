const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Kiểm tra độ trễ của bot'),

  async execute(interaction) {
    const sent = await interaction.deferReply({ fetchReply: true });
    const ping = sent.createdTimestamp - interaction.createdTimestamp;
    const wsping = interaction.client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🏓 Pong!')
      .addFields(
        {
          name: '📊 Độ Trễ',
          value: `\`${ping}ms\``,
          inline: true,
        },
        {
          name: '🌐 WebSocket',
          value: `\`${wsping}ms\``,
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
