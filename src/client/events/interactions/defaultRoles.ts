import type { Interaction } from 'discord.js';

class DefaultRoles {
  isButton = async (interaction: Interaction, gameRooms: Map<string, any>) => {
    if (!interaction.isButton()) return;

    const guildId = interaction.guildId;
    if (!guildId) {
      throw new Error('Không tìm thấy guildId');
    }
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
      return interaction.editReply(`Lỗi: ${(err as Error).message}`);
    }
  };
}

export default new DefaultRoles();
