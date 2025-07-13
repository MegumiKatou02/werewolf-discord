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
import Wolffluence from '../../../../types/roles/Wolffluencer.js';
import { WEREROLE } from '../../../../utils/role.js';

class WolffluenceInteraction {
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
      .setCustomId(`submit_ffluence_wolf_${playerId}`)
      .setTitle('Vote người chơi thao túng');

    const input = new TextInputBuilder()
      .setCustomId('vote_index_ffluence')
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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.editReply({
        content: 'Bạn không được gửi form này.',
      });
    }

    const voteIndexStr =
      interaction.fields.getTextInputValue('vote_index_ffluence');
    const voteIndex = parseInt(voteIndexStr, 10);

    if (
      isNaN(voteIndex) ||
      voteIndex < 1 ||
      voteIndex > gameRoom.players.length
    ) {
      return interaction.editReply({
        content: 'Số thứ tự không hợp lệ.',
      });
    }

    const targetPlayer = gameRoom.players[voteIndex - 1];

    if (
      sender.role &&
      sender.role.id === WEREROLE.WOLFFLUENCE &&
      sender.role instanceof Wolffluence
    ) {
      if (!targetPlayer.alive) {
        return interaction.editReply({
          content: 'Không có tác dụng lên người chết',
        });
      }

      if (targetPlayer.role.faction === Faction.WEREWOLF) {
        return interaction.editReply({
          content: 'Bạn không thể thao túng đồng minh.',
        });
      }

      if (targetPlayer.userId === sender.userId) {
        return interaction.editReply({
          content: 'Bạn không thể thao túng chính bạn.',
        });
      }

      sender.role.influencePlayer = targetPlayer.userId;
    }

    try {
      const user = await gameRoom.fetchUser(playerId);
      if (user) {
        await user.send(`🪡 Bạn đã chọn người chơi để thao túng: **${targetPlayer.name}**.`);
      }
    } catch (err) {
      console.error(`Không thể gửi DM cho ${playerId}:`, err);
    }

    await interaction.editReply({
      content: '✅ Vote của bạn đã được ghi nhận.',
    });
  };
}

export default new WolffluenceInteraction();
