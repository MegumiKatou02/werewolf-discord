import {
  AttachmentBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  type Message,
  type APIActionRowComponent,
  type APIButtonComponent,
} from 'discord.js';

import { totalVotedWolvesSolve } from '../../src/game/helper.js';
import { Faction } from '../../types/faction.js';
import FoxSpirit from '../../types/roles/FoxSpirit.js';
import Gunner from '../../types/roles/Gunner.js';
import Loudmouth from '../../types/roles/loudmouth.js';
import Medium from '../../types/roles/Medium.js';
import Puppeteer from '../../types/roles/Puppeteer.js';
import Stalker from '../../types/roles/Stalker.js';
import VoodooWerewolf from '../../types/roles/VoodooWerewolf.js';
import Witch from '../../types/roles/Witch.js';
import { WEREROLE } from '../../utils/role.js';
import { createAvatarCollage } from '../canvas.js';
import type { GameRoom } from '../room.js';

export async function nightPhase(room: GameRoom): Promise<void> {
  room.gameState.phase = 'night';
  room.gameState.nightCount += 1;

  room.emit('night', room.guildId, room.players, room.gameState);

  const wolfMessages: Message[] = [];

  const dmPromises = room.players.map(async (player) => {
    const user = await room.fetchUser(player.userId);
    if (!user) {
      return;
    }

    await user.send(
      `# 🌑 Đêm ${room.gameState.nightCount === 1 ? 'đầu tiên' : `thứ ${room.gameState.nightCount}`}.`,
    );

    const buffer = await createAvatarCollage(room.players, room.client);
    const attachment = new AttachmentBuilder(buffer, { name: 'avatars.png' });

    const embed = new (await import('discord.js')).EmbedBuilder()
      .setTitle('📋 Danh sách người chơi')
      .setColor(0x00ae86)
      .setImage('attachment://avatars.png')
      .setTimestamp();

    let message;

    if (player.role.id === WEREROLE.WEREWOLF) {
      const voteButton = new ButtonBuilder()
        .setCustomId(`vote_target_wolf_${player.userId}`)
        .setLabel('🗳️ Vote người cần giết')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        voteButton,
      );

      await user.send(
        `🌙 Bạn là **Sói**. Hãy vote người cần giết trong ${room.settings.wolfVoteTime} giây. Bạn có thể trò chuyện với các Sói khác ngay tại đây.`,
      );
      message = await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });
      wolfMessages.push(message);
      room.nightMessages.set(player.userId, message);
    } else if (player.role.id === WEREROLE.WOLFSEER) {
      const viewButton = new ButtonBuilder()
        .setCustomId(`view_target_wolfseer_${player.userId}`)
        .setLabel('🔍 Xem vai trò')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        viewButton,
      );

      await user.send(
        '🌙 Bạn là **Sói Tiên Tri**. Bạn có thể xem vai trò của một người chơi có phải là tiên tri hay không.',
      );
      message = await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });
      room.nightMessages.set(player.userId, message);
    } else if (player.role.id === WEREROLE.ALPHAWEREWOLF) {
      const maskButton = new ButtonBuilder()
        .setCustomId(`mask_target_alphawerewolf_${player.userId}`)
        .setLabel('👤 Che sói')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        maskButton,
      );

      await user.send(
        '🌙 Bạn là **Sói Trùm**. Bạn có thể che sói khỏi tiên tri, mỗi đêm 1 sói, được phép che liên tục một sói.',
      );
      message = await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });
      room.nightMessages.set(player.userId, message);
    } else if (player.role.id === WEREROLE.BODYGUARD) {
      const protectButton = new ButtonBuilder()
        .setCustomId(`protect_target_bodyguard_${player.userId}`)
        .setLabel('🛡️ Bảo vệ người')
        .setStyle(ButtonStyle.Secondary);

      if (!player.canUseSkill) {
        protectButton.setDisabled(true);
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        protectButton,
      );

      await user.send(
        '🌙 Bạn là **Bảo Vệ**. Hãy chọn người bạn muốn bảo vệ trong đêm nay. Bạn có thể tự bảo vệ mình.',
      );
      message = await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });
      room.nightMessages.set(player.userId, message);
    } else if (player.role.id === WEREROLE.SEER) {
      const viewButton = new ButtonBuilder()
        .setCustomId(`view_target_seer_${player.userId}`)
        .setLabel('🔍 Xem phe')
        .setStyle(ButtonStyle.Secondary);

      if (!player.canUseSkill) {
        viewButton.setDisabled(true);
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        viewButton,
      );

      await user.send(
        '🌙 Bạn là **Tiên Tri**. Bạn có thể xem phe của một người chơi khác trong đêm nay.',
      );
      message = await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });
      room.nightMessages.set(player.userId, message);
    } else if (player.role.id === WEREROLE.DETECTIVE) {
      const investigateButton = new ButtonBuilder()
        .setCustomId(`investigate_target_detective_${player.userId}`)
        .setLabel('🔎 Điều tra người')
        .setStyle(ButtonStyle.Secondary);

      if (!player.canUseSkill) {
        investigateButton.setDisabled(true);
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        investigateButton,
      );

      await user.send(
        '🌙 Bạn là **Thám Tử**. Bạn có thể điều tra hai người chơi để biết họ ở cùng phe hay khác phe.',
      );
      message = await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });
      room.nightMessages.set(player.userId, message);
    } else if (
      player.role.id === WEREROLE.WITCH &&
      player.role instanceof Witch
    ) {
      const poisonButton = new ButtonBuilder()
        .setCustomId(`poison_target_witch_${player.userId}`)
        .setLabel('💊 Đầu độc người')
        .setStyle(ButtonStyle.Secondary);

      if (player.role.poisonCount <= 0) {
        poisonButton.setDisabled(true);
      }

      const healButton = new ButtonBuilder()
        .setCustomId(`heal_target_witch_${player.userId}`)
        .setLabel('💫 Cứu người')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

      if (!player.canUseSkill) {
        poisonButton.setDisabled(true);
        healButton.setDisabled(true);
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        poisonButton,
        healButton,
      );

      await user.send(
        `🌙 Bạn là **Phù Thuỷ**. Bạn có hai bình thuốc: một để đầu độc và một để cứu người. Bình cứu chỉ có tác dụng nếu người đó bị tấn công.\n (Bình độc: ${player.role.poisonCount}, Bình cứu: ${Math.max(0, player.role.healCount)}).`,
      );
      message = await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });

      room.witchMessages.set(player.userId, message);
      room.nightMessages.set(player.userId, message);
    } else if (
      player.role.id === WEREROLE.MEDIUM &&
      player.role instanceof Medium
    ) {
      const reviveButton = new ButtonBuilder()
        .setCustomId(`revive_target_medium_${player.userId}`)
        .setLabel('🔮 Hồi sinh người')
        .setStyle(ButtonStyle.Secondary);

      if (player.role.revivedCount <= 0) {
        reviveButton.setDisabled(true);
      }

      if (!player.canUseSkill) {
        reviveButton.setDisabled(true);
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        reviveButton,
      );

      const villagerDead = room.players
        .filter((player) => {
          return player.role.faction === 1 && !player.alive;
        })
        .map((player) => `**${player.name}**`)
        .join(', ');
      await user.send(
        '🌙 Bạn là **Thầy Đồng**. Bạn có thể hồi sinh một người phe dân đã chết trong đêm nay. Bạn chỉ có thể làm điều này một lần trong ván đấu.',
      );
      if (player.alive && villagerDead.length > 0) {
        await user.send(
          `${villagerDead} là những người thuộc phe dân làng đã bị chết, bạn có thể hồi sinh trong số họ.`,
        );
      }
      message = await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });
      room.nightMessages.set(player.userId, message);
    } else if (player.role.id === WEREROLE.DEAD) {
      await user.send(
        '💀 Bạn đã bị chết, hãy trò chuyện với hội người âm của bạn.',
      );

      message = await user.send({ embeds: [embed], files: [attachment] });
      room.nightMessages.set(player.userId, message);
    } else if (player.role.id === WEREROLE.FOOL) {
      await user.send(
        '⚜️ Bạn là thằng ngố, nhiệm vụ của bạn là lừa những người khác vote bạn để chiến thắng.',
      );

      message = await user.send({ embeds: [embed], files: [attachment] });
      room.nightMessages.set(player.userId, message);
    } else if (
      player.role.id === WEREROLE.FOXSPIRIT &&
      player.role instanceof FoxSpirit
    ) {
      await user.send(
        '🦊 Bạn là **Cáo**. Mỗi đêm dậy soi 3 người tự chọn trong danh sách, nếu 1 trong 3 người đó là sói thì được báo \\"Có sói\\", nếu đoán hụt thì mất chức năng.',
      );

      const viewButton = new ButtonBuilder()
        .setCustomId(`view_target_foxspirit_${player.userId}`)
        .setLabel('🔍 Tìm sói')
        .setStyle(ButtonStyle.Secondary);

      if (!player.canUseSkill || !player.role.isHaveSkill) {
        viewButton.setDisabled(true);
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        viewButton,
      );

      message = await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });
      room.nightMessages.set(player.userId, message);
    } else if (player.role.id === WEREROLE.MAID) {
      let chooseMasterButton = null as ButtonBuilder | null;
      if (room.gameState.nightCount === 1) {
        chooseMasterButton = new ButtonBuilder()
          .setCustomId(`choose_master_maid_${player.userId}`)
          .setLabel('👑 Chọn chủ')
          .setStyle(ButtonStyle.Secondary);
      } else {
        chooseMasterButton = new ButtonBuilder()
          .setCustomId(`choose_master_maid_${player.userId}`)
          .setLabel('👑 Đã chọn chủ')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true);
      }

      if (!player.canUseSkill && chooseMasterButton) {
        chooseMasterButton.setDisabled(true);
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        chooseMasterButton!,
      );

      await user.send(
        '🌙 Bạn là **Hầu Gái**. Hãy chọn một người làm chủ của bạn (chỉ được chọn trong đêm đầu tiên).',
      );
      message = await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });
      room.nightMessages.set(player.userId, message);
    } else if (player.role.id === WEREROLE.LYCAN) {
      await user.send(
        '🤷 Bạn là **Lycan**. Hãy chấp nhận số phận của mình đi!!!',
      );

      message = await user.send({ embeds: [embed], files: [attachment] });
      room.nightMessages.set(player.userId, message);
    } else if (player.role.id === WEREROLE.ELDER) {
      await user.send(
        '👴 Bạn là **Già Làng**. Sói phải cắn 2 lần thì Già làng mới chết.',
      );

      message = await user.send({ embeds: [embed], files: [attachment] });
      room.nightMessages.set(player.userId, message);
    } else if (
      player.role.id === WEREROLE.STALKER &&
      player.role instanceof Stalker
    ) {
      await user.send(
        `👀 Bạn là **Stalker**. Bạn có thể theo dõi 1 người chơi và biết đêm đó họ có hành động hay không. Bạn còn có thể chọn người để ám sát, nếu ám sát trúng người không làm gì đêm đó thì người đó chết. Thắng khi là người duy nhất sống sót. (Theo dõi: ${player.role.stalkCount}, Ám sát: ${player.role.killCount})`,
      );

      const stalkButton = new ButtonBuilder()
        .setCustomId(`stalk_target_stalker_${player.userId}`)
        .setLabel('👀 Theo dõi')
        .setStyle(ButtonStyle.Secondary);

      if (player.role.stalkCount <= 0) {
        stalkButton.setDisabled(true);
      }

      const killButton = new ButtonBuilder()
        .setCustomId(`kill_target_stalker_${player.userId}`)
        .setLabel('🔪 Ám sát')
        .setStyle(ButtonStyle.Secondary);

      if (player.role.killCount <= 0) {
        killButton.setDisabled(true);
      }

      if (!player.canUseSkill) {
        stalkButton.setDisabled(true);
        killButton.setDisabled(true);
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        stalkButton,
        killButton,
      );

      message = await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });
      room.nightMessages.set(player.userId, message);
    } else if (
      player.role.id === WEREROLE.GUNNER &&
      player.role instanceof Gunner
    ) {
      await user.send(
        `🔫 Bạn là **Xạ thủ**. Bạn có hai viên đạn, bạn có thể sử dụng đạn để bắn người chơi khác. Bạn chỉ có thể bắn một viên đạn mỗi ngày (Đạn: ${player.role.bullets}).`,
      );

      message = await user.send({ embeds: [embed], files: [attachment] });
      room.nightMessages.set(player.userId, message);
    } else if (player.role.id === WEREROLE.KITTENWOLF) {
      await user.send(
        '🐺 Bạn là **Sói Mèo Con**. Khi bạn bị giết, cuộc bỏ phiếu của sói tiếp theo sẽ biến đổi một dân làng thành ma sói thay vì giết chết họ.',
      );

      const voteButton = new ButtonBuilder()
        .setCustomId(`vote_target_wolf_${player.userId}`)
        .setLabel('🗳️ Vote người cần giết')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        voteButton,
      );

      message = await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });
      wolfMessages.push(message);
      room.nightMessages.set(player.userId, message);
    } else if (
      player.role.id === WEREROLE.PUPPETEER &&
      player.role instanceof Puppeteer
    ) {
      await user.send(
        '🐕‍🦺 Bạn là **Người Múa Rối**. Một lần duy nhất trong suốt ván chơi, bạn có thể chỉ định Sói ăn thịt một người. Người đó có thể là một người khác so với sự thống nhất ban đầu của Sói. Bạn cũng có thể buộc Sói ăn thịt một Sói khác.',
      );
      const puppetButton = new ButtonBuilder()
        .setCustomId(`puppet_target_puppeteer_${player.userId}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('🎭 Chỉ định mục tiêu');

      if (!player.canUseSkill) {
        puppetButton.setDisabled(true);
      }

      if (player.role.targetCount <= 0) {
        puppetButton.setLabel('🎭 Đã chỉ định mục tiêu');
        puppetButton.setDisabled(true);
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        puppetButton,
      );

      message = await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });
      room.nightMessages.set(player.userId, message);
    } else if (
      player.role.id === WEREROLE.VOODOO &&
      player.role instanceof VoodooWerewolf
    ) {
      const voteButton = new ButtonBuilder()
        .setCustomId(`vote_target_wolf_${player.userId}`)
        .setLabel('🗳️ Vote người cần giết')
        .setStyle(ButtonStyle.Primary);

      const silentButton = new ButtonBuilder()
        .setCustomId(`voodoo_silent_${player.userId}`)
        .setLabel('🔇 Làm câm lặng')
        .setStyle(ButtonStyle.Secondary);

      if (player.role.silentCount <= 0) {
        silentButton.setDisabled(true);
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        voteButton,
        silentButton,
      );
      await user.send(
        '🐺 Bạn là **Sói Tà Thuật**. Bạn có thể làm câm lặng một người chơi, ngăn chặn họ nói chuyện và bỏ phiếu. Ngoài ra, một lần trong trò chơi, bạn có thể đưa một người chơi chìm vào cơn ác mộng, ngăn chặn mọi hành động ban đêm của họ.',
      );
      message = await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });

      wolfMessages.push(message);
      room.nightMessages.set(player.userId, message);
    } else if (
      player.role.id === WEREROLE.WOLFFLUENCE
    ) {
      await user.send(
        '🐺 Bạn là **Sói Thao Túng**. Bạn có thể điều khiển phiếu bầu của người chơi mỗi đêm.',
      );

      const voteButton = new ButtonBuilder()
        .setCustomId(`vote_target_wolf_${player.userId}`)
        .setLabel('🗳️ Vote người cần giết')
        .setStyle(ButtonStyle.Primary);

      const influenceButton = new ButtonBuilder()
        .setCustomId(`influence_target_wolffluence_${player.userId}`)
        .setLabel('🌘 Thao túng')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        voteButton,
        influenceButton,
      );

      message = await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });

      wolfMessages.push(message);
      room.nightMessages.set(player.userId, message);
    } else if (
      player.role.id === WEREROLE.LOUDMOUTH &&
      player.role instanceof Loudmouth
    ) {
      let revealPlayer: undefined | typeof room.players[number] = undefined;
      if (player.role.revealPlayer) {
        revealPlayer = room.players.find((p) => p.role instanceof Loudmouth && p.userId === p.role.revealPlayer);
      }
      await user.send(
        `👦 Bạn là cậu bé miệng bự, ${revealPlayer ? `bạn đã chọn người chơi **${revealPlayer.name}** để tiết lộ vai trò khi bạn chết` : 'hãy chọn người chơi để tiết lộ vai trò khi bạn chết'}`,
      );

      const muteButton = new ButtonBuilder()
        .setCustomId(`target_loudmouth_player_${player.userId}`)
        .setLabel('👦 Tiết lộ')
        .setStyle(ButtonStyle.Secondary);

      if (!player.canUseSkill) {
        muteButton.setDisabled(true);
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        muteButton,
      );

      message = await user.send({
        embeds: [embed],
        files: [attachment],
        components: [row],
      });

      room.nightMessages.set(player.userId, message);
    } else {
      await user.send(`🌙 Bạn là dân làng, một đêm yên tĩnh trôi qua. Bạn hãy chờ ${room.settings.nightTime} giây cho đến sáng.`);

      message = await user.send({ embeds: [embed], files: [attachment] });
      room.nightMessages.set(player.userId, message);
    }
  });

  await room.safePromiseAllSettled(dmPromises);

  room.addTimeout(
    async () => {
      const wolfMessagesToSend = room.players
        .filter((p) => p.role.faction === Faction.WEREWOLF)
        .map(wolf => ({
          userId: wolf.userId,
          content: '### ⚠️ Thông báo: sói còn **10** giây để vote!',
        }));

      await room.batchSendMessages(wolfMessagesToSend);
    },
    room.settings.wolfVoteTime * 1000 - 10000,
  );

  room.addTimeout(async () => {
    for (const message of wolfMessages) {
      try {
        const row = ActionRowBuilder.from(
          message.components[0] as APIActionRowComponent<APIButtonComponent>,
        ) as ActionRowBuilder<ButtonBuilder>;

        row.components.forEach((component) => {
          const data = (component as ButtonBuilder).data;
          if ('custom_id' in data && data.custom_id?.startsWith('vote_target_wolf_')) {
            (component as ButtonBuilder)
              .setDisabled(true)
              .setLabel('🗳️ Hết thời gian vote');
          }
        });

        await message.edit({ components: [row] });
        await message.reply('⏰ Đã hết thời gian vote!\n');
      } catch (err) {
        console.error('Không thể cập nhật nút vote của Sói:', err);
      }
    }
    const mostVotedUserId = totalVotedWolvesSolve(room.players);
    if (mostVotedUserId) {
      for (const player of room.players) {
        if (
          player.role.id === WEREROLE.WITCH &&
          player.role instanceof Witch &&
          player.role.healCount > 0
        ) {
          const user = await room.fetchUser(player.userId);
          if (user) {
            player.role.needHelpPerson = mostVotedUserId;

            const witchMessage = room.witchMessages.get(player.userId);
            if (witchMessage) {
              const row = ActionRowBuilder.from(
                witchMessage
                  .components[0] as APIActionRowComponent<APIButtonComponent>,
              ) as ActionRowBuilder<ButtonBuilder>;
              (row.components[1] as ButtonBuilder).setDisabled(false);
              await witchMessage.edit({ components: [row] });
            }
            const victim = room.players.find(
              (p) => p.userId === mostVotedUserId,
            );
            const victimIndex =
              room.players.findIndex((p) => p.userId === mostVotedUserId) + 1;
            await user.send(
              `🌙 Sói đã chọn giết người chơi **${victim?.name}** (${victimIndex}).`,
            );
          }
        }
      }
    }
  }, room.settings.wolfVoteTime * 1000);

  room.addTimeout(
    async () => {
      const playerMessages = room.players.map(player => ({
        userId: player.userId,
        content: '### ⚠️ Thông báo: còn **10** giây nữa trời sẽ sáng!',
      }));

      await room.batchSendMessages(playerMessages);
    },
    room.settings.nightTime * 1000 - 10000,
  );

  room.addTimeout(async () => {
    for (const [playerId, message] of room.nightMessages) {
      try {
        if (message.components && message.components.length > 0) {
          const rows = message.components.map((row) => {
            const newRow = ActionRowBuilder.from(
              row as APIActionRowComponent<APIButtonComponent>,
            ) as ActionRowBuilder<ButtonBuilder>;
            newRow.components.forEach((component) => {
              (component as ButtonBuilder).setDisabled(true);
              const buttonComponent = component as ButtonBuilder;
              if (
                buttonComponent.data &&
                'label' in buttonComponent.data &&
                buttonComponent.data.label
              ) {
                buttonComponent.setLabel(
                  `${buttonComponent.data.label} (Hết hạn)`,
                );
              }
            });
            return newRow;
          });
          await message.edit({ components: rows });
        }
      } catch (err) {
        console.error(`Không thể disable button cho ${playerId}:`, err);
      }
    }
    room.nightMessages.clear();
  }, room.settings.nightTime * 1000);

  await new Promise((resolve) =>
    room.addTimeout(() => resolve(undefined), room.settings.nightTime * 1000),
  );
}
