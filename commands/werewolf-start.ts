import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Interaction,
  PermissionsBitField,
  MessageFlags,
} from 'discord.js';

import { gameRooms } from '../core/room.js';

export default {
  data: new SlashCommandBuilder()
    .setName('masoi-start')
    .setDescription('Bắt đầu chơi game'),

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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildId = interaction.guildId;

    if (!gameRooms.has(guildId)) {
      return interaction.editReply(
        'Chưa có phòng chơi, hãy để người chơi tham gia trước.',
      );
    }

    const room = gameRooms.get(guildId);

    if (!room) {
      return interaction.editReply(
        'Không tìm thấy phòng ma sói trong server này',
      );
    }

    if (room.status !== 'waiting') {
      return interaction.editReply('Trò chơi đã bắt đầu hoặc kết thúc.');
    }

    // const member = interaction.member;

    const isAdmin =
      (interaction.member?.permissions instanceof PermissionsBitField &&
        interaction.member.permissions.has(
          PermissionFlagsBits.Administrator,
        )) ??
      false;
    const isHost = interaction.user.id === room.hostId;
    const isDev = interaction.user.id === process.env.DEVELOPER;

    if (!isAdmin && !isHost && !isDev) {
      return interaction.editReply({
        content: '❌ Chỉ host/admin/dev mới được phép bắt đầu trò chơi.',
      });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('use_default_roles')
        .setLabel('Dùng vai trò mặc định')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('customize_roles_json')
        .setLabel('Tuỳ chỉnh vai trò (JSON)')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('customize_roles_name')
        .setLabel('Tuỳ chỉnh vai trò (Tên)')
        .setStyle(ButtonStyle.Secondary),
    );

    return interaction.editReply({
      content: '🎮 Chọn cách phân vai trò:',
      components: [row],
    });
  },
};
