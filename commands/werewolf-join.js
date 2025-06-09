const { SlashCommandBuilder } = require('discord.js');
const { gameRooms } = require('../core/room');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('masoi-join')
    .setDescription('Tham gia 1 trò chơi ma sói đang chờ'),

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

    if (room.status !== 'waiting') {
      return interaction.reply({
        content:
          'Trò chơi đã bắt đầu, không thể tham gia. Bạn có thể kiểm tra bằng `/status`',
        ephemeral: true,
      });
    }

    if (room.hasPlayer(userId)) {
      return interaction.reply({
        content: 'Bạn đã tham gia trò chơi rồi',
        ephemeral: true,
      });
    }

    await room.addPlayer(userId);
    gameRooms.set(guildId, room);

    return interaction.reply({
      content: `✅ <@${userId}> đã tham gia phòng! Hiện có ${room.players.length} người`,
      emphemeral: false,
    });
  },
};
