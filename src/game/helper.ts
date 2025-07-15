import { EmbedBuilder } from 'discord.js';

import rolesData from '../../data/data.json' with { type: 'json' };
import { Faction } from '../../types/faction.js';
import type Player from '../../types/player.js';
import AlphaWerewolf from '../../types/roles/AlphaWerewolf.js';
import Bodyguard from '../../types/roles/Bodyguard.js';
import Dead from '../../types/roles/Dead.js';
import Detective from '../../types/roles/Detective.js';
import FoxSpirit from '../../types/roles/FoxSpirit.js';
import Medium from '../../types/roles/Medium.js';
import Puppeteer from '../../types/roles/Puppeteer.js';
import Seer from '../../types/roles/Seer.js';
import VoodooWerewolf from '../../types/roles/VoodooWerewolf.js';
import Witch from '../../types/roles/Witch.js';
import Wolffluence from '../../types/roles/Wolffluencer.js';
import WolfSeer from '../../types/roles/WolfSeer.js';
import { WEREROLE } from '../../utils/role.js';

export const revealRoles = (players: Player[]) => {
  const roleRevealEmbed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Tiết Lộ Vai Trò')
    .setDescription('```Danh sách vai trò của tất cả người chơi:```')
    .addFields(
      players.map((player: Player) => {
        let nameRole = player.role.name;
        if (player.role.id === WEREROLE.DEAD && player.role instanceof Dead) {
          const keyRole =
              player.role.originalRoleId.toString() as keyof typeof rolesData;
          nameRole = rolesData[keyRole].title;
          if (player.role.originalRoleId === WEREROLE.CURSED) {
            nameRole = `${nameRole} (Bán Sói)`;
          }
        }
        let roleEmoji = '👤';
        // Nếu là người chết thì lấy originalRoleId, còn người chưa chết thì lấy id
        switch (
          (player.role instanceof Dead && player.role.originalRoleId) ||
            player.role.id
        ) {
        case 0:
          roleEmoji = '🐺';
          break;
        case 1:
          roleEmoji = '👥';
          break;
        case 2:
          roleEmoji = '🛡️';
          break;
        case 3:
          roleEmoji = '🌙';
          break;
        case 4:
          roleEmoji = '👁️';
          break;
        case 5:
          roleEmoji = '🔍';
          break;
        case 6:
          roleEmoji = '🧪';
          break;
        case 7:
          roleEmoji = '🃏';
          break;
        case 8:
          roleEmoji = '🔮';
          break;
        case 10:
          roleEmoji = '👒';
          break;
        case 11:
          roleEmoji = '🤷';
          break;
        case 12:
          roleEmoji = '🐺';
          break;
        case 13:
          roleEmoji = '🐺';
          break;
        case 14:
          roleEmoji = '🦊';
          break;
        case 15:
          roleEmoji = '👴';
          break;
        case 16:
          roleEmoji = '👀';
          break;
        case 17:
          roleEmoji = '🔫';
          break;
        case 18:
          roleEmoji = '🐺';
          break;
        case 19:
          roleEmoji = '🐕‍🦺';
          break;
        case 20:
          roleEmoji = '🐺';
          break;
        case 21:
          roleEmoji = '🐺';
          break;
        case 22:
          roleEmoji = '👦';
          break;
        }
        return {
          name: `${roleEmoji} ${nameRole}`,
          value: `**${player.name}**${!player.alive ? ' (💀 Đã chết)' : ''}`,
          inline: true,
        };
      }),
    )
    .setTimestamp()
    .setFooter({ text: 'Hẹ hẹ hẹ' });
  return roleRevealEmbed;
};

/**
 *
 * @description Dùng hàm này trước resetday
 */
export const isActivity = (players: Player[], role: number) => {
    const player = players.find((p) => p.role.id === role);
    if (!player) {
      return false;
    }
    // **check: tinh ca soi thuong va soi co chuc nang vote
    if (
      player.role.faction === Faction.WEREWOLF &&
      'voteBite' in player.role &&
      typeof player.role.voteBite === 'string' &&
      player.role.voteBite
    ) {
      return true;
    }
    // **check
    if (
      player.role.id === WEREROLE.BODYGUARD &&
      player.role instanceof Bodyguard &&
      player.role.protectedPerson
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.SEER &&
      player.role instanceof Seer &&
      player.role.viewCount <= 0
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.DETECTIVE &&
      player.role instanceof Detective &&
      player.role.investigatedPairs.length > 0
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.WITCH &&
      player.role instanceof Witch &&
      player.role.poisonedPerson
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.WITCH &&
      player.role instanceof Witch &&
      player.role.healedPerson
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.MEDIUM &&
      player.role instanceof Medium &&
      player.role.revivedPerson
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.WOLFSEER &&
      player.role instanceof WolfSeer &&
      player.role.seerCount <= 0
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.ALPHAWEREWOLF &&
      player.role instanceof AlphaWerewolf &&
      player.role.maskWolf
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.FOXSPIRIT &&
      player.role instanceof FoxSpirit &&
      player.role.threeViewed.length > 0
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.PUPPETEER &&
      player.role instanceof Puppeteer &&
      player.role.targetWolf
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.VOODOO &&
      player.role instanceof VoodooWerewolf &&
      player.role.silentPlayer
    ) {
      return true;
    }
    if (
      player.role.id === WEREROLE.WOLFFLUENCE &&
      player.role instanceof Wolffluence &&
      player.role.influencePlayer
    ) {
      return true;
    }

    return false;
};

export const totalVotedWolvesSolve = (players: Player[]) => {
  const totalVotes = players.reduce(
    (acc: Record<string, number>, player) => {
      if (player.role.faction === Faction.WEREWOLF && 'voteBite' in player.role && typeof player.role.voteBite === 'string') {
        acc[player.role.voteBite] = (acc[player.role.voteBite] || 0) + 1;
      }
      return acc;
    },
    {},
  );

  const voteEntries = Object.entries(totalVotes);

  console.log(totalVotes);

  if (voteEntries.length === 0) {
    return null;
  }

  let maxVotes = 0;
  let candidates: string[] = [];

  for (const [userId, count] of voteEntries) {
    if (count > maxVotes) {
      maxVotes = count;
      candidates = [userId];
    } else if (count === maxVotes) {
      candidates.push(userId);
    }
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  return null;
};

/**
 * @property {string} winner -  ('werewolf', 'village', 'solo').
 * @property {number} faction -  (0: sói, 1: dân, 2: solo)
 */
export const checkVictory = (players: Player[]) => {
  const alivePlayers = players.filter((p) => p.alive);
  const aliveWolves = alivePlayers.filter((p) => p.role.faction === 0);
  // const aliveVillagers = alivePlayers.filter((p) => p.role.faction === 1);
  const aliveSolos = alivePlayers.filter((p) => p.role.faction === 2);

  if (alivePlayers.length === aliveSolos.length && aliveSolos.length > 0) {
    return { winner: 'solo', faction: 2 };
  }

  if (aliveWolves.length === 0) {
    return { winner: 'village', faction: 1 };
  }

  const nonWolves = alivePlayers.length - aliveWolves.length;
  if (aliveWolves.length >= nonWolves) {
    return { winner: 'werewolf', faction: 0 };
  }

  return null;
};

export const processVote = (players: Player[]) => {
  let fluencePlayerId: null | string = null;;
  players.forEach((player) => {
    if (player.role instanceof Wolffluence && player.alive && player.role.influencePlayer) {
      fluencePlayerId = player.role.influencePlayer;
    }
  });
  // const fluencePlayer = this.players.find((p) => p.userId === fluencePlayerId);

  const totalVotes = players.reduce(
    (acc: Record<string, number>, player) => {
      if (
        player.alive &&
        player.role.voteHanged &&
        player.role.voteHanged !== 'skip'
      ) {
        if (player.role instanceof Wolffluence && fluencePlayerId) {
          acc[player.role.voteHanged] = (acc[player.role.voteHanged] || 0) + 2;
        } else {
          if (player.userId === fluencePlayerId) {
            acc[player.role.voteHanged] = 0;
          } else {
            acc[player.role.voteHanged] = (acc[player.role.voteHanged] || 0) + 1;
          }
        }
      }
      return acc;
    },
    {},
  );

  const voteEntries = Object.entries(totalVotes);

  if (voteEntries.length === 0) {
    return null;
  }

  let maxVotes = 0;
  let candidates: string[] = [];

  for (const [userId, count] of voteEntries) {
    if (count > maxVotes) {
      maxVotes = count;
      candidates = [userId];
    } else if (count === maxVotes) {
      candidates.push(userId);
    }
  }

  if (candidates.length === 1 && maxVotes >= 2) {
    const hangedPlayer = players.find((p) => p.userId === candidates[0]);
    if (hangedPlayer && hangedPlayer.alive) {
      hangedPlayer.alive = false;
      return {
        hangedPlayer,
        maxVotes,
      };
    }
  }

  return null;
};
