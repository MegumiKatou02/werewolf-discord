const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { gameRooms } = require('../core/room');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('masoi-start')
    .setDescription('Bắt đầu chơi game'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;

    if (!gameRooms.has(guildId)) {
      return interaction.editReply(
        'Chưa có phòng chơi, hãy để người chơi tham gia trước.'
      );
    }

    const room = gameRooms.get(guildId);

    if (room.status !== 'waiting') {
      return interaction.editReply('Trò chơi đã bắt đầu hoặc kết thúc.');
    }

    const member = interaction.member;
    const isAdmin = member.permissions.has(
      PermissionsBitField.Flags.Administrator
    );
    const isHost = interaction.user.id === room.hostId;

    if (!isAdmin && !isHost) {
      return interaction.editReply({
        content: '❌ Chỉ host hoặc admin mới được phép bắt đầu trò chơi.',
        ephemeral: true,
      });
    }

    try {
      await room.startGame(interaction);
      return interaction.followUp({
        content: `${interaction.user.globalName || interaction.user.username} đã bắt đầu trò chơi! Vai trò đã được chia.`,
        ephemeral: false,
      });
    } catch (err) {
      return interaction.editReply(`Lỗi: ${err.message}`);
    }
  },
};
