import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type Interaction,
} from 'discord.js';

class CustomizeRolesJson {
  isButton = async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    const modal = new ModalBuilder()
      .setCustomId('customize_roles_json_modal')
      .setTitle('Tuỳ chỉnh vai trò (JSON)');

    const jsonInput = new TextInputBuilder()
      .setCustomId('roles_json')
      .setLabel('Nhập JSON vai trò')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('{"0": 2, "1": 3, "2": 1, ...}')
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(
      jsonInput
    );
    modal.addComponents(row);

    await interaction.showModal(modal);
  };
  isModalSubmit = async (
    interaction: Interaction,
    gameRooms: Map<string, any>
  ) => {
    if (!interaction.isModalSubmit()) return;

    const guildId = interaction.guildId;
    if (!guildId) {
      throw new Error('Không tìm thấy guildId');
    }
    const room = gameRooms.get(guildId);

    await interaction.deferReply({ ephemeral: true });

    if (!room) {
      return interaction.editReply({
        content: 'Không tìm thấy phòng chơi.',
      });
    }

    const jsonStr = interaction.fields.getTextInputValue('roles_json');
    let customRoles;

    try {
      customRoles = JSON.parse(jsonStr);
    } catch (err) {
      console.error('Lỗi khi phân tích JSON:', err);
      return interaction.editReply({
        content: 'JSON không hợp lệ. Vui lòng kiểm tra lại cú pháp.',
      });
    }

    for (const key of Object.keys(customRoles)) {
      if (isNaN(parseInt(key))) {
        return interaction.editReply({
          content: 'Các key trong JSON phải là ID vai trò (số).',
        });
      }
    }

    let totalPlayers = 0;
    for (const count of Object.values(customRoles)) {
      if (typeof count !== 'number' || count <= 0) {
        return interaction.editReply({
          content: 'Số lượng vai trò phải là số dương.',
        });
      }
      totalPlayers += count;
    }

    if (totalPlayers !== room.players.length) {
      return interaction.editReply({
        content: `Tổng số vai trò (${totalPlayers}) phải bằng số người chơi (${room.players.length}).`,
      });
    }

    const numWerewolves = customRoles['0'] || 0;
    if (numWerewolves === 0) {
      return interaction.editReply({
        content: 'Phải có ít nhất 1 Sói trong game.',
      });
    }

    try {
      await room.startGame(interaction, customRoles);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: `✅ ${interaction.user.globalName || interaction.user.username} đã bắt đầu trò chơi với vai trò tuỳ chỉnh! Vai trò đã được chia.`,
        });
      }
    } catch (err) {
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: `Lỗi: ${(err as Error).message}`,
        });
      }
    }
    await interaction.editReply({
      content:
        '✅ Đã bắt đầu trò chơi với vai trò tuỳ chỉnh! Vai trò đã được chia.',
    });
  };
}

export default new CustomizeRolesJson();
