const { WEREROLE } = require('../../../../utils/role');
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');

class detectiveInteraction {
  isButton = async (interaction) => {
    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được nhấn nút này.',
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`submit_investigate_detective_${playerId}`)
      .setTitle('Điều tra người chơi');

    const input1 = new TextInputBuilder()
      .setCustomId('investigate_index_1')
      .setLabel('Nhập số thứ tự người chơi 1 (bắt đầu từ 1)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: 3')
      .setRequired(true);

    const input2 = new TextInputBuilder()
      .setCustomId('investigate_index_2')
      .setLabel('Nhập số thứ tự người chơi 2 (bắt đầu từ 1)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: 4')
      .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(input1);
    const row2 = new ActionRowBuilder().addComponents(input2);
    modal.addComponents(row1, row2);

    await interaction.showModal(modal);
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

    const index1Str = interaction.fields.getTextInputValue(
      'investigate_index_1'
    );
    const index2Str = interaction.fields.getTextInputValue(
      'investigate_index_2'
    );
    const index1 = parseInt(index1Str, 10);
    const index2 = parseInt(index2Str, 10);

    if (
      isNaN(index1) ||
      isNaN(index2) ||
      index1 < 1 ||
      index2 < 1 ||
      index1 > gameRoom.players.length ||
      index2 > gameRoom.players.length ||
      index1 === index2
    ) {
      return interaction.reply({
        content: 'Số thứ tự không hợp lệ hoặc trùng nhau.',
        ephemeral: true,
      });
    }

    const targetPlayer1 = gameRoom.players[index1 - 1];
    const targetPlayer2 = gameRoom.players[index2 - 1];

    if (sender.role.id === 5) {
      if (!targetPlayer1.alive || !targetPlayer2.alive) {
        return interaction.reply({
          content: 'Không có tác dụng lên người chết',
          ephemeral: true,
        });
      }

      if (sender.role.investigatedCount <= 0) {
        return interaction.reply({
          content: 'Bạn đã hết lượt dùng chức năng',
          ephemeral: true,
        });
      }

      sender.role.investigatedPairs.push(
        targetPlayer1.userId,
        targetPlayer2.userId
      );
      sender.role.investigatedCount -= 1; // soi rồi không chọn lại được nữa

      const checkFaction = () => {
        if (targetPlayer1.role.faction === targetPlayer2.role.faction) {
          if (
            targetPlayer1.role.id === WEREROLE.LYCAN ||
            targetPlayer2.role.id === WEREROLE.LYCAN
          ) {
            return false;
          }
          return true;
        }
        if (
          targetPlayer1.role.faction === 3 &&
          targetPlayer2.role.faction === 1 &&
          targetPlayer1.role.id !== WEREROLE.LYCAN &&
          targetPlayer2.role.id !== WEREROLE.LYCAN
        )
          return true;
        if (
          targetPlayer1.role.faction === 1 &&
          targetPlayer2.role.faction === 3 &&
          targetPlayer1.role.id !== WEREROLE.LYCAN &&
          targetPlayer2.role.id !== WEREROLE.LYCAN
        )
          return true;

        if (
          targetPlayer1.role.id === WEREROLE.LYCAN ||
          (targetPlayer2.role.id === WEREROLE.LYCAN &&
            (targetPlayer1.role.faction === 0 ||
              targetPlayer2.role.faction === 0))
        ) {
          return true;
        }
        return false;
      };

      try {
        const user = await client.users.fetch(playerId);
        await user.send(
          `🔎 Bạn đã điều tra: **${targetPlayer1.name}** và **${targetPlayer2.name}**. Họ ${checkFaction() ? 'cùng phe' : 'khác phe'}.`
        );
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }
    }

    await interaction.reply({
      content: '✅ Điều tra thành công.',
      ephemeral: true,
    });
  };
}

module.exports = new detectiveInteraction();
