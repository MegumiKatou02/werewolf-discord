import {
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  type Interaction,
  Client,
} from 'discord.js';
import type Player from '../../../../types/player.js';
import type { GameRoom } from '../../../../core/room.js';

class VotingInteraction {
  isButtonVoteHanged = async (interaction: Interaction) => {
    if (!interaction.isButton()) return;

    const playerId = interaction.customId.split('_')[2];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được nhấn nút này.',
        ephemeral: true,
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

  isModalSubmitVoteHanged = async (
    interaction: Interaction,
    gameRoom: GameRoom,
    sender: Player,
    client: Client
  ) => {
    if (!gameRoom || !interaction.isModalSubmit()) return;

    if (gameRoom.gameState.phase === 'day') {
      return interaction.reply({
        content: 'Bạn chưa thể vote ngay lúc này',
        ephemeral: true,
      });
    }

    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được gửi form này.',
        ephemeral: true,
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
        ephemeral: true,
      });
    }

    if (!sender.alive) {
      return interaction.reply({
        content: 'Người chết không thể vote.',
        ephemeral: true,
      });
    }

    if (voteIndex === 0 || voteIndex === 36) {
      // Chắc chắn ai cũng có role
      sender.role!.voteHanged = 'skip';
    } else {
      const targetPlayer = gameRoom.players[voteIndex - 1];

      if (targetPlayer.userId === sender.userId) {
        return interaction.reply({
          content: 'Bạn không thể vote chính mình.',
          ephemeral: true,
        });
      }

      if (!targetPlayer.alive) {
        return interaction.reply({
          content: 'Không thể vote người đã chết.',
          ephemeral: true,
        });
      }

      sender.role!.voteHanged = targetPlayer.userId;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const notifyPromises = gameRoom.players.map(async (player: Player) => {
        const targetUser = await client.users.fetch(player.userId);
        if (player.userId !== playerId) {
          return targetUser.send(`✅ **${sender.name}** đã vote.`);
        } else {
          if (voteIndex === 0 || voteIndex === 36) {
            return targetUser.send(`✅ Bạn đã chọn bỏ qua vote.`);
          } else {
            const targetPlayer = gameRoom.players[voteIndex - 1];
            return targetUser.send(
              `✅ Bạn đã vote treo cổ: **${targetPlayer.name}**.`
            );
          }
        }
      });

      await Promise.allSettled(notifyPromises);

      const alivePlayers = gameRoom.players.filter((p: Player) => p.alive);
      const allVoted = alivePlayers.every(
        (p: Player) => p.role?.voteHanged !== null
      );

      if (allVoted) {
        const notifyEndVote = gameRoom.players.map(async (player: Player) => {
          const user = await client.users.fetch(player.userId);
          return user.send(
            `### ⚡ Tất cả mọi người đã vote xong! Kết quả sẽ được công bố ngay lập tức.`
          );
        });
        await Promise.allSettled(notifyEndVote);

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
