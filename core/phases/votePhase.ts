import { AttachmentBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, type APIActionRowComponent, type APIButtonComponent } from 'discord.js';

import rolesData from '../../data/data.json' with { type: 'json' };
import { processVote, revealRoles } from '../../src/game/helper.js';
import Dead from '../../types/roles/Dead.js';
import Villager from '../../types/roles/Villager.js';
import Werewolf from '../../types/roles/WereWolf.js';
import { WEREROLE } from '../../utils/role.js';
import { createAvatarCollage } from '../canvas.js';
import type { GameRoom } from '../room.js';

export async function votePhase(room: GameRoom): Promise<void> {
  if (room.status === 'ended') {
    return;
  }
  room.gameState.phase = 'voting';
  room.emit('vote', room.guildId, room.players, room.gameState);

  const dmPromises = room.players.map(async (player) => {
    const user = await room.fetchUser(player.userId);
    if (!user) {
      return;
    }
    await user.send(
      `🗳️ Thời gian bỏ phiếu đã đến. Người có số phiếu cao nhất và có ít nhất 2 phiếu sẽ bị treo cổ. Hãy chọn người bạn muốn loại trừ trong ${room.settings.voteTime} giây tới.\n💡 Nhập số 0 hoặc 36 để bỏ qua vote.`,
    );

    const buffer = await createAvatarCollage(room.players, room.client);
    const attachment = new AttachmentBuilder(buffer, { name: 'avatars.png' });

    const embed = new (await import('discord.js')).EmbedBuilder()
      .setTitle('📋 Danh sách người chơi')
      .setColor(0x00ae86)
      .setImage('attachment://avatars.png')
      .setTimestamp();

    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    if (player.alive) {
      const voteButton = new ButtonBuilder()
        .setCustomId(`vote_hanged_${player.userId}`)
        .setLabel('🗳️ Vote người bị treo')
        .setStyle(ButtonStyle.Primary);

      if (!player.canVote) {
        voteButton.setDisabled(true);
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        voteButton,
      );
      components.push(row);
    }
    const message = await user.send({
      embeds: [embed],
      files: [attachment],
      components,
    });
    room.voteMessages.set(player.userId, message);
  });

  await room.safePromiseAllSettled(dmPromises);

  const timeoutPromise = new Promise((resolve) =>
    room.addTimeout(() => resolve('timeout'), room.settings.voteTime * 1000),
  );

  // eslint-disable-next-line no-unused-vars
  let voteCompleteResolve: ((value: unknown) => void) | undefined;
  const voteCompletePromise = new Promise((resolve) => {
    voteCompleteResolve = resolve;
    room.once('voteComplete', resolve);
  });

  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  const notificationPromise = new Promise<void>((resolve) => {
    room.addTimeout(
      async () => {
        const playerMessages = room.players.map(player => ({
          userId: player.userId,
          content: '### ⚠️ Thông báo: còn **10** giây nữa hết thời gian vote!',
        }));

        await room.batchSendMessages(playerMessages);
        resolve();
      },
      room.settings.voteTime * 1000 - 10000,
    );
  });

  // **check
  // room.trackPromise(timeoutPromise as Promise<unknown>);
  // room.trackPromise(voteCompletePromise as Promise<unknown>);
  // room.trackPromise(notificationPromise as Promise<unknown>);

  try {
    await Promise.race([timeoutPromise, voteCompletePromise]);
  } finally {
    if (voteCompleteResolve) {
      room.removeListener('voteComplete', voteCompleteResolve);
    }
  }

  for (const [playerId, message] of room.voteMessages) {
    try {
      if (message.components && message.components.length > 0) {
        const row = ActionRowBuilder.from(
          message.components[0] as APIActionRowComponent<APIButtonComponent>,
        ) as ActionRowBuilder<ButtonBuilder>;
        (row.components[0] as ButtonBuilder)
          .setDisabled(true)
          .setLabel('🗳️ Vote (Hết hạn)');
        await message.edit({ components: [row] });
      }
    } catch (err) {
      console.error(`Không thể disable button cho ${playerId}:`, err);
    }
  }
  room.voteMessages.clear();

  const resultHangedPlayer = processVote(room.players);

  if (!resultHangedPlayer) {
    room.gameState.addLog('Không ai bị treo cổ do không đủ phiếu bầu\n');
    const noHangPromises = room.players.map(async (player) => {
      const user = await room.fetchUser(player.userId);
      if (!user) {
        return;
      }
      await user.send(
        '🎭 Không đủ số phiếu hoặc có nhiều người cùng số phiếu cao nhất, không ai bị treo cổ trong ngày hôm nay.',
      );
    });
    await room.safePromiseAllSettled(noHangPromises);
  } else {
    room.gameState.addLog(
      `**${resultHangedPlayer.hangedPlayer.name}** đã bị dân làng treo cổ`,
    );
    if (resultHangedPlayer.hangedPlayer.role.id === WEREROLE.FOOL) {
      room.gameState.addLog(
        `**${resultHangedPlayer.hangedPlayer.name}** là Thằng Ngố - Thằng Ngố thắng!`,
      );
      room.status = 'ended';
      const foolMessages = room.players.map(async (player) => {
        const user = await room.fetchUser(player.userId);
        if (!user) {
          return;
        }
        await user.send(
          `🎭 **${resultHangedPlayer.hangedPlayer.name}** là **Ngố** và đã bị treo cổ. \n🎉 **Ngố** thắng !!.`,
        );
        const roleRevealEmbed = revealRoles(room.players);
        await user.send({ embeds: [roleRevealEmbed] });
      });
      await room.safePromiseAllSettled(foolMessages);
      return;
    }

    const maidNewRole = await room.checkIfMasterIsDead(resultHangedPlayer.hangedPlayer);

    const hangMessages = room.players.map(async (player) => {
      const user = await room.fetchUser(player.userId);
      if (!user) {
        return;
      }
      await user.send(
        `🎭 **${resultHangedPlayer.hangedPlayer.name}** đã bị dân làng treo cổ vì có số phiếu cao nhất (${resultHangedPlayer.maxVotes} phiếu).`,
      );
      if (resultHangedPlayer.hangedPlayer.userId === player.userId) {
        await user.send('💀 Bạn đã bị dân làng treo cổ.');
      }
      if (maidNewRole) {
        await user.send(
          `### 👒 Hầu gái đã lên thay vai trò **${maidNewRole}** của chủ vì chủ đã bị treo cổ.\n`,
        );
      }
    });

    await room.safePromiseAllSettled(hangMessages);
  }

  const normalWolvesAlive = room.players.filter(
    (p) => p.alive && p.role.faction === 0 && p.role.id === WEREROLE.WEREWOLF,
  );
  const otherWolvesAlive = room.players.filter(
    (p) => p.alive && p.role.faction === 0 && p.role.id !== WEREROLE.WEREWOLF,
  );

  if (normalWolvesAlive.length === 0 && otherWolvesAlive.length > 0) {
    const wolfTransformPromises = otherWolvesAlive.map(async (wolf) => {
      wolf.role = new Werewolf();
      const user = await room.fetchUser(wolf.userId);
      if (user) {
        return user.send(
          '### 🐺 Vì không còn Sói thường nào sống sót, bạn đã biến thành Sói thường!',
        );
      }
    });

    await room.safePromiseAllSettled(wolfTransformPromises);

    room.gameState.addLog(
      `🐺 **${otherWolvesAlive.length}** Sói chức năng đã biến thành **Sói thường** vì không còn Sói thường nào sống sót.`,
    );
  }

  const giaLang = room.players.find(
    (p) =>
      !p.alive &&
      p.role.id === WEREROLE.DEAD &&
      p.role instanceof Dead &&
      p.role.originalRoleId === WEREROLE.ELDER,
  );
  if (giaLang && !giaLang.alive) {
    const dmVillagerPromise = room.players
      .filter(
        (p) =>
          (p.alive && p.role.faction === 1) || p.role.id === WEREROLE.ELDER,
      )
      .map(async (player) => {
        const user = await room.fetchUser(player.userId);
        if (!user) {
          return;
        }
        await user.send(
          '### 👴 Già làng đã chết, tất cả những người thuộc phe dân làng đều sẽ bị mất chức năng.',
        );
        room.gameState.addLog(
          '👴 Già làng đã chết, tất cả những người thuộc phe dân làng đều sẽ bị mất chức năng.',
        );
        player.role = new Villager();
      });
    await room.safePromiseAllSettled(dmVillagerPromise);
  }

  const loudmouthDead = room.players.find((p) => p.role instanceof Dead && p.role.originalRoleId === WEREROLE.LOUDMOUTH && p.role.deathNight === room.gameState.nightCount);
  if (loudmouthDead && loudmouthDead.role instanceof Dead) {
    const revealPlayerId = loudmouthDead.role.getStoreInformation().loudmouthPlayer;
    const revealPlayer = room.players.find((p) => p.userId === revealPlayerId);

    const dmLoudmouthPromise = room.players.map(async (player) => {
      const user = await room.fetchUser(player.userId);
      if (!user) {
        return;
      }
      await user.send(
        `### 👦 Cậu bé miệng bự đã chết, role của **${revealPlayer?.name}** là **${revealPlayer?.role instanceof Dead ? rolesData[revealPlayer?.role.originalRoleId.toString() as keyof typeof rolesData].title : revealPlayer?.role.name}**`,
      );
    });
    await room.safePromiseAllSettled(dmLoudmouthPromise);
  }
  for (const player of room.players) {
    player.role.voteHanged = null;
    player.resetRestrict();
    player.role.resetRestrict();
  }

  await room.checkEndGame();
}
