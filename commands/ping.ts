import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';

import { createMinimalEmbed, UI_COLORS, buildMinimalReplyPayload } from '../utils/ui.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Kiểm tra độ trễ của bot'),

  async execute(interaction: ChatInputCommandInteraction) {
    const useV2 = process.env.USE_COMPONENTS_V2 === 'true';

    if (useV2) {
      const pingStart = Date.now();
      
      await interaction.reply(
        buildMinimalReplyPayload({
          title: 'Pong',
          description: 'Đang đo độ trễ...',
          color: UI_COLORS.accent,
          footerUser: interaction.user,
        }),
      );

      const latency = Date.now() - pingStart;
      const wsping = interaction.client.ws.ping;
      const apiPing = wsping === -1 ? 'Chưa kết nối' : `${wsping}ms`;

      await interaction.editReply(
        buildMinimalReplyPayload({
          title: 'Pong',
          description: `Bot: \`${latency}ms\` • API: \`${apiPing}\``,
          color:
            wsping === -1 || latency > 200
              ? UI_COLORS.danger
              : latency > 100
              ? UI_COLORS.warning
              : UI_COLORS.success,
          footerUser: interaction.user,
        }),
      );
      return;
    }

    // Classic embed
    const sent = await interaction.deferReply({ fetchReply: true });
    const ping = sent.createdTimestamp - interaction.createdTimestamp;
    const wsping = interaction.client.ws.ping;

    const apiPing = wsping === -1 ? 'Chưa kết nối' : `${wsping}ms`;

    let color: number = UI_COLORS.success;
    if (wsping === -1 || ping > 200) {
      color = UI_COLORS.danger;
    } else if (ping > 100) {
      color = UI_COLORS.warning;
    }

    const embed = createMinimalEmbed({
      title: 'Pong',
      description: `Bot: \`${ping}ms\` • API: \`${apiPing}\``,
      color,
      footerUser: interaction.user,
    });

    await interaction.editReply({ embeds: [embed] });
  },
};
