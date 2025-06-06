const { SlashCommandBuilder } = require('discord.js');
const { gameRooms, GameRoom } = require('../core/room');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('masoi-create')
    .setDescription('Khởi tạo trò chơi ma sói'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (gameRooms.has(guildId)) {
      return interaction.reply({
        content: '⚠️ Phòng Ma Sói đã tồn tại trong server này',
        emphemeral: true,
      });
    }

    const room = new GameRoom(guildId, userId);
    room.addPlayer(userId);

    gameRooms.set(guildId, room);

    return interaction.reply({
      content: `✅ Phòng Ma Sói đã được tạo bởi <@${userId}>.\nDùng lệnh \`/masoi-join\` để tham gia.`,
      ephemeral: false,
    });
  },
};
