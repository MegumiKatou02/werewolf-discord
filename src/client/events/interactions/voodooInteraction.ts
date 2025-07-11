import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type Interaction,
  MessageFlags,
} from 'discord.js';

import type { GameRoom } from '../../../../core/room.js';
import { Faction } from '../../../../types/faction.js';
import type Player from '../../../../types/player.js';
import VoodooWerewolf from '../../../../types/roles/VoodooWerewolf.js';
import { WEREROLE } from '../../../../utils/role.js';

class VoodooInteraction {
  isButtonSilent = async (interaction: Interaction) => {
    if (!interaction.isButton()) {
      return;
    }

    const playerId = interaction.customId.split('_')[2];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được nhấn nút này.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`submit_voodoo_silent_${playerId}`)
      .setTitle('Làm câm lặng');

    const input = new TextInputBuilder()
      .setCustomId('voodoo_silent_input')
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
  isModalSubmitSilent = async (
    interaction: Interaction,
    gameRoom: GameRoom,
    sender: Player,
  ) => {
    if (!interaction.isModalSubmit()) {
      return;
    }

    if (!gameRoom || gameRoom.gameState.phase !== 'day') {
      return;
    }

    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được gửi form này.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const voteIndex = parseInt(interaction.fields.getTextInputValue('voodoo_silent_input'));

    if (isNaN(voteIndex) || voteIndex < 1 || voteIndex > gameRoom.players.length) {
      return interaction.editReply({
        content: 'Số thứ tự không hợp lệ.',
      });
    }

    const targetPlayer = gameRoom.players[voteIndex - 1];

    if (
      sender.role &&
            sender.role.id === WEREROLE.VOODOO &&
            sender.role instanceof VoodooWerewolf
    ) {
      if (!targetPlayer.alive) {
        return interaction.editReply({
          content: 'Không thể làm câm lặng người đã chết.',
        });
      }

      if (targetPlayer.userId === sender.userId) {
        return interaction.editReply({
          content: 'Bạn không thể làm câm lặng chính mình.',
        });
      }

      if (sender.role.silentCount <= 0) {
        return interaction.editReply({
          content: 'Bạn đã hết lượt dùng chức năng.',
        });
      }

      sender.role.silentCount -= 1;
      sender.role.silentPlayer = targetPlayer.userId;
      targetPlayer.canChat = targetPlayer.canVote = false;
    }

    try {
      const user = await gameRoom.fetchUser(playerId);
      if (user) {
        await user.send(`🔇 Bạn đã chọn người chơi để làm câm lặng: **${targetPlayer.name}**.`);
      }
    } catch (err) {
      console.error(`Không thể gửi DM cho ${playerId}:`, err);
    }

    await interaction.editReply({
      content: '✅ Làm câm lặng thành công.',
    });
  };
  isButtonVoodoo = async (interaction: Interaction) => {
    if (!interaction.isButton()) {
      return;
    }

    const playerId = interaction.customId.split('_')[2];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được nhấn nút này.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`submit_voodoo_voodoo_${playerId}`)
      .setTitle('Ác mộng');

    const input = new TextInputBuilder()
      .setCustomId('voodoo_voodoo_input')
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
  isModalSubmitVoodoo = async (
    interaction: Interaction,
    gameRoom: GameRoom,
    sender: Player,
  ) => {
    if (!interaction.isModalSubmit()) {
      return;
    }

    if (!gameRoom || gameRoom.gameState.phase !== 'day') {
      return;
    }

    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được gửi form này.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const voteIndex = parseInt(interaction.fields.getTextInputValue('voodoo_voodoo_input'));

    if (isNaN(voteIndex) || voteIndex < 1 || voteIndex > gameRoom.players.length) {
      return interaction.editReply({
        content: 'Số thứ tự không hợp lệ.',
      });
    }

    const targetPlayer = gameRoom.players[voteIndex - 1];

    if (
      sender.role &&
            sender.role.id === WEREROLE.VOODOO &&
            sender.role instanceof VoodooWerewolf
    ) {
      if (!targetPlayer.alive) {
        return interaction.editReply({
          content: 'Không thể ác mộng người đã chết.',
        });
      }

      if (targetPlayer.userId === sender.userId) {
        return interaction.editReply({
          content: 'Bạn không thể ác mộng chính mình.',
        });
      }

      if (targetPlayer.role.faction === Faction.WEREWOLF) {
        return interaction.editReply({
          content: 'Không thể ác mộng sói.',
        });
      }

      if (sender.role.voodooCount <= 0) {
        return interaction.editReply({
          content: 'Bạn đã hết lượt dùng chức năng.',
        });
      }

      sender.role.voodooCount -= 1;
      sender.role.voodooPlayer = targetPlayer.userId;
      sender.canUseSkill = false;
    }

    try {
      const user = await gameRoom.fetchUser(playerId);
      if (user) {
        await user.send(`🌘 Bạn đã chọn người chơi để ác mộng: **${targetPlayer.name}**.`);
      }
    } catch (err) {
      console.error(`Không thể gửi DM cho ${playerId}:`, err);
    }

    await interaction.editReply({
      content: '✅ Ác mộng thành công.',
    });
  };
}

export default new VoodooInteraction();
