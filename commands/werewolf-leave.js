const { SlashCommandBuilder } = require('discord.js');
const { gameRooms } = require('../core/room');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('masoi-leave')
    .setDescription('Rời khỏi trò chơi đang chờ'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    if (!gameRooms.has(guildId)) {
      return interaction.reply({
        content: 'Không có trò chơi ma sói nào đang chờ trong server',
        ephemeral: true,
      });
    }

    const room = gameRooms.get(guildId);

    if (!room.hasPlayer(userId)) {
      return interaction.reply({
        content: 'Bạn chưa tham gia phòng chơi nào trong server này.',
        ephemeral: true,
      });
    }

    if (room.status === 'starting') {
      return interaction.reply({
        content: 'Trò chơi đã bắt đầu, bạn không thể rời.',
        ephemeral: true,
      });
    }

    // remove player
    room.removePlayer(userId);

    if (room.players.length === 0) {
      gameRooms.delete(guildId);

      await interaction.reply({
        content: 'Bạn đã rời khỏi phòng chơi ma sói',
        ephemeral: true,
      });

      return interaction.channel.send(
        'Không còn ai trong phòng nên phòng đã bị hủy'
      );
    }

    gameRooms.set(guildId, room);

    return interaction.reply({
      content: 'Bạn đã rời khỏi phòng chơi ma sói',
      ephemeral: true,
    });
  },
};
