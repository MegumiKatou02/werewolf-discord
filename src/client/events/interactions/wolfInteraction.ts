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

class WolfInteraction {
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
      .setCustomId(`submit_vote_wolf_${playerId}`)
      .setTitle('Vote người chơi cần giết');

    const input = new TextInputBuilder()
      .setCustomId('vote_index_wolf')
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
      interaction.fields.getTextInputValue('vote_index_wolf');
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

    /**
     * Lí do không có check type sender.role.voteBite là string
     * sender.role.voteBite chưa set nên bị null
     */
    if (
      sender.role.faction === Faction.WEREWOLF &&
      'voteBite' in sender.role &&
      'biteCount' in sender.role &&
      typeof sender.role.biteCount === 'number'
    ) {
      if (!targetPlayer.alive) {
        return interaction.editReply({
          content: 'Không có tác dụng lên người chết',
        });
      }

      if (sender.role.biteCount <= 0) {
        return interaction.editReply({
          content: 'Bạn đã hết lượt dùng chức năng',
        });
      }

      if (targetPlayer.role.faction === Faction.WEREWOLF) {
        // FactionRole.Werewolf
        return interaction.editReply({
          content: 'Bạn không thể vote giết đồng minh của mình.',
        });
      }

      // sender.role.biteCount -= 1; lỡ chọn lại
      (sender.role.voteBite as string | null) = targetPlayer.userId;
    }

    try {
      const user = await gameRoom.fetchUser(playerId);
      if (user) {
        await user.send(`🔪 Bạn đã vote giết: **${targetPlayer.name}**.`);
      }

      const notifyMessages = gameRoom.players
        .filter(player => player.role.faction === Faction.WEREWOLF && player.alive && player.userId !== sender.userId).map((player: Player) => ({
          userId: player.userId,
          content: `🐺 **${sender.name}** đã vote giết: **${targetPlayer.name}**.`,
        }));
      await gameRoom.batchSendMessages(notifyMessages);
    } catch (err) {
      console.error(`Không thể gửi DM cho ${playerId}:`, err);
    }

    await interaction.editReply({
      content: '✅ Vote của bạn đã được ghi nhận.',
    });
  };
}

export default new WolfInteraction();
