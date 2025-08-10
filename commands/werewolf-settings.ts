import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  type Interaction,
  PermissionsBitField,
} from 'discord.js';
import { MessageFlags } from 'discord.js';

import { gameRooms } from '../core/room.js';
import ServerSettings from '../models/ServerSettings.js';
import { UI_COLORS } from '../utils/ui.js';

const defaultSettings = {
  wolfVoteTime: 40,
  nightTime: 70,
  discussTime: 90,
  voteTime: 30,
};

export default {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Xem và điều chỉnh cài đặt game Ma Sói'),

  async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (!interaction.inGuild()) {
      return interaction.reply({
        content: 'Lệnh này chỉ sử dụng được trong server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const isAdmin =
      (interaction.member?.permissions instanceof PermissionsBitField &&
        interaction.member.permissions.has(
          PermissionFlagsBits.Administrator,
        )) ??
      false;
    const isDev = interaction.user.id === process.env.DEVELOPER;

    if (!isAdmin && !isDev) {
      return interaction.reply({
        content: 'Bạn không có quyền sử dụng lệnh này.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const guildId = interaction.guildId;

    const gameRoom = gameRooms.get(guildId);
    if (gameRoom && gameRoom.status === 'starting') {
      return interaction.reply({
        content: 'Không thể thay đổi cài đặt khi đang có phòng chơi.',
        flags: MessageFlags.Ephemeral,
      });
    }

    let settings = await ServerSettings.findOne({ guildId });
    if (!settings) {
      settings = new ServerSettings({
        guildId,
        ...defaultSettings,
      });
      await settings.save();
    }

    const settingsEmbed = new EmbedBuilder()
      .setColor(UI_COLORS.accent)
      .setTitle('Cài đặt Ma Sói')
      .setDescription('Các thông số hiện tại')
      .addFields(
        {
          name: 'Thời gian Sói vote',
          value: `\`${settings.wolfVoteTime}\` giây`,
          inline: true,
        },
        {
          name: 'Thời gian Ban đêm',
          value: `\`${settings.nightTime}\` giây`,
          inline: true,
        },
        {
          name: 'Thời gian Thảo luận',
          value: `\`${settings.discussTime}\` giây`,
          inline: true,
        },
        {
          name: 'Thời gian Vote treo cổ',
          value: `\`${settings.voteTime}\` giây`,
          inline: true,
        },
      )
      .setFooter({ text: 'Chỉ Admin có thể thay đổi cài đặt' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('edit_settings')
        .setLabel('Điều chỉnh cài đặt')
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.reply({
      embeds: [settingsEmbed],
      components: [row],
    });
  },
};
