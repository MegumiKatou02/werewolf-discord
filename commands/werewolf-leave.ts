import { SlashCommandBuilder, type Interaction } from 'discord.js';
import { MessageFlags } from 'discord.js';

import { gameRooms } from '../core/room.js';

export default {
  data: new SlashCommandBuilder()
    .setName('masoi-leave')
    .setDescription('Rời khỏi trò chơi đang chờ'),

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

    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    if (!gameRooms.has(guildId)) {
      return interaction.reply({
        content: 'Không có trò chơi ma sói nào đang chờ trong server',
        flags: MessageFlags.Ephemeral,
      });
    }

    const room = gameRooms.get(guildId);

    if (!room) {
      return interaction.reply({
        content: 'Không tìm thấy phòng ma sói trong server này',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!room.hasPlayer(userId)) {
      return interaction.reply({
        content: 'Bạn chưa tham gia phòng chơi nào trong server này.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (room.status === 'starting') {
      return interaction.reply({
        content: 'Trò chơi đã bắt đầu, bạn không thể rời.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // remove player
    room.removePlayer(userId);

    await interaction.reply({
      content: `Bạn đã rời khỏi phòng chơi ma sói, ${room.players.length <= 0 ? 'không còn lại ai cả' : `còn lại ${room.players.length} người`}`,
      ephemeral: false,
    });

    if (room.players.length === 0) {
      gameRooms.delete(guildId);

      return interaction.channel?.send(
        'Không còn ai trong phòng nên phòng đã bị hủy',
      );
    }

    gameRooms.set(guildId, room);
  },
};
