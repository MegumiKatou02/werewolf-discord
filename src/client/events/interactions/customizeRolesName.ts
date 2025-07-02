import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type Interaction,
} from 'discord.js';
import { MessageFlags } from 'discord.js';

import type { GameRoom } from '../../../../core/room.js';

class CustomizeRolesName {
  isButton = async (interaction: Interaction) => {
    if (!interaction.isButton()) {
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId('customize_roles_name_modal')
      .setTitle('Tuỳ chỉnh vai trò (Tên)');

    const nameInput = new TextInputBuilder()
      .setCustomId('roles_names')
      .setLabel('Nhập vai trò theo tên')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('masoi: 2, danlang: 3, baove: 1, thangngo: 1')
      .setRequired(true);

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(
      nameInput,
    );
    modal.addComponents(row1);

    await interaction.showModal(modal);
  };

  isModalSubmit = async (
    interaction: Interaction,
    gameRooms: Map<string, GameRoom>,
  ) => {
    if (!interaction.isModalSubmit()) {
      return;
    }

    const guildId = interaction.guildId;
    if (!guildId) {
      throw new Error('Không tìm thấy guildId');
    }
    const room = gameRooms.get(guildId);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!room) {
      return interaction.editReply({
        content: 'Không tìm thấy phòng chơi.',
      });
    }

    const rolesStr = interaction.fields.getTextInputValue('roles_names');

    const roleNameMap: Record<string, number> = {
      masoi: 0,
      werewolf: 0,
      'ma sói': 0,
      danlang: 1,
      villager: 1,
      'dân làng': 1,
      baove: 2,
      bodyguard: 2,
      'bảo vệ': 2,
      bansoi: 3,
      cursed: 3,
      'bán sói': 3,
      tientri: 4,
      seer: 4,
      'tiên tri': 4,
      thamtu: 5,
      detective: 5,
      'thám tử': 5,
      phuthuy: 6,
      witch: 6,
      'phù thủy': 6,
      thangngo: 7,
      fool: 7,
      'thằng ngố': 7,
      thaydong: 8,
      medium: 8,
      'thầy đồng': 8,
      haugai: 10,
      maid: 10,
      'hầu gái': 10,
      lycan: 11,
      soitientri: 12,
      wolfseer: 12,
      'sói tiên tri': 12,
      soitrum: 13,
      alphawerewolf: 13,
      'sói trùm': 13,
      cao: 14,
      foxspirit: 14,
      cáo: 14,
      gialang: 15,
      elder: 15,
      'già làng': 15,
      stalker: 16,
      hori: 16,
      stakẻ: 16,
      xathu: 17,
      gunner: 17,
      'xạ thủ': 17,
      soimeocon: 18,
      kittenwolf: 18,
      'sói mèo con': 18,
      puppeteer: 19,
      nguoimuaroi: 19,
      'người múa rối': 19,
    };

    const customRoles: Record<string, number> = {};

    try {
      const pairs = rolesStr.split(',').map((pair) => pair.trim());

      for (const pair of pairs) {
        const [roleName, countStr] = pair.split(':').map((s) => s.trim());

        if (!roleName || !countStr) {
          throw new Error(
            `Định dạng không hợp lệ: "${pair}". Sử dụng định dạng "tên_vai_trò: số_lượng"`,
          );
        }

        const roleId = roleNameMap[roleName.toLowerCase()];
        if (roleId === undefined) {
          throw new Error(
            `Tên vai trò không hợp lệ: "${roleName}". Xem tên từng role, vd: Thầy Đồng -> thaydong hoặc medium`,
          );
        }

        const count = parseInt(countStr);
        if (isNaN(count) || count <= 0) {
          throw new Error(
            `Số lượng không hợp lệ cho vai trò "${roleName}": ${countStr}`,
          );
        }

        if (customRoles[roleId]) {
          customRoles[roleId] += count;
        } else {
          customRoles[roleId] = count;
        }
      }
    } catch (err) {
      return interaction.editReply({
        content: `Lỗi phân tích cú pháp: ${(err as Error).message}`,
      });
    }

    let totalPlayers = 0;
    for (const count of Object.values(customRoles)) {
      totalPlayers += count as number;
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
      return interaction.editReply({
        content: `✅ ${interaction.user.globalName || interaction.user.username} đã bắt đầu trò chơi với vai trò tuỳ chỉnh! Vai trò đã được chia.`,
      });
    } catch (err) {
      return interaction.editReply({
        content: `Lỗi: ${(err as Error).message}`,
      });
    }
  };
}

export default new CustomizeRolesName();
