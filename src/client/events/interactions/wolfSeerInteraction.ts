import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type Interaction,
  Client,
} from 'discord.js';
import { WEREROLE } from '../../../../utils/role.js';
import type Player from '../../../../types/player.js';
import WolfSeer from '../../../../types/roles/WolfSeer.js';
import type { GameRoom } from '../../../../core/room.js';

class WolfSeerInteraction {
  isButton = async (interaction: Interaction) => {
    if (!interaction.isButton()) return;

    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được nhấn nút này.',
        ephemeral: true,
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
    client: Client
  ) => {
    if (!interaction.isModalSubmit()) return;

    if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được gửi form này.',
        ephemeral: true,
      });
    }

    const viewIndexStr = interaction.fields.getTextInputValue(
      'view_index_wolfseer'
    );
    const viewIndex = parseInt(viewIndexStr, 10);

    if (
      isNaN(viewIndex) ||
      viewIndex < 1 ||
      viewIndex > gameRoom.players.length
    ) {
      return interaction.reply({
        content: 'Số thứ tự không hợp lệ.',
        ephemeral: true,
      });
    }

    const targetPlayer = gameRoom.players[viewIndex - 1];

    await interaction.deferReply({ ephemeral: true });

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

        const user = await client.users.fetch(playerId);
        await user.send(
          `🔍 Vai trò của: **${targetPlayer.name}** là ${checkSeer() ? 'Tiên Tri' : 'Không phải Tiên Tri'}.`
        );

        sender.role.seerCount -= 1;
        const notifyMessage = gameRoom.players.map(async (player: Player) => {
          try {
            if (
              player.role &&
              player.role.id === WEREROLE.WEREWOLF &&
              player.userId !== sender.userId
            ) {
              const wolfUser = await client.users.fetch(player.userId);
              await wolfUser.send(
                `**Thông báo:** 🐺🔍 **Sói Tiên Tri** đã soi **${targetPlayer.name}** và phát hiện người này **${checkSeer() ? 'LÀ' : 'KHÔNG PHẢI'}** Tiên Tri.`
              );
            } else {
              // Những người còn lại (dân làng/solo/...)
              const user = await client.users.fetch(player.userId);
              await user.send(
                `**Thông báo:** 🐺🔍 **Sói Tiên Tri** đã soi **${targetPlayer.name}**.`
              );
            }
          } catch (err) {
            console.error('Không gửi được tin nhắn', err);
          }
        });
        await Promise.allSettled(notifyMessage);
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
