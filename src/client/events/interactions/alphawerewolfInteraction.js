const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { WEREROLE } = require('../../../../utils/role');

class AlphaWerewolfInteraction {
  isButton = async (interaction) => {
    if (interaction.customId.startsWith('mask_target_alphawerewolf_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_mask_alphawerewolf_${playerId}`)
        .setTitle('Chọn người cần che');

      const input = new TextInputBuilder()
        .setCustomId('mask_index_alphawerewolf')
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
    }
  };
  isModalSubmit = async (interaction, gameRoom, sender, client) => {
    if (interaction.customId.startsWith('submit_mask_alphawerewolf_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const maskIndexStr = interaction.fields.getTextInputValue(
        'mask_index_alphawerewolf'
      );
      const maskIndex = parseInt(maskIndexStr, 10);

      if (
        isNaN(maskIndex) ||
        maskIndex < 1 ||
        maskIndex > gameRoom.players.length
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[maskIndex - 1];

      if (sender.role.id === WEREROLE.ALPHAWEREWOLF) {
        if (!targetPlayer.alive) {
          return interaction.reply({
            content: 'Không có tác dụng lên người chết',
            ephemeral: true,
          });
        }

        if (targetPlayer.role.faction !== 0) {
          return interaction.reply({
            content: 'Người bạn che không phải sói',
            ephemeral: true,
          });
        }

        sender.role.maskWolf = targetPlayer.userId;

        try {
          const user = await client.users.fetch(playerId);
          await user.send(`👤 Bạn đã che: **${targetPlayer.name}**.`);
        } catch (err) {
          console.error(`Không thể gửi DM cho ${playerId}:`, err);
        }
      }

      await interaction.reply({
        content: '✅ Che thành công.',
        ephemeral: true,
      });
    }
  };
}

module.exports = new AlphaWerewolfInteraction();
