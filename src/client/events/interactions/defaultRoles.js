class DefaultRoles {
  isButton = async (interaction, gameRooms) => {
    const guildId = interaction.guildId;
    const room = gameRooms.get(guildId);

    await interaction.deferReply({ ephemeral: true });

    if (!room) {
      return interaction.editReply({
        content: 'Không tìm thấy phòng chơi.',
      });
    }

    try {
      await room.startGame(interaction);
      return interaction.editReply({
        content: `✅ ${interaction.user.globalName || interaction.user.username} đã bắt đầu trò chơi với vai trò mặc định! Vai trò đã được chia.`,
      });
    } catch (err) {
      return interaction.editReply(`Lỗi: ${err.message}`);
    }
  };
}

module.exports = new DefaultRoles();
