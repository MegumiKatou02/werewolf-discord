const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { WEREROLE } = require('../../../../utils/role');

class PuppeteerInteraction {
  isButton = async (interaction) => {
    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được nhấn nút này.',
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`submit_puppeteer_${playerId}`)
      .setTitle('Chỉ định mục tiêu');

    const input = new TextInputBuilder()
      .setCustomId('puppeteer_target_puppeteer')
      .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: 3')
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(input);
    modal.addComponents(row);

    await interaction.showModal(modal);
  };
  isModalSubmit = async (interaction, gameRoom, sender) => {
    if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

    const playerId = interaction.customId.split('_')[2];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được gửi form này.',
        ephemeral: true,
      });
    }

    const viewIndexStr = interaction.fields.getTextInputValue(
      'puppeteer_target_puppeteer'
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

    if (sender.role.id === WEREROLE.PUPPETEER) {
      if (!targetPlayer.alive) {
        return interaction.editReply({
          content: 'Không có tác dụng lên người chết',
          ephemeral: true,
        });
      }

      // khác null
      if (sender.role.targetWolf) {
        return interaction.editReply({
          content: 'Bạn đã hết lượt dùng chức năng',
          ephemeral: true,
        });
      }

      if (sender.userId === targetPlayer.userId) {
        return interaction.editReply({
          content: 'Bạn không thể chỉ định mục tiêu là chính mình.',
          ephemeral: true,
        });
      }

      sender.role.targetWolf = targetPlayer.userId;
    }

    await interaction.editReply({
      content: '✅ Chỉ định mục tiêu thành công.',
      ephemeral: true,
    });
  };
}

module.exports = new PuppeteerInteraction();
