import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Kiểm tra độ trễ của bot'),

  async execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.deferReply({ fetchReply: true });
    const ping = sent.createdTimestamp - interaction.createdTimestamp;
    const wsping = interaction.client.ws.ping;

    const apiPing = wsping === -1 ? 'Chưa kết nối' : `${wsping}ms`;

    let color = 0x00ff88;
    if (wsping === -1 || ping > 200) {
      color = 0xff4444;
    } else if (ping > 100) {
      color = 0xffa500;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('🏓 Pong!')
      .setDescription(`**Bot:** \`${ping}ms\` • **API:** \`${apiPing}\``)
      .setFooter({ text: `${interaction.user.displayName}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
