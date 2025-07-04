import {
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  ModalBuilder,
  type Interaction,
} from 'discord.js';
import { MessageFlags } from 'discord.js';

import type { GameRoom } from '../../../../core/room.js';
import type Player from '../../../../types/player.js';
import Stalker from '../../../../types/roles/Stalker.js';
import { WEREROLE } from '../../../../utils/role.js';

class StalkerInteraction {
  isButtonStalker = async (interaction: Interaction, gameRoom: GameRoom) => {
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
      const stalker = gameRoom.players.find(
        (p: Player) => p.role?.id === WEREROLE.STALKER,
      );

      if (
        stalker &&
        stalker.role instanceof Stalker &&
        stalker.role.killedPerson
      ) {
        return interaction.reply({
          content: 'Bạn đã chọn ám sát người chơi khác rồi.',
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
      .setCustomId(`submit_stalk_stalker_${playerId}`)
      .setTitle('Chọn người chơi để theo dõi');

    const input = new TextInputBuilder()
      .setCustomId('stalk_index_stalker')
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

  isModalSubmitStalker = async (
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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const stalkIndexStr = interaction.fields.getTextInputValue(
      'stalk_index_stalker',
    );
    const stalkIndex = parseInt(stalkIndexStr, 10);

    if (
      isNaN(stalkIndex) ||
      stalkIndex < 1 ||
      stalkIndex > gameRoom.players.length
    ) {
      return interaction.editReply({
        content: 'Số thứ tự không hợp lệ.',
      });
    }

    const targetPlayer = gameRoom.players[stalkIndex - 1];
    if (
      sender.role &&
      sender.role.id === WEREROLE.STALKER &&
      sender.role instanceof Stalker
    ) {
      if (!targetPlayer.alive) {
        return interaction.editReply({
          content: 'Không có tác dụng lên người chết',
        });
      }

      if (sender.role.stalkCount <= 0) {
        return interaction.editReply({
          content: 'Bạn đã hết lượt dùng chức năng',
        });
      }

      if (sender.role.stalkedPerson) {
        return interaction.editReply({
          content: 'Bạn đã theo dõi người chơi khác rồi.',
        });
      }

      if (targetPlayer.userId === sender.userId) {
        return interaction.editReply({
          content: 'Bạn không thể chọn chính bản thân bạn.',
        });
      }

      sender.role.stalkedPerson = targetPlayer.userId;
      sender.role.stalkCount -= 1;
    }

    try {
      const user = await gameRoom.fetchUser(playerId);
      if (user) {
        await user.send(`👀 Bạn đã chọn người chơi để theo dõi: **${targetPlayer.name}**.`);
      }
    } catch (err) {
      console.error(`Không thể gửi DM cho ${playerId}:`, err);
    }

    await interaction.editReply({
      content: '✅ Chọn người chơi thành công.',
    });
  };
  isButtonKill = async (interaction: Interaction, gameRoom: GameRoom) => {
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
      const stalker = gameRoom.players.find(
        (p: Player) => p.role?.id === WEREROLE.STALKER,
      );

      if (
        stalker &&
        stalker.role instanceof Stalker &&
        stalker.role.stalkedPerson
      ) {
        return interaction.reply({
          content: 'Bạn đã theo dõi người chơi khác rồi.',
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
      .setCustomId(`submit_kill_stalker_${playerId}`)
      .setTitle('Chọn người chơi để ám sát');

    const input = new TextInputBuilder()
      .setCustomId('kill_index_stalker')
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
  isModalSubmitKill = async (
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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const killIndexStr =
      interaction.fields.getTextInputValue('kill_index_stalker');
    const killIndex = parseInt(killIndexStr, 10);

    if (
      isNaN(killIndex) ||
      killIndex < 1 ||
      killIndex > gameRoom.players.length
    ) {
      return interaction.editReply({
        content: 'Số thứ tự không hợp lệ.',
      });
    }

    const targetPlayer = gameRoom.players[killIndex - 1];
    if (
      sender.role &&
      sender.role.id === WEREROLE.STALKER &&
      sender.role instanceof Stalker
    ) {
      if (!targetPlayer.alive) {
        return interaction.editReply({
          content: 'Không có tác dụng lên người chết',
        });
      }

      if (sender.role.killCount <= 0) {
        return interaction.editReply({
          content: 'Bạn đã hết lượt dùng chức năng',
        });
      }
      if (sender.role.killedPerson) {
        return interaction.editReply({
          content: 'Bạn đã ám sát người chơi khác rồi.',
        });
      }
      if (targetPlayer.userId === sender.userId) {
        return interaction.editReply({
          content: 'Bạn không thể ám sát chính bản thân bạn.',
        });
      }

      sender.role.killCount -= 1;
      sender.role.killedPerson = targetPlayer.userId;
    }

    try {
      const user = await gameRoom.fetchUser(playerId);
      if (user) {
        await user.send(`🔪 Bạn đã chọn người chơi để ám sát: **${targetPlayer.name}**.`);
      }
    } catch (err) {
      console.error(`Không thể gửi DM cho ${playerId}:`, err);
    }

    await interaction.editReply({
      content: '✅ Chọn người chơi thành công.',
    });
  };
}

export default new StalkerInteraction();
