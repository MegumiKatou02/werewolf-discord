const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const { gameRooms } = require('../core/room');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Xem trạng thái phòng chơi Ma Sói'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const gameRoom = gameRooms.get(guildId);

    if (!gameRoom) {
      const noGameEmbed = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setTitle('🎮 TRẠNG THÁI PHÒNG MA SÓI')
        .setDescription('```⚠️ Hiện không có phòng Ma Sói nào trong server!```')
        .addFields({
          name: '💡 Hướng Dẫn',
          value:
            '> Sử dụng lệnh `/masoi-create` để tạo phòng mới\n> Sử dụng `/huongdan` để xem hướng dẫn chi tiết',
        })
        .setTimestamp()
        .setFooter({ text: 'Hẹ hẹ hẹ' });

      return interaction.reply({
        embeds: [noGameEmbed],
        ephemeral: false,
      });
    }

    const statusColors = {
      waiting: 0x3498db,
      starting: 0xe74c3c,
      ended: 0x2ecc71,
    };

    const statusIcons = {
      waiting: '⌛',
      starting: '🎯',
      ended: '🏁',
    };

    const phaseIcons = {
      night: '🌙',
      day: '☀️',
      voting: '🗳️',
    };

    const statusEmbed = new EmbedBuilder()
      .setColor(statusColors[gameRoom.status])
      .setTitle(
        `${statusIcons[gameRoom.status]} PHÒNG MA SÓI ${gameRoom.status === 'starting' ? '#' + gameRoom.gameState.nightCount : ''}`
      )
      .setDescription(
        gameRoom.status === 'waiting'
          ? '```ini\n[Phòng đang chờ người chơi tham gia...]\n```'
          : gameRoom.status === 'starting'
            ? '```fix\n[Trò chơi đang diễn ra...]\n```'
            : '```diff\n+ Trò chơi đã kết thúc\n```'
      )
      .addFields(
        {
          name: '👑 Chủ Phòng',
          value: `> <@${gameRoom.hostId}>`,
          inline: true,
        },
        {
          name: '👥 Số Người Chơi',
          value: `> ${gameRoom.players.length}${gameRoom.status === 'waiting' ? '/18' : ''}`,
          inline: true,
        }
      );

    if (gameRoom.status === 'starting') {
      const aliveCount = gameRoom.players.filter((p) => p.alive).length;
      const deadCount = gameRoom.players.length - aliveCount;

      statusEmbed.addFields(
        {
          name: `${phaseIcons[gameRoom.gameState.phase]} Phase Hiện Tại`,
          value: `> ${
            gameRoom.gameState.phase === 'night'
              ? 'Ban Đêm'
              : gameRoom.gameState.phase === 'day'
                ? 'Ban Ngày'
                : 'Bỏ Phiếu'
          }`,
          inline: true,
        },
        {
          name: '❤️ Còn Sống',
          value: `> ${aliveCount}`,
          inline: true,
        },
        {
          name: '💀 Đã Chết',
          value: `> ${deadCount}`,
          inline: true,
        }
      );
    }

    const playersList = gameRoom.players
      .map((p, index) => {
        const isHost = p.userId === gameRoom.hostId;
        const status = p.alive ? '🟢' : '💀';
        const number = String(index + 1).padStart(2, '0');
        return `\`${number}\` ${status} **${p.name}**${isHost ? ' 👑' : ''}`;
      })
      .join('\n');

    statusEmbed.addFields({
      name: '📋 Danh Sách Người Chơi',
      value: playersList || '> *Chưa có người chơi nào tham gia*',
    });

    const footerText = {
      waiting: '💡 Sử dụng /join để tham gia phòng',
      starting: '🎲 Game đang diễn ra, hãy đợi ván sau để tham gia',
      ended: '🔄 Sử dụng /create để tạo phòng mới',
    };

    statusEmbed.setFooter({
      text: footerText[gameRoom.status],
    });

    statusEmbed.setTimestamp();

    const components = [];

    if (gameRoom.status === 'ended') {
      const isAdmin = interaction.member.permissions.has(
        PermissionFlagsBits.Administrator
      );
      const isHost = gameRoom.hostId === interaction.user.id;

      if (isAdmin || isHost) {
        const viewLogButton = new ButtonBuilder()
          .setCustomId('view_game_log')
          .setLabel('📜 Xem Log Game')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(viewLogButton);
        components.push(row);
      }
    }

    const response = await interaction.reply({
      embeds: [statusEmbed],
      components,
      ephemeral: false,
    });

    if (components.length > 0) {
      const collector = response.createMessageComponentCollector({
        time: 60000,
      });

      collector.on('collect', async (i) => {
        if (i.customId === 'view_game_log') {
          const isAdmin = i.member.permissions.has(
            PermissionFlagsBits.Administrator
          );
          const isHost = gameRoom.hostId === i.user.id;

          if (!isAdmin && !isHost) {
            await i.reply({
              content: '❌ Chỉ Admin hoặc Host mới có thể xem log game.',
              ephemeral: true,
            });
            return;
          }

          const logEmbed = new EmbedBuilder()
            .setColor(statusColors.ended)
            .setTitle('📜 LOG GAME MA SÓI')
            .setDescription(
              gameRoom.gameState.log.join('\n') ||
                '*Không có log nào được ghi lại*'
            )
            .setTimestamp()
            .setFooter({
              text: '⚠️ Log game sẽ bị xóa khi phòng bị xóa',
            });

          await i.reply({
            embeds: [logEmbed],
            ephemeral: false,
          });
        }
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
          const disabledRow = new ActionRowBuilder().addComponents(
            ButtonBuilder.from(components[0].components[0])
              .setDisabled(true)
              .setLabel('📜 Log Game (Hết hạn)')
          );
          await interaction.editReply({
            components: [disabledRow],
          });
        }
      });
    }
  },
};
