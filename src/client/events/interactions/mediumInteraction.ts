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
import Medium from '../../../../types/roles/Medium.js';
import { WEREROLE } from '../../../../utils/role.js';

class MediumInteraction {
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
      .setCustomId(`submit_revive_medium_${playerId}`)
      .setTitle('Hồi sinh người chơi');

    const input = new TextInputBuilder()
      .setCustomId('revive_index_medium')
      .setLabel('Số thứ tự người chết (bắt đầu từ 1)')
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

    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được gửi form này.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const reviveIndexStr = interaction.fields.getTextInputValue(
      'revive_index_medium',
    );
    const reviveIndex = parseInt(reviveIndexStr, 10);

    if (
      isNaN(reviveIndex) ||
      reviveIndex < 1 ||
      reviveIndex > gameRoom.players.length
    ) {
      return interaction.reply({
        content: 'Số thứ tự không hợp lệ.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const targetPlayer = gameRoom.players[reviveIndex - 1];
    if (
      sender.role &&
      sender.role.id === WEREROLE.MEDIUM &&
      sender.role instanceof Medium
    ) {
      if (sender.role.revivedCount <= 0) {
        return interaction.reply({
          content: 'Bạn đã hết lượt dùng chức năng',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (targetPlayer.alive) {
        return interaction.reply({
          content: 'Người chơi này vẫn còn sống, không thể hồi sinh.',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (targetPlayer.role.faction !== 1) {
        return interaction.reply({
          content:
            'Người chơi này không thuộc phe dân làng, không thể hồi sinh.',
          flags: MessageFlags.Ephemeral,
        });
      }

      // sender.role.revivedCount -= 1; // Lỡ chọn lại
      sender.role.revivedPerson = targetPlayer.userId;
    }

    try {
      const user = await gameRoom.fetchUser(playerId);
      if (user) {
        await user.send(`💫 Bạn đã chọn người chơi để hồi sinh: **${targetPlayer.name}**.`);
      }
    } catch (err) {
      console.error(`Không thể gửi DM cho ${playerId}:`, err);
    }
    await interaction.reply({
      content: '✅ Chọn người chơi thành công.',
      flags: MessageFlags.Ephemeral,
    });
  };
}

export default new MediumInteraction();
