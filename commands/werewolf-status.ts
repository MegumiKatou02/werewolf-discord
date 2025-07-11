import {
  SlashCommandBuilder,
  EmbedBuilder,
  type Interaction,
  MessageFlags,
} from 'discord.js';

import { gameRooms } from '../core/room.js';
import type Player from '../types/player.js';
export default {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Xem trạng thái phòng chơi Ma Sói'),

  async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (!interaction.inGuild()) {
      return await interaction.reply({
        content: 'Lệnh này chỉ sử dụng được trong server.',
        flags: MessageFlags.Ephemeral,
      });
    }

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
      .setColor(statusColors[gameRoom.status as keyof typeof statusColors])
      .setTitle(
        `${statusIcons[gameRoom.status as keyof typeof statusIcons]} PHÒNG MA SÓI ${gameRoom.status === 'starting' ? '#' + gameRoom.gameState.nightCount : ''}`,
      )
      .setDescription(
        gameRoom.status === 'waiting'
          ? '```ini\n[Phòng đang chờ người chơi tham gia...]\n```'
          : gameRoom.status === 'starting'
            ? '```fix\n[Trò chơi đang diễn ra...]\n```'
            : '```diff\n+ Trò chơi đã kết thúc\n```',
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
        },
      );

    if (gameRoom.status === 'starting') {
      const aliveCount = gameRoom.players.filter((p: Player) => p.alive).length;
      const deadCount = gameRoom.players.length - aliveCount;

      statusEmbed.addFields(
        {
          name: `${phaseIcons[gameRoom.gameState.phase as keyof typeof phaseIcons]} Phase Hiện Tại`,
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
        },
      );
    }

    const playersList = gameRoom.players
      .map((p: Player, index: number) => {
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
      waiting: '💡 Sử dụng /masoi-join để tham gia phòng',
      starting: '🎲 Game đang diễn ra, hãy đợi ván sau để tham gia',
      ended: '🔄 Sử dụng /masoi-create để tạo phòng mới',
    };

    statusEmbed.setFooter({
      text: footerText[gameRoom.status as keyof typeof footerText],
    });

    statusEmbed.setTimestamp();

    await interaction.reply({
      embeds: [statusEmbed],
    });
  },
};
