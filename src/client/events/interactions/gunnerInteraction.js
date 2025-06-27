const { WEREROLE } = require('../../../../utils/role');
const Dead = require('../../../../types/roles/Dead');
const {
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
} = require('discord.js');

class gunnerInteraction {
  isButtonGunner = async (interaction) => {
    const playerId = interaction.customId.split('_')[2];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được nhấn nút này.',
        ephemeral: true,
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

  isModalSubmitGunner = async (interaction, gameRoom, sender, client) => {
    if (!gameRoom || gameRoom.gameState.phase !== 'day') return;

    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được gửi form này.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

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
        ephemeral: true,
      });
    }

    const targetPlayer = gameRoom.players[shootIndex - 1];
    if (sender.role.id === WEREROLE.GUNNER) {
      if (!targetPlayer.alive) {
        return interaction.editReply({
          content: 'Không thể bắn người đã chết.',
          ephemeral: true,
        });
      }

      if (sender.role.bullets <= 0) {
        return interaction.editReply({
          content: 'Bạn đã hết đạn.',
          ephemeral: true,
        });
      }

      if (targetPlayer.userId === sender.userId) {
        return interaction.editReply({
          content: 'Bạn không thể bắn chính mình.',
          ephemeral: true,
        });
      }

      sender.role.bullets -= 1;
      targetPlayer.alive = false;
      targetPlayer.role = new Dead(
        targetPlayer.role.faction,
        targetPlayer.role.id
      );

      const notifyPromises = gameRoom.players.map(async (player) => {
        const user = await client.users.fetch(player.userId);
        if (!user) return;

        if (player.userId === targetPlayer.userId) {
          await user.send('💀 Bạn đã bị Xạ thủ bắn chết.');
        }
        if (sender.role.bullets === 1) {
          await user.send(
            `🔫 **${sender.name}** đã bắn chết **${targetPlayer.name}**!`
          );
        } else {
          await user.send(
            `🔫 **Xạ Thủ** đã bắn chết **${targetPlayer.name}**!`
          );
        }
      });

      await Promise.allSettled(notifyPromises);

      await gameRoom.updateAllPlayerList();

      // Kiểm tra master của hầu gái
      const maidNewRole = await gameRoom.checkIfMasterIsDead(targetPlayer);

      if (maidNewRole) {
        const notifyPromises = gameRoom.players.map(async (player) => {
          const user = await client.users.fetch(player.userId);
          if (!user) return;

          await user.send(
            `### 👒 Hầu gái đã lên thay vai trò **${maidNewRole}** của chủ vì chủ đã bị bắn.\n`
          );
        });
        await Promise.allSettled(notifyPromises);
      }
      await gameRoom.checkEndGame();
    }

    await interaction.editReply({
      content: '✅ Bắn thành công.',
      ephemeral: true,
    });
  };
}

module.exports = new gunnerInteraction();
