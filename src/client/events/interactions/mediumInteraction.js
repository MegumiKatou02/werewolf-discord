const {
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
} = require('discord.js');

class mediumInteraction {
  isButton = async (interaction) => {
    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được nhấn nút này.',
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`submit_revive_medium_${playerId}`)
      .setTitle('Hồi sinh người chơi');

    const input = new TextInputBuilder()
      .setCustomId('revive_index_medium')
      .setLabel('Số thứ tự người chết (bắt đầu từ 1)')
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

  isModalSubmit = async (interaction, gameRoom, sender, client) => {
    if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được gửi form này.',
        ephemeral: true,
      });
    }

    const reviveIndexStr = interaction.fields.getTextInputValue(
      'revive_index_medium'
    );
    const reviveIndex = parseInt(reviveIndexStr, 10);

    if (
      isNaN(reviveIndex) ||
      reviveIndex < 1 ||
      reviveIndex > gameRoom.players.length
    ) {
      return interaction.reply({
        content: 'Số thứ tự không hợp lệ.',
        ephemeral: true,
      });
    }

    const targetPlayer = gameRoom.players[reviveIndex - 1];
    if (sender.role.id === 8) {
      if (sender.role.revivedCount <= 0) {
        return interaction.reply({
          content: 'Bạn đã hết lượt dùng chức năng',
          ephemeral: true,
        });
      }

      if (targetPlayer.alive) {
        return interaction.reply({
          content: 'Người chơi này vẫn còn sống, không thể hồi sinh.',
          ephemeral: true,
        });
      }

      if (targetPlayer.role.faction !== 1) {
        return interaction.reply({
          content: `Người chơi này không thuộc phe dân làng, không thể hồi sinh.`,
          ephemeral: true,
        });
      }

      // sender.role.revivedCount -= 1; // Lỡ chọn lại
      sender.role.revivedPerson = targetPlayer.userId;
    }

    try {
      const user = await client.users.fetch(playerId);
      await user.send(
        `💫 Bạn đã chọn người chơi để hồi sinh: **${targetPlayer.name}**.`
      );
    } catch (err) {
      console.error(`Không thể gửi DM cho ${playerId}:`, err);
    }
    await interaction.reply({
      content: '✅ Chọn người chơi thành công.',
      ephemeral: true,
    });
  };
}

module.exports = new mediumInteraction();
