const { WEREROLE } = require('../../../../utils/role');
const {
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
} = require('discord.js');

class maidInteraction {
  isButton = async (interaction) => {
    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được nhấn nút này.',
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`submit_choose_master_maid_${playerId}`)
      .setTitle('Chọn chủ');

    const input = new TextInputBuilder()
      .setCustomId('master_index_maid')
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

  isModalSubmit = async (interaction, gameRoom, sender, client) => {
    if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

    const playerId = interaction.customId.split('_')[4];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được gửi form này.',
        ephemeral: true,
      });
    }

    const masterIndexStr =
      interaction.fields.getTextInputValue('master_index_maid');
    const masterIndex = parseInt(masterIndexStr, 10);

    await interaction.deferReply({ ephemeral: true });

    if (
      isNaN(masterIndex) ||
      masterIndex < 1 ||
      masterIndex > gameRoom.players.length
    ) {
      return interaction.editReply({
        content: 'Số thứ tự không hợp lệ.',
        ephemeral: true,
      });
    }

    const targetPlayer = gameRoom.players[masterIndex - 1];
    if (sender.role.id === WEREROLE.MAID) {
      if (!targetPlayer.alive) {
        return interaction.editReply({
          content: 'Không thể chọn người chết làm chủ',
          ephemeral: true,
        });
      }

      if (targetPlayer.userId === sender.userId) {
        return interaction.editReply({
          content: 'Bạn không thể chọn chính mình làm chủ.',
          ephemeral: true,
        });
      }

      sender.role.master = targetPlayer.userId;
    }

    try {
      const user = await client.users.fetch(playerId);
      await user.send(
        `👑 Bạn đã chọn **${targetPlayer.name}** làm chủ của mình.`
      );
    } catch (err) {
      console.error(`Không thể gửi DM cho ${playerId}:`, err);
    }

    await interaction.editReply({
      content: '✅ Chọn chủ thành công.',
      ephemeral: true,
    });
  };
}

module.exports = new maidInteraction();
