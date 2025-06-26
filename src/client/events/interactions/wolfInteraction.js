const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { WEREROLE } = require('../../../../utils/role');

class WolfInteraction {
  isButton = async (interaction) => {
    if (interaction.customId.startsWith('vote_target_wolf_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_vote_wolf_${playerId}`)
        .setTitle('Vote người chơi cần giết');

      const input = new TextInputBuilder()
        .setCustomId('vote_index_wolf')
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
    if (interaction.customId.startsWith('submit_vote_wolf_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      await interaction.deferReply({ ephemeral: true });

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.editReply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const voteIndexStr =
        interaction.fields.getTextInputValue('vote_index_wolf');
      const voteIndex = parseInt(voteIndexStr, 10);

      if (
        isNaN(voteIndex) ||
        voteIndex < 1 ||
        voteIndex > gameRoom.players.length
      ) {
        return interaction.editReply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[voteIndex - 1];

      if (sender.role.id === WEREROLE.WEREWOLF) {
        if (!targetPlayer.alive) {
          return interaction.editReply({
            content: 'Không có tác dụng lên người chết',
            ephemeral: true,
          });
        }

        if (sender.role.biteCount <= 0) {
          return interaction.editReply({
            content: 'Bạn đã hết lượt dùng chức năng',
            ephemeral: true,
          });
        }

        if (targetPlayer.role.faction === 0) {
          // FactionRole.Werewolf
          return interaction.editReply({
            content: 'Bạn không thể vote giết đồng minh của mình.',
            ephemeral: true,
          });
        }

        // sender.role.biteCount -= 1; lỡ chọn lại
        sender.role.voteBite = targetPlayer.userId;
      }

      try {
        const user = await client.users.fetch(playerId);
        for (const player of gameRoom.players) {
          if (player.role.id === 0) {
            if (player.userId !== playerId) {
              const targetUser = await client.users.fetch(player.userId);
              await targetUser.send(
                `🐺 **${sender.name}** đã vote giết **${targetPlayer.name}**.`
              );
            } else {
              await user.send(`🔪 Bạn đã vote giết: **${targetPlayer.name}**.`);
            }
          }
        }
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }

      await interaction.editReply({
        content: '✅ Vote của bạn đã được ghi nhận.',
        ephemeral: true,
      });
    }
  };
}

module.exports = new WolfInteraction();
