import { AttachmentBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';

import Gunner from '../../types/roles/Gunner.js';
import VoodooWerewolf from '../../types/roles/VoodooWerewolf.js';
import { WEREROLE } from '../../utils/role.js';
import { createAvatarCollage } from '../canvas.js';
import type { GameRoom } from '../room.js';

export async function dayPhase(room: GameRoom): Promise<void> {
  if (room.status === 'ended') {
    return;
  }
  room.gameState.phase = 'day';
  room.emit('day', room.guildId, room.players, room.gameState);

  const isFirstDay = room.gameState.nightCount === 1;
  const dmPromises = room.players.map(async (player) => {
    const user = await room.fetchUser(player.userId);
    if (!user) {
      return;
    }
    await user.send(
      `# ☀️ Ban ngày đã đến. \nHãy thảo luận và bỏ phiếu để loại trừ người khả nghi nhất. Bạn có ${room.settings.discussTime} giây để thảo luận.`,
    );

    const buffer = await createAvatarCollage(room.players, room.client);
    const attachment = new AttachmentBuilder(buffer, { name: 'avatars.png' });

    const embed = new (await import('discord.js')).EmbedBuilder()
      .setTitle('📋 Danh sách người chơi')
      .setColor(0x00ae86)
      .setImage('attachment://avatars.png')
      .setTimestamp();

    if (
      player.role.id === WEREROLE.GUNNER &&
      player.role instanceof Gunner &&
      !isFirstDay &&
      player.role.bullets > 0
    ) {
      const shootButton = new ButtonBuilder()
        .setCustomId(`gunner_shoot_${player.userId}`)
        .setLabel('🔫 Bắn người')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        shootButton,
      );

      await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });
    } else if (player.role.id === WEREROLE.VOODOO &&
      player.role instanceof VoodooWerewolf &&
      player.role.voodooCount > 0
    ) {
      const voodooButton = new ButtonBuilder()
        .setCustomId(`voodoo_voodoo_${player.userId}`)
        .setLabel('🌘 Ác mộng')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        voodooButton,
      );

      await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });
    } else {
      await user.send({
        embeds: [embed],
        files: [attachment],
      });
    }
  });

  await room.safePromiseAllSettled(dmPromises);

  room.addTimeout(
    async () => {
      const playerMessages = room.players.map(player => ({
        userId: player.userId,
        content: '### ⚠️ Thông báo: còn **10** giây để thảo luận!',
      }));

      await room.batchSendMessages(playerMessages);
    },
    room.settings.discussTime * 1000 - 10000,
  );

  await new Promise((resolve) =>
    room.addTimeout(() => resolve(undefined), room.settings.discussTime * 1000),
  );
}
