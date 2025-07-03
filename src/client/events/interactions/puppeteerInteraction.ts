import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type Interaction,
  MessageFlags,
  Client,
} from 'discord.js';

import type { GameRoom } from '../../../../core/room.js';
import type Player from '../../../../types/player.js';
import Puppeteer from '../../../../types/roles/Puppeteer.js';
import { WEREROLE } from '../../../../utils/role.js';
class PuppeteerInteraction {
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
      .setCustomId(`submit_puppeteer_${playerId}`)
      .setTitle('Chỉ định mục tiêu');

    const input = new TextInputBuilder()
      .setCustomId('puppeteer_target_puppeteer')
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

    const playerId = interaction.customId.split('_')[2];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được gửi form này.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const viewIndexStr = interaction.fields.getTextInputValue(
      'puppeteer_target_puppeteer',
    );
    const viewIndex = parseInt(viewIndexStr, 10);

    if (
      isNaN(viewIndex) ||
      viewIndex < 1 ||
      viewIndex > gameRoom.players.length
    ) {
      return interaction.reply({
        content: 'Số thứ tự không hợp lệ.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const targetPlayer = gameRoom.players[viewIndex - 1];

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (
      sender.role &&
      sender.role.id === WEREROLE.PUPPETEER &&
      sender.role instanceof Puppeteer
    ) {
      if (!targetPlayer.alive) {
        return interaction.editReply({
          content: 'Không có tác dụng lên người chết',
        });
      }

      // khác null
      if (sender.role.targetCount <= 0) {
        return interaction.editReply({
          content: 'Bạn đã hết lượt dùng chức năng',
        });
      }

      if (sender.userId === targetPlayer.userId) {
        return interaction.editReply({
          content: 'Bạn không thể chỉ định mục tiêu là chính mình.',
        });
      }

      sender.role.targetCount -= 1;
      sender.role.targetWolf = targetPlayer.userId;

      try {
        const user = await client.users.fetch(playerId);
        await user.send(`🐕‍🦺 Bạn chỉ định mục tiêu của sói là ${targetPlayer.name}`);
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }
    }

    await interaction.editReply({
      content: '✅ Chỉ định mục tiêu thành công.',
    });
  };
}

export default new PuppeteerInteraction();
