const {
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  ModalBuilder,
} = require('discord.js');
const { WEREROLE } = require('../../../../utils/role');

class stalkerInteraction {
  isButtonStalker = async (interaction, gameRoom) => {
    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được nhấn nút này.',
        ephemeral: true,
      });
    }

    try {
      const stalker = gameRoom.players.find(
        (p) => p.role.id === WEREROLE.STALKER
      );

      if (stalker && stalker.role.killedPerson) {
        return interaction.reply({
          content: 'Bạn đã chọn ám sát người chơi khác rồi.',
          ephemeral: true,
        });
      }
    } catch (err) {
      console.error('❌ Lỗi khi fetch user:', err);
      return interaction.reply({
        content: 'Không tìm thấy người chơi.',
        ephemeral: true,
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

    const row = new ActionRowBuilder().addComponents(input);
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

  isModalSubmitStalker = async (interaction, gameRoom, sender, client) => {
    if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được gửi form này.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const stalkIndexStr = interaction.fields.getTextInputValue(
      'stalk_index_stalker'
    );
    const stalkIndex = parseInt(stalkIndexStr, 10);

    if (
      isNaN(stalkIndex) ||
      stalkIndex < 1 ||
      stalkIndex > gameRoom.players.length
    ) {
      return interaction.editReply({
        content: 'Số thứ tự không hợp lệ.',
        ephemeral: true,
      });
    }

    const targetPlayer = gameRoom.players[stalkIndex - 1];
    if (sender.role.id === WEREROLE.STALKER) {
      if (!targetPlayer.alive) {
        return interaction.editReply({
          content: 'Không có tác dụng lên người chết',
          ephemeral: true,
        });
      }

      if (sender.role.stalkCount <= 0) {
        return interaction.editReply({
          content: 'Bạn đã hết lượt dùng chức năng',
          ephemeral: true,
        });
      }

      if (sender.role.stalkedPerson) {
        return interaction.editReply({
          content: 'Bạn đã theo dõi người chơi khác rồi.',
          ephemeral: true,
        });
      }

      if (targetPlayer.userId === sender.userId) {
        return interaction.editReply({
          content: 'Bạn không thể chọn chính bản thân bạn.',
          ephemeral: true,
        });
      }

      sender.role.stalkedPerson = targetPlayer.userId;
      sender.role.stalkCount -= 1;
    }

    try {
      const user = await client.users.fetch(playerId);
      await user.send(
        `👀 Bạn đã chọn người chơi để theo dõi: **${targetPlayer.name}**.`
      );
    } catch (err) {
      console.error(`Không thể gửi DM cho ${playerId}:`, err);
    }

    await interaction.editReply({
      content: '✅ Chọn người chơi thành công.',
      ephemeral: true,
    });
  };
  isButtonKill = async (interaction, gameRoom) => {
    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được nhấn nút này.',
        ephemeral: true,
      });
    }

    try {
      const stalker = gameRoom.players.find(
        (p) => p.role.id === WEREROLE.STALKER
      );

      if (stalker && stalker.role.stalkedPerson) {
        return interaction.reply({
          content: 'Bạn đã theo dõi người chơi khác rồi.',
          ephemeral: true,
        });
      }
    } catch (err) {
      console.error('❌ Lỗi khi fetch user:', err);
      return interaction.reply({
        content: 'Không tìm thấy người chơi.',
        ephemeral: true,
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

    const row = new ActionRowBuilder().addComponents(input);
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
  isModalSubmitKill = async (interaction, gameRoom, sender, client) => {
    if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được gửi form này.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

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
        ephemeral: true,
      });
    }

    const targetPlayer = gameRoom.players[killIndex - 1];
    if (sender.role.id === WEREROLE.STALKER) {
      if (!targetPlayer.alive) {
        return interaction.editReply({
          content: 'Không có tác dụng lên người chết',
          ephemeral: true,
        });
      }

      if (sender.role.killCount <= 0) {
        return interaction.editReply({
          content: 'Bạn đã hết lượt dùng chức năng',
          ephemeral: true,
        });
      }
      if (sender.role.killedPerson) {
        return interaction.editReply({
          content: 'Bạn đã ám sát người chơi khác rồi.',
          ephemeral: true,
        });
      }
      if (targetPlayer.userId === sender.userId) {
        return interaction.editReply({
          content: 'Bạn không thể ám sát chính bản thân bạn.',
          ephemeral: true,
        });
      }

      sender.role.killCount -= 1;
      sender.role.killedPerson = targetPlayer.userId;
    }

    try {
      const user = await client.users.fetch(playerId);
      await user.send(
        `🔪 Bạn đã chọn người chơi để ám sát: **${targetPlayer.name}**.`
      );
    } catch (err) {
      console.error(`Không thể gửi DM cho ${playerId}:`, err);
    }

    await interaction.editReply({
      content: '✅ Chọn người chơi thành công.',
      ephemeral: true,
    });
  };
}

module.exports = new stalkerInteraction();
