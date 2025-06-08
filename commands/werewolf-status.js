const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { gameRooms } = require('../core/room');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Xem trạng thái phòng chơi Ma Sói trong server'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const gameRoom = gameRooms.get(guildId);

    if (!gameRoom) {
      const noGameEmbed = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setTitle('🎮 TRẠNG THÁI PHÒNG CHƠI')
        .setDescription('```⚠️ Hiện không có phòng Ma Sói nào trong server!```')
        .addFields(
          {
            name: '💡 Tạo Phòng Mới',
            value: 'Sử dụng lệnh `/masoi-create` để tạo phòng mới và bắt đầu trò chơi.'
          }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [noGameEmbed], ephemeral: true });
      return;
    }

    const host = await interaction.client.users.fetch(gameRoom.hostId);
    const playerCount = gameRoom.players.length;
    const aliveCount = gameRoom.players.filter(p => p.alive).length;
    const deadCount = playerCount - aliveCount;

    let statusEmbed = new EmbedBuilder()
      .setColor(gameRoom.status === 'waiting' ? 0x3498db : 0xe74c3c)
      .setTitle('🎮 TRẠNG THÁI PHÒNG CHƠI')
      .setTimestamp();

    if (gameRoom.status === 'waiting') {
      const playerList = await Promise.all(
        gameRoom.players.map(async (player) => {
          const user = await interaction.client.users.fetch(player.userId);
          return `• ${user.username}`;
        })
      );

      statusEmbed
        .setDescription('```🟢 Phòng đang chờ người chơi tham gia...```')
        .addFields(
          {
            name: '👑 Chủ Phòng',
            value: `${host.username}`,
            inline: true
          },
          {
            name: '👥 Số Người Chơi',
            value: `${playerCount}/18`,
            inline: true
          },
          {
            name: '⌛ Trạng Thái',
            value: 'Đang chờ',
            inline: true
          },
          {
            name: '📋 Danh Sách Người Chơi',
            value: playerList.length > 0 ? playerList.join('\n') : 'Chưa có người chơi nào',
          }
        )
        .setFooter({ text: '💡 Sử dụng /masoi-join để tham gia phòng' });
    } else if (gameRoom.status === 'starting') {
      statusEmbed
        .setDescription('```🔴 Trò chơi đang diễn ra...```')
        .addFields(
          {
            name: '👑 Chủ Phòng',
            value: `${host.username}`,
            inline: true
          },
          {
            name: '👥 Tổng Số Người Chơi',
            value: `${playerCount}`,
            inline: true
          },
          {
            name: '⌛ Trạng Thái',
            value: 'Đang chơi',
            inline: true
          },
          {
            name: '❤️ Còn Sống',
            value: `${aliveCount}`,
            inline: true
          },
          {
            name: '💀 Đã Chết',
            value: `${deadCount}`,
            inline: true
          },
          {
            name: '🌙 Đêm Thứ',
            value: `${gameRoom.gameState.nightCount}`,
            inline: true
          }
        )
        .setFooter({ text: '🎲 Game đang diễn ra, hãy đợi ván sau để tham gia' });
    } else if (gameRoom.status === 'ended') {
      statusEmbed
        .setDescription('```🔵 Trò chơi đã kết thúc```')
        .addFields(
          {
            name: '👑 Chủ Phòng Cũ',
            value: `${host.username}`,
            inline: true
          },
          {
            name: '👥 Số Người Đã Chơi',
            value: `${playerCount}`,
            inline: true
          },
          {
            name: '⌛ Trạng Thái',
            value: 'Đã kết thúc',
            inline: true
          }
        )
        .setFooter({ text: '💡 Sử dụng /masoi-create để tạo phòng mới' });
    }

    await interaction.reply({ embeds: [statusEmbed], ephemeral: true });
  },
}; 