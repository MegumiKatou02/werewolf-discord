import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type Interaction,
  PermissionsBitField,
  MessageFlags,
} from 'discord.js';

import { gameRooms } from '../core/room.js';

export default {
  data: new SlashCommandBuilder()
    .setName('masoi-kick')
    .setDescription('Kick một người chơi ra khỏi phòng')
    .addUserOption((option) =>
      option
        .setName('player')
        .setDescription('Người chơi cần kick')
        .setRequired(true),
    ),

  async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (!interaction.inGuild()) {
      return await interaction.reply({
        content: 'Lệnh này chỉ sử dụng được trong server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const guildId = interaction.guildId;
    const room = gameRooms.get(guildId);

    if (!room) {
      return await interaction.reply({
        content: '❌ Không có phòng nào đang mở.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (room.status !== 'waiting') {
      return await interaction.reply({
        content: '❌ Không thể kick người chơi khi game đã bắt đầu.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const isAdmin =
      interaction.member?.permissions instanceof PermissionsBitField &&
      interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const isDev = interaction.user.id === process.env.DEVELOPER;

    if (interaction.user.id !== room.hostId && !isAdmin && !isDev) {
      return await interaction.reply({
        content: '❌ Chỉ host/admin/dev mới có thể kick người chơi.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const targetUser = interaction.options.getUser('player');
    if (!targetUser || !room.hasPlayer(targetUser.id)) {
      return await interaction.reply({
        content: '❌ Người chơi này không có trong phòng.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (targetUser.id === room.hostId) {
      return await interaction.reply({
        content: '❌ Không thể kick host.',
        flags: MessageFlags.Ephemeral,
      });
    }

    room.removePlayer(targetUser.id);
    await interaction.reply(
      `✅ Đã kick **${targetUser.globalName}** ra khỏi phòng.`,
    );
  },
};
