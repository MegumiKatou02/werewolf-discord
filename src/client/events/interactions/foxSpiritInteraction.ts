import {
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  type Interaction,
  Client,
} from 'discord.js';
import { MessageFlags } from 'discord.js';

import type { GameRoom } from '../../../../core/room.js';
import type Player from '../../../../types/player.js';
import AlphaWerewolf from '../../../../types/roles/AlphaWerewolf.js';
import FoxSpirit from '../../../../types/roles/FoxSpirit.js';
import { WEREROLE } from '../../../../utils/role.js';

class FoxSpiritInteraction {
  isButton = async (interaction: Interaction, gameRoom: GameRoom) => {
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

    try {
      const foxSpirit = gameRoom.players.find(
        (p: Player) => p.role?.id === WEREROLE.FOXSPIRIT,
      );

      if (
        foxSpirit &&
        foxSpirit.role instanceof FoxSpirit &&
        !foxSpirit.role.isHaveSkill
      ) {
        return interaction.reply({
          content: 'Bạn đã bị mất chức năng.',
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (err) {
      console.error('❌ Lỗi khi fetch user:', err);
      return interaction.reply({
        content: 'Không tìm thấy người chơi.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`submit_view_foxspirit_${playerId}`)
      .setTitle('Chọn 3 người chơi');

    const input1 = new TextInputBuilder()
      .setCustomId('view_index_1')
      .setLabel('Nhập số thứ tự người chơi 1 (bắt đầu từ 1)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: 3')
      .setRequired(true);

    const input2 = new TextInputBuilder()
      .setCustomId('view_index_2')
      .setLabel('Nhập số thứ tự người chơi 2 (bắt đầu từ 1)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: 4')
      .setRequired(true);

    const input3 = new TextInputBuilder()
      .setCustomId('view_index_3')
      .setLabel('Nhập số thứ tự người chơi 3 (bắt đầu từ 1)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: 5')
      .setRequired(true);

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(input1);
    const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(input2);
    const row3 = new ActionRowBuilder<TextInputBuilder>().addComponents(input3);
    modal.addComponents(row1, row2, row3);

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

    const index1Str = interaction.fields.getTextInputValue('view_index_1');
    const index2Str = interaction.fields.getTextInputValue('view_index_2');
    const index3Str = interaction.fields.getTextInputValue('view_index_3');

    const index1 = parseInt(index1Str, 10);
    const index2 = parseInt(index2Str, 10);
    const index3 = parseInt(index3Str, 10);

    if (
      isNaN(index1) ||
      isNaN(index2) ||
      isNaN(index3) ||
      index1 < 1 ||
      index2 < 1 ||
      index3 < 1 ||
      index1 > gameRoom.players.length ||
      index2 > gameRoom.players.length ||
      index3 > gameRoom.players.length ||
      index1 === index2 ||
      index1 === index3 ||
      index2 === index3
    ) {
      return interaction.reply({
        content: 'Số thứ tự không hợp lệ hoặc trùng nhau.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const targetPlayers = [
      gameRoom.players[index1 - 1],
      gameRoom.players[index2 - 1],
      gameRoom.players[index3 - 1],
    ];

    if (
      sender.role &&
      sender.role.id === WEREROLE.FOXSPIRIT &&
      sender.role instanceof FoxSpirit
    ) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (
        !targetPlayers[0].alive ||
        !targetPlayers[1].alive ||
        !targetPlayers[2].alive
      ) {
        return interaction.editReply({
          content: 'Không có tác dụng lên người chết.',
        });
      }
      if (sender.role.viewCount <= 0) {
        return interaction.editReply({
          content: 'Bạn đã hết lượt dùng chức năng.',
        });
      }

      sender.role.threeViewed.push(
        targetPlayers[0].userId,
        targetPlayers[1].userId,
        targetPlayers[2].userId,
      );
      sender.role.viewCount -= 1;
      const isHaveWolf = () => {
        const alphaWerewolf = gameRoom.players.find(
          (p: Player) => p.role?.id === WEREROLE.ALPHAWEREWOLF,
        );
        for (const player of targetPlayers) {
          if (
            (player.role.faction === 0 && !alphaWerewolf) ||
            (player.role.faction === 0 &&
              alphaWerewolf &&
              alphaWerewolf.role instanceof AlphaWerewolf &&
              alphaWerewolf.role.maskWolf !== player.userId) ||
            player.role.id === WEREROLE.LYCAN
          ) {
            return true;
          }
        }
        return false;
      };
      try {
        const user = await client.users.fetch(playerId);

        await user.send(
          `🔎 Trong 3 người bạn chọn: **${targetPlayers[0].name}**, **${targetPlayers[1].name}** và **${targetPlayers[2].name}** ${isHaveWolf() ? 'có Sói' : 'không có Sói'}.`,
        );
        if (!isHaveWolf()) {
          await user.send(
            'Bạn bị mất chức năng vì không có Sói trong 3 người bạn chọn.',
          );
          sender.role.isHaveSkill = false;
        }
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }
    }
    await interaction.editReply({
      content: '✅ Đã xem xét.',
    });
  };
}

export default new FoxSpiritInteraction();
