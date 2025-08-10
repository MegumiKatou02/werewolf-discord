import rolesData from '../../data/data.json' with { type: 'json' };
import { isActivity, PlayerIsDead, totalVotedWolvesSolve } from '../../src/game/helper.js';
import Bodyguard from '../../types/roles/Bodyguard.js';
import Dead from '../../types/roles/Dead.js';
import Elder from '../../types/roles/Elder.js';
import Medium from '../../types/roles/Medium.js';
import Puppeteer from '../../types/roles/Puppeteer.js';
import Stalker from '../../types/roles/Stalker.js';
import Villager from '../../types/roles/Villager.js';
import Werewolf from '../../types/roles/WereWolf.js';
import Witch from '../../types/roles/Witch.js';
import { assignRolesGame, WEREROLE } from '../../utils/role.js';
import type { GameRoom } from '../room.js';

export async function solvePhase(room: GameRoom): Promise<void> {
  room.gameState.addLog(`## Đêm thứ ${room.gameState.nightCount}`);

  let mostVotedUserId = totalVotedWolvesSolve(room.players);
  const killedPlayers = new Set<string>();
  const sureDieInTheNight = new Set<string>();
  const revivedPlayers = new Set<string>();
  let maidNewRole: string | null = null;
  let giaLangBiTanCong = false;

  const puppeteer = room.players.find(
    (p) => p.role.id === WEREROLE.PUPPETEER,
  );
  if (
    puppeteer &&
    puppeteer.role instanceof Puppeteer &&
    puppeteer.role.targetWolf
  ) {
    mostVotedUserId = puppeteer.role.targetWolf;
    room.gameState.addLog(
      `Người múa rối đã chỉ định sói ăn thịt **${room.players.find((p) => p.userId === mostVotedUserId)?.name}**`,
    );
  }

  const witch = room.players.find((p) => p.role.id === WEREROLE.WITCH);
  const kittenWolfDead = room.players.find((p) => p.role instanceof Dead && p.role.originalRoleId === WEREROLE.KITTENWOLF);

  if (
    kittenWolfDead && mostVotedUserId &&
    kittenWolfDead.role.deathNight === room.gameState.nightCount - 1
  ) {
    const deadPlayer = room.players.find((p) => p.userId === mostVotedUserId);
    if (deadPlayer) {
      deadPlayer.role = new Werewolf();
      room.gameState.addLog(`Sói đã biến người chơi **${deadPlayer.name}** thành Sói Thường`);
    }
  } else if (mostVotedUserId) {
    room.gameState.addLog(
      `Sói đã chọn cắn **${room.players.find((p) => p.userId === mostVotedUserId)?.name}**`,
    );
    const nguoiBiChoCan = room.players.find(
      (p) => p.userId === mostVotedUserId,
    );
    if (
      witch &&
      nguoiBiChoCan &&
      nguoiBiChoCan.userId === witch.userId &&
      room.gameState.nightCount === 1
    ) {
      room.gameState.addLog(
        'Vì là đêm đầu tiên nên phù thuỷ không bị sao cả',
      );
    } else if (
      nguoiBiChoCan &&
      nguoiBiChoCan.role.id === WEREROLE.ELDER &&
      nguoiBiChoCan.role instanceof Elder
    ) {
      nguoiBiChoCan.role.hp -= 1;
      giaLangBiTanCong = true;
      if (nguoiBiChoCan.role.hp <= 0) {
        killedPlayers.add(nguoiBiChoCan.userId);
      }
    } else {
      if (nguoiBiChoCan) {
        killedPlayers.add(nguoiBiChoCan.userId);
      }
    }
  }
  if (witch && witch.role instanceof Witch && witch.role.poisonedPerson) {
    const witchRole = witch.role;
    const nguoiBiDinhDoc = room.players.find(
      (p) => p.userId === witchRole.poisonedPerson,
    );
    if (nguoiBiDinhDoc) {
      room.gameState.addLog(
        `Phù thuỷ đã đầu độc **${nguoiBiDinhDoc.name}**`,
      );
      sureDieInTheNight.add(nguoiBiDinhDoc.userId);
      killedPlayers.delete(nguoiBiDinhDoc.userId);
    }
    witch.role.poisonCount -= 1;
  }
  const stalker = room.players.find((p) => p.role.id === WEREROLE.STALKER);
  for (const player of room.players) {
    if (
      stalker &&
      stalker.role instanceof Stalker &&
      stalker.role.stalkedPerson &&
      stalker.role.stalkedPerson === player.userId &&
      isActivity(room.players, player.role.id)
    ) {
      const user = await room.fetchUser(stalker.userId);
      if (user) {
        await user.send(
          `**Thông báo:** 🔍 bạn đã theo dõi **${player.name}** và người này đã hành động.`,
        );
      }
    }
    if (
      stalker &&
      stalker.role instanceof Stalker &&
      stalker.role.stalkedPerson &&
      stalker.role.stalkedPerson === player.userId &&
      !isActivity(room.players, player.role.id)
    ) {
      const user = await room.fetchUser(stalker.userId);
      if (user) {
        await user.send(
          `**Thông báo:** 🔍 bạn đã theo dõi **${player.name}** và người này không hành động.`,
        );
      }
    }
    if (
      stalker &&
      stalker.role instanceof Stalker &&
      stalker.role.killedPerson &&
      stalker.role.killedPerson === player.userId &&
      isActivity(room.players, player.role.id)
    ) {
      const user = await room.fetchUser(stalker.userId);
      if (user) {
        await user.send(
          `Vì **${player.name}** đã hành động nên bạn không thể giết được người này.`,
        );
      }
    }
    if (
      stalker &&
      stalker.role instanceof Stalker &&
      stalker.role.killedPerson &&
      stalker.role.killedPerson === player.userId &&
      !isActivity(room.players, player.role.id)
    ) {
      const user = await room.fetchUser(stalker.userId);
      if (user) {
        await user.send(
          `Vì **${player.name}** không hành động nên bạn đã giết được người này.`,
        );
        room.gameState.addLog(`Stalker đã giết **${player.name}**`);
        sureDieInTheNight.add(player.userId);
        killedPlayers.delete(player.userId);
      }
    }
  }
  const guard = room.players.find((p) => p.role.id === WEREROLE.BODYGUARD);
  const giaLang = room.players.find((p) => p.role.id === WEREROLE.ELDER);
  for (const killedId of killedPlayers) {
    if (!guard || !guard.alive) {
      break;
    }

    if (
      guard.role instanceof Bodyguard &&
      (killedId === guard.role.protectedPerson || killedId === guard.userId)
    ) {
      const hp = (guard.role.hp -= 1);
      room.gameState.addLog(
        `Bảo vệ đã bảo vệ **${room.players.find((p) => p.userId === killedId)?.name}**, anh ấy còn ${hp} máu`,
      );
      killedPlayers.delete(killedId);
      if (hp <= 0) {
        killedPlayers.add(guard.userId);
        room.gameState.addLog('Bảo vệ đã chết do chịu 2 lần cắn của sói');
      }

      if (
        giaLangBiTanCong &&
        giaLang &&
        giaLang.role instanceof Elder &&
        giaLang.userId === killedId
      ) {
        giaLang.role.hp += 1;
        giaLangBiTanCong = false;
        killedPlayers.delete(giaLang.userId);
      }
    }
  }
  if (witch && witch.role instanceof Witch && witch.role.healedPerson) {
    const witchRole = witch.role;
    const saved = room.players.find(
      (p) => p.userId === witchRole.healedPerson,
    );
    room.gameState.addLog(`Phù thuỷ đã chọn cứu **${saved?.name}**`);
    if (
      saved &&
      killedPlayers.has(saved.userId) &&
      killedPlayers.has(witch.role.healedPerson)
    ) {
      room.gameState.addLog(`Phù thuỷ cứu được **${saved.name}**`);

      witch.role.healCount -= 1;
      killedPlayers.delete(saved.userId);
    }
  }

  const medium = room.players.find((p) => p.role.id === WEREROLE.MEDIUM);
  if (medium && medium.role instanceof Medium && medium.role.revivedPerson) {
    const mediumRole = medium.role;
    const saved = room.players.find(
      (p) => p.userId === mediumRole.revivedPerson && !p.alive,
    );
    if (saved && saved.role instanceof Dead) {
      room.gameState.addLog(
        `Thầy đồng đã hồi sinh thành công **${saved.name}**`,
      );

      saved.role = assignRolesGame(saved.role.originalRoleId);
      saved.alive = true;
      revivedPlayers.add(saved.userId);

      medium.role.revivedCount -= 1;
    }
  }

  for (const killedId of killedPlayers) {
    const killed = room.players.find((p) => p.userId === killedId);
    if (
      killed &&
      killed.role.id === WEREROLE.CURSED &&
      mostVotedUserId &&
      killed.userId === mostVotedUserId
    ) {
      room.gameState.addLog(`Bán sói **${killed.name}** đã biến thành sói`);
      const user = await room.fetchUser(killed.userId);
      if (user) {
        await user.send('### Bạn đã bị sói cắn và biến thành sói');
      }

      killed.role = new Werewolf();
      killed.alive = true;
      killedPlayers.delete(killedId);
    } else if (killed) {
      PlayerIsDead(killed, room.gameState.nightCount);
    }
  }
  for (const killedId of sureDieInTheNight) {
    const killed = room.players.find((p) => p.userId === killedId);
    if (killed) {
      PlayerIsDead(killed, room.gameState.nightCount);
    }
  }

  const allDeadTonight = new Set<string>([...killedPlayers, ...sureDieInTheNight]);

  for (const killedId of Array.from(allDeadTonight)) {
    const killed = room.players.find((p) => p.userId === killedId);
    if (killed) {
      maidNewRole = await room.checkIfMasterIsDead(killed);
    }
  }

  if (giaLang && !giaLang.alive) {
    room.gameState.addLog(
      '👴 Già làng đã chết, tất cả những người thuộc phe dân làng đều sẽ bị mất chức năng.',
    );
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
        player.role = new Villager();
      });
    await room.safePromiseAllSettled(dmVillagerPromise);
  }

  const cauBeMiengBu = room.players.find((p) => p.role instanceof Dead && p.role.originalRoleId === WEREROLE.LOUDMOUTH && p.role.deathNight === room.gameState.nightCount);

  if (allDeadTonight.size !== 0) {
    room.gameState.addLog(
      `${Array.from(allDeadTonight)
        .map((id) => {
          const player = room.players.find((p) => p.userId === id);
          return `**${player?.name}**`;
        })
        .join(', ')} đã thiệt mạng\n`,
    );
  }

  if (allDeadTonight.size === 0) {
    room.gameState.addLog('Không có ai thiệt mạng\n');
  }

  const dmPromises = room.players.map(async (player) => {
    const user = await room.fetchUser(player.userId);
    if (!user) {
      return;
    }

    try {
      if (allDeadTonight.size === 0) {
        await user.send('🌙 Đêm nay không ai thiệt mạng.\n');
      } else {
        const killedPlayersList = Array.from(allDeadTonight)
          .map((id) => {
            const p = room.players.find((pp) => pp.userId === id);
            return `**${p?.name}**`;
          })
          .join(', ');

        await user.send(`🌙 Đêm nay, ${killedPlayersList} đã thiệt mạng.\n`);

        if (allDeadTonight.has(player.userId)) {
          await user.send('💀 Bạn đã bị giết trong đêm nay.');
          player.alive = false;
        }
      }

      if (maidNewRole) {
        await user.send(
          `### 👒 Hầu gái đã lên thay vai trò **${maidNewRole}** của chủ vì chủ đã chết.\n`,
        );
      }

      if (cauBeMiengBu && cauBeMiengBu.role instanceof Dead) {
        const revealPlayerId = cauBeMiengBu.role.getStoreInformation().loudmouthPlayer;
        const revealPlayer = room.players.find((p) => p.userId === revealPlayerId);

        await user.send(
          `### 👦 Cậu bé miệng bự đã chết, role của **${revealPlayer?.name}** là **${revealPlayer?.role instanceof Dead ? rolesData[revealPlayer?.role.originalRoleId.toString() as keyof typeof rolesData].title : revealPlayer?.role.name}**`,
        );
      }

      if (revivedPlayers.size > 0) {
        const revivedPlayersList = Array.from(revivedPlayers)
          .map((id) => {
            const p = room.players.find((pp) => pp.userId === id);
            return `**${p?.name}**`;
          })
          .join(', ');
        await user.send(
          `### 🔮 ${revivedPlayersList} đã được hồi sinh bởi Thầy Đồng.\n`,
        );

        if (revivedPlayers.has(player.userId)) {
          await user.send('### ✨ Bạn đã được Thầy Đồng hồi sinh!');
        }
      }
    } catch (err) {
      console.error(`Không thể gửi tin nhắn cho ${player.userId}`, err);
    }
  });

  await room.safePromiseAllSettled(dmPromises);

  for (const player of room.players) {
    player.resetDay();
    player.role.resetDay();
  }

  console.log(room.gameState.log);
}
