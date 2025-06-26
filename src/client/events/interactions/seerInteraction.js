const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { WEREROLE } = require('../../../../utils/role');

class SeerInteraction {
  isButton = async (interaction) => {
    if (interaction.customId.startsWith('view_target_seer_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_view_seer_${playerId}`)
        .setTitle('Xem phe người chơi');

      const input = new TextInputBuilder()
        .setCustomId('view_index_seer')
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
    if (interaction.customId.startsWith('submit_view_seer_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const viewIndexStr =
        interaction.fields.getTextInputValue('view_index_seer');
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

      if (sender.role.id === WEREROLE.SEER) {
        if (!targetPlayer.alive) {
          return interaction.editReply({
            content: 'Không có tác dụng lên người chết',
            ephemeral: true,
          });
        }

        if (sender.role.viewCount <= 0) {
          return interaction.editReply({
            content: 'Bạn đã hết lượt dùng chức năng',
            ephemeral: true,
          });
        }

        if (sender.userId === targetPlayer.userId) {
          return interaction.editReply({
            content: 'Bạn không thể xem phe của chính mình.',
            ephemeral: true,
          });
        }

        sender.role.viewCount -= 1; // soi rồi không chọn lại được nữa

        try {
          const user = await client.users.fetch(playerId);
          const AlphaWerewolf = gameRoom.players.find(
            (player) => player.role.id === WEREROLE.ALPHAWEREWOLF
          );
          if (
            AlphaWerewolf &&
            AlphaWerewolf.role.maskWolf &&
            AlphaWerewolf.role.maskWolf === targetPlayer.userId
          ) {
            await user.send(
              `👁️ Phe của **${targetPlayer.name}** là: **Dân Làng**.`
            );
          } else {
            if (targetPlayer.role.id === WEREROLE.LYCAN) {
              await user.send(
                `👁️ Phe của **${targetPlayer.name}** là: **Ma Sói**.`
              );
            } else {
              const seerFaction = () => {
                if (targetPlayer.role.faction === 0) return 'Ma Sói';
                if (
                  targetPlayer.role.faction === 1 ||
                  targetPlayer.role.faction === 3
                )
                  return 'Dân Làng';
                return 'Không xác định';
              };
              await user.send(
                `👁️ Phe của **${targetPlayer.name}** là: **${seerFaction()}**.`
              );
            }
          }
        } catch (err) {
          console.error(`Không thể gửi DM cho ${playerId}:`, err);
        }
      }

      await interaction.editReply({
        content: '✅ Soi thành công.',
        ephemeral: true,
      });
    }
  };
}

module.exports = new SeerInteraction();
