const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { gameRooms } = require('../core/room');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('masoi-kick')
    .setDescription('Kick một người chơi ra khỏi phòng')
    .addUserOption((option) =>
      option
        .setName('player')
        .setDescription('Người chơi cần kick')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return await interaction.reply({
        content: 'Lệnh này chỉ sử dụng được trong server.',
        ephemeral: true,
      });
    }

    const guildId = interaction.guildId;
    const room = gameRooms.get(guildId);

    if (!room) {
      return await interaction.reply({
        content: '❌ Không có phòng nào đang mở.',
        ephemeral: true,
      });
    }

    if (room.status !== 'waiting') {
      return await interaction.reply({
        content: '❌ Không thể kick người chơi khi game đã bắt đầu.',
        ephemeral: true,
      });
    }

    const member = interaction.member;
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

    if (interaction.user.id !== room.hostId && !isAdmin) {
      return await interaction.reply({
        content: '❌ Chỉ host hoặc admin mới có thể kick người chơi.',
        ephemeral: true,
      });
    }

    const targetUser = interaction.options.getUser('player');
    if (!room.hasPlayer(targetUser.id)) {
      return await interaction.reply({
        content: '❌ Người chơi này không có trong phòng.',
        ephemeral: true,
      });
    }

    if (targetUser.id === room.hostId) {
      return await interaction.reply({
        content: '❌ Không thể kick host.',
        ephemeral: true,
      });
    }

    room.removePlayer(targetUser.id);
    await interaction.reply(
      `✅ Đã kick **${targetUser.globalName}** ra khỏi phòng.`
    );
  },
};
