import {
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  type Interaction,
} from 'discord.js';
import { MessageFlags } from 'discord.js';

import type { GameRoom } from '../../../../core/room.js';
import type Player from '../../../../types/player.js';

class VotingInteraction {
  isButtonVoteHanged = async (interaction: Interaction) => {
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
      .setCustomId(`submit_vote_hanged_${playerId}`)
      .setTitle('Vote người chơi để treo cổ');

    const input = new TextInputBuilder()
      .setCustomId('vote_index_hanged')
      .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: 3')
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);

    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.showModal(modal).catch(console.error);
      }
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

  isModalSubmitVoteHanged = async (
    interaction: Interaction,
    gameRoom: GameRoom,
    sender: Player,
  ) => {
    if (!gameRoom || !interaction.isModalSubmit()) {
      return;
    }

    if (gameRoom.gameState.phase === 'day') {
      return interaction.reply({
        content: 'Bạn chưa thể vote ngay lúc này',
        flags: MessageFlags.Ephemeral,
      });
    }

    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được gửi form này.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const voteIndexStr =
      interaction.fields.getTextInputValue('vote_index_hanged');
    const voteIndex = parseInt(voteIndexStr, 10);

    if (
      voteIndex !== 0 &&
      voteIndex !== 36 &&
      (isNaN(voteIndex) || voteIndex < 1 || voteIndex > gameRoom.players.length)
    ) {
      return interaction.reply({
        content: 'Số thứ tự không hợp lệ. Nhập 0 hoặc 36 để bỏ qua vote.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!sender.alive) {
      return interaction.reply({
        content: 'Người chết không thể vote.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (voteIndex === 0 || voteIndex === 36) {
      // Chắc chắn ai cũng có role
      sender.role.voteHanged = 'skip';
    } else {
      const targetPlayer = gameRoom.players[voteIndex - 1];

      if (targetPlayer.userId === sender.userId) {
        return interaction.reply({
          content: 'Bạn không thể vote chính mình.',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (!targetPlayer.alive) {
        return interaction.reply({
          content: 'Không thể vote người đã chết.',
          flags: MessageFlags.Ephemeral,
        });
      }

      sender.role.voteHanged = targetPlayer.userId;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const notifyMessages = gameRoom.players.map((player: Player) => ({
        userId: player.userId,
        content: player.userId !== playerId
          ? `✅ **${sender.name}** đã vote.`
          : voteIndex === 0 || voteIndex === 36
            ? '✅ Bạn đã chọn bỏ qua vote.'
            : `✅ Bạn đã vote treo cổ: **${gameRoom.players[voteIndex - 1].name}**.`,
      }));

      await gameRoom.batchSendMessages(notifyMessages);

      const alivePlayers = gameRoom.players.filter((p: Player) => p.alive);
      const allVoted = alivePlayers.every(
        (p: Player) => p.role.voteHanged !== null,
      );

      if (allVoted) {
        const endVoteMessages = gameRoom.players.map((player: Player) => ({
          userId: player.userId,
          content: '### ⚡ Tất cả mọi người đã vote xong! Kết quả sẽ được công bố ngay lập tức.',
        }));

        await gameRoom.batchSendMessages(endVoteMessages);
        gameRoom.emit('voteComplete');
      }
    } catch (err) {
      console.error(`Không thể gửi DM cho ${playerId}:`, err);
    }
    await interaction.editReply({
      content: '✅ Vote thành công.',
    });
  };
}

export default new VotingInteraction();
