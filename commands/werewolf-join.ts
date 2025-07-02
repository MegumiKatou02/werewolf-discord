import { MessageFlags, SlashCommandBuilder, type Interaction } from 'discord.js';

import { gameRooms } from '../core/room.js';

export default {
  data: new SlashCommandBuilder()
    .setName('masoi-join')
    .setDescription('Tham gia 1 trò chơi ma sói đang chờ'),

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

    if (room.status !== 'waiting') {
      return interaction.reply({
        content:
          'Trò chơi đã bắt đầu, không thể tham gia. Bạn có thể kiểm tra bằng `/status`',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (room.hasPlayer(userId)) {
      return interaction.reply({
        content: 'Bạn đã tham gia trò chơi rồi',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (interaction.channelId !== room.channelId) {
      return interaction.reply({
        content: `Trò chơi bắt đầu ở kênh <#${room.channelId}>, hãy vào kênh để dùng lệnh tham gia\nNếu không thấy kênh, hãy liên hệ <@${room.hostId}> hoặc ADMIN`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await room.addPlayer(userId);
    gameRooms.set(guildId, room);

    return interaction.reply({
      content: `✅ <@${userId}> đã tham gia phòng! Hiện có ${room.players.length} người`,
      ephemeral: false,
    });
  },
};
