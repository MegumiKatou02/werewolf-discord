import {
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  type Interaction,
  MessageFlags,
} from 'discord.js';

import type { GameRoom } from '../../../../core/room.js';
import type Player from '../../../../types/player.js';
import Loudmouth from '../../../../types/roles/loudmouth.js';
import { WEREROLE } from '../../../../utils/role.js';

class LoudmouthInteraction {
  isButton = async (interaction: Interaction) => {
    if (!interaction.isButton()) {
      return;
    }

    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được nhấn nút này.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`submit_choose_loudmouth_player_${playerId}`)
      .setTitle('Chọn người chơi');

    const input = new TextInputBuilder()
      .setCustomId('player_index_loudmouth')
      .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: 3')
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);

    try {
      await interaction.showModal(modal);
    } catch (err) {
      console.error('❌ Lỗi khi showModal:', err);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Tương tác đã hết hạn hoặc xảy ra lỗi. Vui lòng thử lại.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  };

  isModalSubmit = async (
    interaction: Interaction,
    gameRoom: GameRoom,
    sender: Player,
  ) => {
    if (!interaction.isModalSubmit()) {
      return;
    }

    if (!gameRoom || gameRoom.gameState.phase !== 'night') {
      return;
    }

    const playerId = interaction.customId.split('_')[4];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được gửi form này.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const masterIndexStr =
      interaction.fields.getTextInputValue('player_index_loudmouth');
    const masterIndex = parseInt(masterIndexStr, 10);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (
      isNaN(masterIndex) ||
      masterIndex < 1 ||
      masterIndex > gameRoom.players.length
    ) {
      return interaction.editReply({
        content: 'Số thứ tự không hợp lệ.',
      });
    }

    const targetPlayer = gameRoom.players[masterIndex - 1];
    if (
      sender.role &&
      sender.role.id === WEREROLE.LOUDMOUTH &&
      sender.role instanceof Loudmouth
    ) {
      if (!targetPlayer.alive) {
        return interaction.editReply({
          content: 'Không thể chọn người chết.',
        });
      }

      sender.role.revealPlayer = targetPlayer.userId;
    }

    try {
      const user = await gameRoom.fetchUser(playerId);
      if (user) {
        await user.send(`Bạn đã chọn **${targetPlayer.name}** để lộ vai trò khi bạn chết.`);
      }
    } catch (err) {
      console.error(`Không thể gửi DM cho ${playerId}:`, err);
    }

    await interaction.editReply({
      content: '✅ Chọn người chơi thành công.',
    });
  };
}

export default new LoudmouthInteraction();
