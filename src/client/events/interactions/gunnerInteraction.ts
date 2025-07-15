import {
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  type Interaction,
} from 'discord.js';
import { MessageFlags } from 'discord.js';

import type { GameRoom } from '../../../../core/room.js';
import rolesData from '../../../../data/data.json' with { type: 'json' };
import { Faction } from '../../../../types/faction.js';
import type Player from '../../../../types/player.js';
import Dead from '../../../../types/roles/Dead.js';
import Gunner from '../../../../types/roles/Gunner.js';
import Villager from '../../../../types/roles/Villager.js';
import { WEREROLE } from '../../../../utils/role.js';
import { PlayerIsDead } from '../../../game/helper.js';

class GunnerInteraction {
  isButtonGunner = async (interaction: Interaction) => {
    if (!interaction.isButton()) {
      return;
    }

    const playerId = interaction.customId.split('_')[2];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được nhấn nút này.',
        flags: MessageFlags.Ephemeral,
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

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);

    try {
      await interaction.showModal(modal);
    } catch (err) {
      console.error('❌ Lỗi khi showModal:', err);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Tương tác đã hết hạn hoặc xảy ra lỗi. Vui lòng thử lại.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  };

  isModalSubmitGunner = async (
    interaction: Interaction,
    gameRoom: GameRoom,
    sender: Player,
  ) => {
    if (!interaction.isModalSubmit()) {
      return;
    }

    if (!gameRoom || gameRoom.gameState.phase !== 'day') {
      return;
    }

    const playerId = interaction.customId.split('_')[3];

    if (interaction.user.id !== playerId) {
      return interaction.reply({
        content: 'Bạn không được gửi form này.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
      });
    }

    const targetPlayer = gameRoom.players[shootIndex - 1];
    if (
      sender.role &&
      sender.role.id === WEREROLE.GUNNER &&
      sender.role instanceof Gunner
    ) {
      if (!targetPlayer.alive) {
        return interaction.editReply({
          content: 'Không thể bắn người đã chết.',
        });
      }

      if (sender.role.bullets <= 0) {
        return interaction.editReply({
          content: 'Bạn đã hết đạn.',
        });
      }

      if (targetPlayer.userId === sender.userId) {
        return interaction.editReply({
          content: 'Bạn không thể bắn chính mình.',
        });
      }

      sender.role.bullets -= 1;
      // targetPlayer.alive = false;
      // targetPlayer.role = new Dead(
      //   targetPlayer.role.faction,
      //   targetPlayer.role.id,
      //   gameRoom.gameState.nightCount,
      // );
      PlayerIsDead(targetPlayer, gameRoom.gameState.nightCount);

      const notifyMessages = gameRoom.players.map((player: Player) => {
        let content = '';
        if (player.userId === targetPlayer.userId) {
          content = '💀 Bạn đã bị Xạ thủ bắn chết.';
        }

        const gunnerName = sender.role && sender.role instanceof Gunner && sender.role.bullets === 1
          ? sender.name
          : 'Xạ Thủ';

        if (content) {
          content += `\n🔫 **${gunnerName}** đã bắn chết **${targetPlayer.name}**!`;
        } else {
          content = `🔫 **${gunnerName}** đã bắn chết **${targetPlayer.name}**!`;
        }

        return { userId: player.userId, content };
      });

      await gameRoom.batchSendMessages(notifyMessages);

      await gameRoom.updateAllPlayerList();

      gameRoom.gameState.addLog(
        `🔫 **${sender.name}** đã bắn chết **${targetPlayer.name}`,
      );

      // Kiểm tra master của hầu gái
      const maidNewRole = await gameRoom.checkIfMasterIsDead(targetPlayer);

      if (maidNewRole) {
        const maidMessages = gameRoom.players.map((player: Player) => ({
          userId: player.userId,
          content: `### 👒 Hầu gái đã lên thay vai trò **${maidNewRole}** của chủ vì chủ đã bị bắn.\n`,
        }));

        await gameRoom.batchSendMessages(maidMessages);
      }

      const cauBeMiengBu = gameRoom.players.find(
        (p) => p.role.deathNight === gameRoom.gameState.nightCount &&
          p.role instanceof Dead &&
          p.role.originalRoleId === WEREROLE.LOUDMOUTH,
      );

      if (cauBeMiengBu && cauBeMiengBu.role instanceof Dead) {
        const revealPlayerId = cauBeMiengBu.role.getStoreInformation().loudmouthPlayer;
        const revealPlayer = gameRoom.players.find((p) => p.userId === revealPlayerId);

        const loudmouthMessages = gameRoom.players.map((player: Player) => ({
          userId: player.userId,
          content: `### 👦 Cậu bé miệng bự đã chết, role của **${revealPlayer?.name}** là **${revealPlayer?.role instanceof Dead ? rolesData[revealPlayer?.role.originalRoleId.toString() as keyof typeof rolesData].title : revealPlayer?.role.name}**`,
        }));

        await gameRoom.batchSendMessages(loudmouthMessages);
      }

      const giaLang = gameRoom.players.find(
        (p) =>
          !p.alive &&
          p.role instanceof Dead &&
          p.role.originalRoleId === WEREROLE.ELDER,
      );
      if (giaLang) {
        gameRoom.gameState.addLog(
          '👴 Già làng đã chết, tất cả những người thuộc phe dân làng đều sẽ bị mất chức năng.',
        );

        const elderMessages = gameRoom.players
          .filter((p) =>
            (p.alive && p.role.faction === Faction.VILLAGER) ||
            (p.role instanceof Dead && p.role.originalRoleId === WEREROLE.ELDER),
          )
          .map((player) => {
            // Reset role to Villager
            player.role = new Villager();
            return {
              userId: player.userId,
              content: '### 👴 Già làng đã chết, tất cả những người thuộc phe dân làng đều sẽ bị mất chức năng.',
            };
          });

        await gameRoom.batchSendMessages(elderMessages);
      }
      await gameRoom.checkEndGame();
    }

    await interaction.editReply({
      content: '✅ Bắn thành công.',
    });
  };
}

export default new GunnerInteraction();
