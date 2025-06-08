const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { gameRooms, GameRoom } = require('../core/room');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('masoi-create')
    .setDescription('Tạo phòng chơi Ma Sói mới'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const existingRoom = gameRooms.get(guildId);

    if (existingRoom) {
      if (existingRoom.status === 'ended') {
        gameRooms.delete(guildId);
      } else if (existingRoom.status === 'waiting') {
        await interaction.reply({
          content: '❌ Đã có phòng đang chờ người chơi trong server này!',
          ephemeral: true
        });
        return;
      } else if (existingRoom.status === 'starting') {
        await interaction.reply({
          content: '❌ Đã có game đang diễn ra trong server này!',
          ephemeral: true
        });
        return;
      }
    }

    const newRoom = new GameRoom(interaction.client, guildId, interaction.user.id);
    gameRooms.set(guildId, newRoom);
    newRoom.addPlayer(interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🎮 PHÒNG CHƠI MA SÓI MỚI')
      .setDescription('```🟢 Phòng đã được tạo thành công!```')
      .addFields(
        {
          name: '👑 Chủ Phòng',
          value: `${interaction.user.username}`,
          inline: true
        },
        {
          name: '👥 Số Người Chơi',
          value: '1/18',
          inline: true
        },
        {
          name: '⌛ Trạng Thái',
          value: 'Đang chờ',
          inline: true
        }
      )
      .setFooter({ text: '💡 Sử dụng /masoi-join để tham gia phòng' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
