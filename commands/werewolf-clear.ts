import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  type Interaction,
  type MessageComponentInteraction,
  PermissionsBitField,
} from 'discord.js';
import { MessageFlags } from 'discord.js';

import { gameRooms } from '../core/room.js';

export default {
  data: new SlashCommandBuilder()
    .setName('clear-room')
    .setDescription('Xóa phòng chơi Ma Sói trong server'),

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
      return interaction.reply({
        content: '❌ Không có phòng chơi nào trong server này.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const isAdmin =
      (interaction.member?.permissions instanceof PermissionsBitField &&
        interaction.member.permissions.has(
          PermissionFlagsBits.Administrator,
        )) ??
      false;
    const isHost = gameRoom.hostId === interaction.user.id;
    const isDev = interaction.user.id === process.env.DEVELOPER;

    if (!isAdmin && !isHost && !isDev) {
      return interaction.reply({
        content: '❌ Chỉ Admin/Host/Dev mới có thể xóa phòng.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (gameRoom.status === 'starting') {
      return interaction.reply({
        content: '❌ Không thể xóa phòng chơi khi trò chơi đã bắt đầu!',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (gameRoom.status === 'ended') {
      gameRooms.delete(guildId);
      return interaction.reply({
        content: '✅ Đã xóa phòng chơi.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const warningEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⚠️ Cảnh Báo Xóa Phòng')
      .setDescription('```Bạn có chắc chắn muốn xóa phòng chơi không?```')
      .addFields(
        {
          name: '📊 Trạng Thái Phòng',
          value: `\`${gameRoom.status === 'waiting' ? '⌛ Đang chờ' : '🎮 Đang chơi'}\``,
          inline: true,
        },
        {
          name: '👥 Số Người Chơi',
          value: `\`${gameRoom.players.length}\``,
          inline: true,
        },
      )
      .setFooter({ text: '⚠️ Hành động này không thể hoàn tác!' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_clear_room')
        .setLabel('✅ Xác Nhận Xóa')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('cancel_clear_room')
        .setLabel('❌ Hủy')
        .setStyle(ButtonStyle.Secondary),
    );

    const response = await interaction.reply({
      embeds: [warningEmbed],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });

    const collector = response.createMessageComponentCollector({
      time: 30000,
    });

    collector.on('collect', async (i: MessageComponentInteraction) => {
      try {
        if (i.user.id !== interaction.user.id) {
          await i.reply({
            content: '❌ Bạn không thể sử dụng nút này.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const INTERACTION_TIMEOUT = 15 * 60 * 1000;
        const now = Date.now();
        if ((now - i.createdTimestamp) > INTERACTION_TIMEOUT) {
          console.warn('Interaction đã hết hạn, bỏ qua xử lý');
          return;
        }

        if (i.customId === 'confirm_clear_room') {
          gameRooms.delete(guildId);
          await i.update({
            content: '✅ Đã xóa phòng chơi thành công.',
            embeds: [],
            components: [],
          });

          const channel = interaction.channel;
          if (channel) {
            channel.send(
              `✅ Phòng chơi trong server đã bị xóa bởi <@${i.user.id}>.`,
            );
          }
        } else if (i.customId === 'cancel_clear_room') {
          await i.update({
            content: '❌ Đã hủy xóa phòng.',
            embeds: [],
            components: [],
          });
        }

        collector.stop();
      } catch (error) {
        console.error('Lỗi xử lý clear interaction:', error);
        console.error('CustomId:', i.customId);
        console.error('User:', i.user?.tag);
      }
    });

    collector.on('end', async (_, reason: string) => {
      if (reason === 'time') {
        await interaction.editReply({
          content: '⌛ Đã hết thời gian xác nhận.',
          embeds: [],
          components: [],
        });
      }
    });
  },
};
