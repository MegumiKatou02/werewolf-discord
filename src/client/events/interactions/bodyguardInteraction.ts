import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type Interaction,
  Client,
  MessageFlags,
} from 'discord.js';

import type { GameRoom } from '../../../../core/room.js';
import type Player from '../../../../types/player.js';
import Bodyguard from '../../../../types/roles/Bodyguard.js';
import { WEREROLE } from '../../../../utils/role.js';

class BodyguardInteraction {
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
      .setCustomId(`submit_protect_bodyguard_${playerId}`)
      .setTitle('Chọn người cần bảo vệ');

    const input = new TextInputBuilder()
      .setCustomId('protect_index_bodyguard')
      .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: 3')
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);

    await interaction.showModal(modal);
  };
  isModalSubmit = async (
    interaction: Interaction,
    gameRoom: GameRoom,
    sender: Player,
    client: Client,
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

    const protectIndexStr = interaction.fields.getTextInputValue(
      'protect_index_bodyguard',
    );
    const protectIndex = parseInt(protectIndexStr, 10);

    if (
      isNaN(protectIndex) ||
      protectIndex < 1 ||
      protectIndex > gameRoom.players.length
    ) {
      return interaction.reply({
        content: 'Số thứ tự không hợp lệ.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const targetPlayer = gameRoom.players[protectIndex - 1];
    if (
      sender.role &&
      sender.role.id === WEREROLE.BODYGUARD &&
      sender.role instanceof Bodyguard
    ) {
      if (!targetPlayer.alive) {
        return interaction.reply({
          content: 'Không có tác dụng lên người chết',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (sender.role.protectedCount <= 0) {
        return interaction.reply({
          content: 'Bạn đã hết lượt dùng chức năng',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (targetPlayer.userId === sender.userId) {
        return interaction.reply({
          content: 'Bạn đã tự bảo vệ bản thân rồi, không cần bảo vệ tiếp nữa',
          flags: MessageFlags.Ephemeral,
        });
      }

      // sender.role.protectedCount -= 1; lỡ chọn lại
      sender.role.protectedPerson = targetPlayer.userId;
    }

    try {
      const user = await client.users.fetch(playerId);
      await user.send(`🥋 Bạn đã bảo vệ: **${targetPlayer.name}**.`);
    } catch (err) {
      console.error(`Không thể gửi DM cho ${playerId}:`, err);
    }

    await interaction.reply({
      content: '✅ Bảo vệ thành công.',
      flags: MessageFlags.Ephemeral,
    });
  };
}

export default new BodyguardInteraction();
