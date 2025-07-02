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
import Dead from '../../../../types/roles/Dead.js';
import Gunner from '../../../../types/roles/Gunner.js';
import { WEREROLE } from '../../../../utils/role.js';

class GunnerInteraction {
  isButtonGunner = async (interaction: Interaction) => {
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
      .setCustomId(`submit_gunner_shoot_${playerId}`)
      .setTitle('Chọn người để bắn');

    const input = new TextInputBuilder()
      .setCustomId('shoot_index_gunner')
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

  isModalSubmitGunner = async (
    interaction: Interaction,
    gameRoom: GameRoom,
    sender: Player,
    client: Client,
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

    const shootIndexStr =
      interaction.fields.getTextInputValue('shoot_index_gunner');
    const shootIndex = parseInt(shootIndexStr, 10);

    if (
      isNaN(shootIndex) ||
      shootIndex < 1 ||
      shootIndex > gameRoom.players.length
    ) {
      return interaction.editReply({
        content: 'Số thứ tự không hợp lệ.',
      });
    }

    const targetPlayer = gameRoom.players[shootIndex - 1];
    if (
      sender.role &&
      sender.role.id === WEREROLE.GUNNER &&
      sender.role instanceof Gunner
    ) {
      if (!targetPlayer.alive) {
        return interaction.editReply({
          content: 'Không thể bắn người đã chết.',
        });
      }

      if (sender.role.bullets <= 0) {
        return interaction.editReply({
          content: 'Bạn đã hết đạn.',
        });
      }

      if (targetPlayer.userId === sender.userId) {
        return interaction.editReply({
          content: 'Bạn không thể bắn chính mình.',
        });
      }

      sender.role.bullets -= 1;
      targetPlayer.alive = false;
      targetPlayer.role = new Dead(
        targetPlayer.role.faction,
        targetPlayer.role.id,
      );

      const notifyPromises = gameRoom.players.map(async (player: Player) => {
        const user = await client.users.fetch(player.userId);
        if (!user) {
          return;
        }

        if (player.userId === targetPlayer.userId) {
          await user.send('💀 Bạn đã bị Xạ thủ bắn chết.');
        }
        if (
          sender.role &&
          sender.role instanceof Gunner &&
          sender.role.bullets === 1
        ) {
          await user.send(
            `🔫 **${sender.name}** đã bắn chết **${targetPlayer.name}**!`,
          );
        } else {
          await user.send(
            `🔫 **Xạ Thủ** đã bắn chết **${targetPlayer.name}**!`,
          );
        }
      });

      await Promise.allSettled(notifyPromises);

      await gameRoom.updateAllPlayerList();

      gameRoom.gameState.log.push(
        `🔫 **${sender.name}** đã bắn chết **${targetPlayer.name}`,
      );

      // Kiểm tra master của hầu gái
      const maidNewRole = await gameRoom.checkIfMasterIsDead(targetPlayer);

      if (maidNewRole) {
        const notifyPromises = gameRoom.players.map(async (player: Player) => {
          const user = await client.users.fetch(player.userId);
          if (!user) {
            return;
          }

          await user.send(
            `### 👒 Hầu gái đã lên thay vai trò **${maidNewRole}** của chủ vì chủ đã bị bắn.\n`,
          );
        });
        await Promise.allSettled(notifyPromises);
      }
      await gameRoom.checkEndGame();
    }

    await interaction.editReply({
      content: '✅ Bắn thành công.',
    });
  };
}

export default new GunnerInteraction();
