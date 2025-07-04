import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type Interaction,
} from 'discord.js';
import { MessageFlags } from 'discord.js';

import type { GameRoom } from '../../../../core/room.js';
import type Player from '../../../../types/player.js';
import WolfSeer from '../../../../types/roles/WolfSeer.js';
import { WEREROLE } from '../../../../utils/role.js';

class WolfSeerInteraction {
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
      .setCustomId(`submit_view_wolfseer_${playerId}`)
      .setTitle('Xem vai trò');

    const input = new TextInputBuilder()
      .setCustomId('view_index_wolfseer')
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

    const viewIndexStr = interaction.fields.getTextInputValue(
      'view_index_wolfseer',
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
      sender.role.id === WEREROLE.WOLFSEER &&
      sender.role instanceof WolfSeer
    ) {
      if (!targetPlayer.alive) {
        return interaction.editReply({
          content: 'Không có tác dụng lên người chết',
        });
      }

      if (sender.role.seerCount <= 0) {
        return interaction.editReply({
          content: 'Bạn đã hết lượt dùng chức năng',
        });
      }

      try {
        const checkSeer = () => {
          return targetPlayer.role.id === WEREROLE.SEER;
        };

        const user = await gameRoom.fetchUser(playerId);
        if (user) {
          await user.send(
            `🔍 Vai trò của: **${targetPlayer.name}** là ${checkSeer() ? 'Tiên Tri' : 'Không phải Tiên Tri'}.`,
          );
        }

        sender.role.seerCount -= 1;

        const notifyMessages = gameRoom.players.map((player: Player) => {
          let content = '';
          if (player.role && player.role.id === WEREROLE.WEREWOLF && player.userId !== sender.userId) {
            content = `**Thông báo:** 🐺🔍 **Sói Tiên Tri** đã soi **${targetPlayer.name}** và phát hiện người này **${checkSeer() ? 'LÀ' : 'KHÔNG PHẢI'}** Tiên Tri.`;
          } else {
            content = `**Thông báo:** 🐺🔍 **Sói Tiên Tri** đã soi **${targetPlayer.name}**.`;
          }
          return { userId: player.userId, content };
        });

        await gameRoom.batchSendMessages(notifyMessages);
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }
    }

    await interaction.editReply({
      content: '✅ Xem vai trò thành công.',
    });
  };
}

export default new WolfSeerInteraction();
