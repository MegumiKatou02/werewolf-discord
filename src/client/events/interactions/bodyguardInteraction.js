const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { WEREROLE } = require('../../../../utils/role');

class BodyguardInteraction {
  isButton = async (interaction) => {
    if (interaction.customId.startsWith('protect_target_bodyguard_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_protect_bodyguard_${playerId}`)
        .setTitle('Chọn người cần bảo vệ');

      const input = new TextInputBuilder()
        .setCustomId('protect_index_bodyguard')
        .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }
  };
  isModalSubmit = async (interaction, gameRoom, sender, client) => {
    if (interaction.customId.startsWith('submit_protect_bodyguard_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const protectIndexStr = interaction.fields.getTextInputValue(
        'protect_index_bodyguard'
      );
      const protectIndex = parseInt(protectIndexStr, 10);

      if (
        isNaN(protectIndex) ||
        protectIndex < 1 ||
        protectIndex > gameRoom.players.length
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[protectIndex - 1];
      if (sender.role.id === WEREROLE.BODYGUARD) {
        if (!targetPlayer.alive) {
          return interaction.reply({
            content: 'Không có tác dụng lên người chết',
            ephemeral: true,
          });
        }

        if (sender.role.protectedCount <= 0) {
          return interaction.reply({
            content: 'Bạn đã hết lượt dùng chức năng',
            ephemeral: true,
          });
        }

        if (targetPlayer.userId === sender.userId) {
          return interaction.reply({
            content: 'Bạn đã tự bảo vệ bản thân rồi, không cần bảo vệ tiếp nữa',
            ephemeral: true,
          });
        }

        // sender.role.protectedCount -= 1; lỡ chọn lại
        sender.role.protectedPerson = targetPlayer.userId;
      }

      try {
        const user = await client.users.fetch(playerId);
        await user.send(`🥋 Bạn đã bảo vệ: **${targetPlayer.name}**.`);
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }

      await interaction.reply({
        content: '✅ Bảo vệ thành công.',
        ephemeral: true,
      });
    }
  };
}

module.exports = new BodyguardInteraction();
