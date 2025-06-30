import {
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  type Interaction,
  Client,
} from 'discord.js';

import type { GameRoom } from '../../../../core/room.js';
import type Player from '../../../../types/player.js';
import Witch from '../../../../types/roles/Witch.js';
import { WEREROLE } from '../../../../utils/role.js';

class WitchInteraction {
  isButtonPoison = async (interaction: Interaction, gameRoom: GameRoom) => {
    if (!interaction.isButton()) {
      return;
    }

    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được nhấn nút này.',
        ephemeral: true,
      });
    }
    try {
      const witch = gameRoom.players.find(
        (p: Player) => p.role?.id === WEREROLE.WITCH,
      );

      if (witch && witch.role instanceof Witch && witch.role.healedPerson) {
        return interaction.reply({
          content: 'Bạn không thể dùng 2 bình trong 1 đêm.',
          ephemeral: true,
        });
      }
    } catch (err) {
      console.error('❌ Lỗi khi fetch user:', err);
      return interaction.reply({
        content: 'Không tìm thấy người chơi.',
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`submit_poison_witch_${playerId}`)
      .setTitle('Chọn người chơi để dùng thuốc');

    const input = new TextInputBuilder()
      .setCustomId('poison_index_witch')
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
          ephemeral: true,
        });
      }
    }
  };

  isButtonHeal = async (interaction: Interaction, gameRoom: GameRoom) => {
    if (!interaction.isButton()) {
      return;
    }

    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được nhấn nút này.',
        ephemeral: true,
      });
    }

    try {
      const witch = gameRoom.players.find(
        (p: Player) => p.role?.id === WEREROLE.WITCH,
      );

      if (witch && witch.role instanceof Witch && witch.role.poisonedPerson) {
        return interaction.reply({
          content: 'Bạn không thể dùng 2 bình trong 1 đêm.',
          ephemeral: true,
        });
      }
    } catch (err) {
      console.error('❌ Lỗi khi fetch user:', err);
      return interaction.reply({
        content: 'Không tìm thấy người chơi.',
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`submit_heal_witch_${playerId}`)
      .setTitle('Chọn người chơi để cứu');

    const input = new TextInputBuilder()
      .setCustomId('heal_index_witch')
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
          ephemeral: true,
        });
      }
    }
  };

  isModalSubmitPoison = async (
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
        ephemeral: true,
      });
    }

    const pointIndexStr =
      interaction.fields.getTextInputValue('poison_index_witch');
    const pointIndex = parseInt(pointIndexStr, 10);

    if (
      isNaN(pointIndex) ||
      pointIndex < 1 ||
      pointIndex > gameRoom.players.length
    ) {
      return interaction.reply({
        content: 'Số thứ tự không hợp lệ.',
        ephemeral: true,
      });
    }

    const targetPlayer = gameRoom.players[pointIndex - 1];
    if (
      sender.role &&
      sender.role.id === WEREROLE.WITCH &&
      sender.role instanceof Witch
    ) {
      if (!targetPlayer.alive) {
        return interaction.reply({
          content: 'Không có tác dụng lên người chết',
          ephemeral: true,
        });
      }

      if (sender.role.poisonCount <= 0) {
        return interaction.reply({
          content: 'Bạn đã hết lượt dùng chức năng',
          ephemeral: true,
        });
      }

      if (targetPlayer.userId === sender.userId) {
        return interaction.reply({
          content: 'Bạn không thể chọn chính bản thân bạn.',
          ephemeral: true,
        });
      }

      // sender.role.poisonCount -= 1; // lỡ chọn lại
      sender.role.poisonedPerson = targetPlayer.userId;
    }

    try {
      const user = await client.users.fetch(playerId);
      await user.send(
        `💉 Bạn đã chọn người chơi để dùng thuốc: **${targetPlayer.name}**.`,
      );
    } catch (err) {
      console.error(`Không thể gửi DM cho ${playerId}:`, err);
    }

    await interaction.reply({
      content: '✅ Chọn người chơi thành công.',
      ephemeral: true,
    });
  };
  isModalSubmitHeal = async (
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
        ephemeral: true,
      });
    }

    const healIndexStr =
      interaction.fields.getTextInputValue('heal_index_witch');
    const healIndex = parseInt(healIndexStr, 10);

    if (
      isNaN(healIndex) ||
      healIndex < 1 ||
      healIndex > gameRoom.players.length
    ) {
      return interaction.reply({
        content: 'Số thứ tự không hợp lệ.',
        ephemeral: true,
      });
    }

    const targetPlayer = gameRoom.players[healIndex - 1];
    if (
      sender.role &&
      sender.role.id === WEREROLE.WITCH &&
      sender.role instanceof Witch
    ) {
      if (!targetPlayer.alive) {
        return interaction.reply({
          content: 'Không có tác dụng lên người chết',
          ephemeral: true,
        });
      }

      if (sender.role.healCount <= 0) {
        return interaction.reply({
          content: 'Bạn đã hết lượt dùng chức năng',
          ephemeral: true,
        });
      }
      if (targetPlayer.userId === sender.userId) {
        return interaction.reply({
          content: 'Bạn không thể cứu chính bản thân bạn.',
          ephemeral: true,
        });
      }

      if (targetPlayer.userId !== sender.role.needHelpPerson) {
        return interaction.reply({
          content: 'Bạn chỉ có thể cứu người chơi đã được yêu cầu giúp đỡ.',
          ephemeral: true,
        });
      }

      sender.role.healCount -= 1; // cứu rồi không cứu lại được nữa
      sender.role.healedPerson = targetPlayer.userId;
    }

    try {
      const user = await client.users.fetch(playerId);
      await user.send(
        `💫 Bạn đã chọn người chơi để cứu: **${targetPlayer.name}**.`,
      );
    } catch (err) {
      console.error(`Không thể gửi DM cho ${playerId}:`, err);
    }

    await interaction.reply({
      content: '✅ Chọn người chơi thành công.',
      ephemeral: true,
    });
  };
}

export default new WitchInteraction();
