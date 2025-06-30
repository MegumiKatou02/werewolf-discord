import Werewolf from '../types/roles/WereWolf.js';
import Villager from '../types/roles/Villager.js';
import Bodyguard from '../types/roles/Bodyguard.js';
import Cursed from '../types/roles/Cursed.js';
import Detective from '../types/roles/Detective.js';
import Fool from '../types/roles/Fool.js';
import Medium from '../types/roles/Medium.js';
import Seer from '../types/roles/Seer.js';
import Witch from '../types/roles/Witch.js';
import Maid from '../types/roles/Maid.js';
import Lycan from '../types/roles/Lycan.js';
import WolfSeer from '../types/roles/WolfSeer.js';
import AlphaWerewolf from '../types/roles/AlphaWerewolf.js';
import FoxSpirit from '../types/roles/FoxSpirit.js';
import Elder from '../types/roles/Elder.js';
import Stalker from '../types/roles/Stalker.js';
import Gunner from '../types/roles/Gunner.js';
import KittenWolf from '../types/roles/KittenWolf.js';
import Puppeteer from '../types/roles/Puppeteer.js';
import { FactionRole } from '../types/faction.js';

const roleTable = {
  4: { 0: 1, 1: 2, 2: 1 }, // Ma sói, Dân, Bảo vệ
  5: { 0: 1, 1: 2, 2: 1, 6: 1 }, // + Phù thủy
  6: { 0: 2, 1: 1, 2: 1, 6: 1, 8: 1 }, // + Medium
  7: { 0: 2, 1: 1, 2: 1, 6: 1, 8: 1, 5: 1 }, // + Thám tử
  8: { 0: 2, 1: 1, 2: 1, 6: 1, 8: 1, 5: 1, 3: 1 }, // + Bán sói
  9: { 0: 2, 1: 2, 2: 1, 6: 1, 8: 1, 5: 1, 3: 1 }, //
  10: { 0: 3, 1: 2, 2: 1, 6: 1, 5: 1, 3: 1, 4: 1 }, // + Seer
  11: { 0: 3, 1: 2, 2: 1, 6: 1, 5: 1, 3: 1, 4: 1, 7: 1 }, // + Thằng ngố
  12: { 0: 3, 1: 3, 2: 1, 6: 1, 5: 1, 3: 1, 4: 1, 7: 1 }, //
};

const assignRolesGame = (roleId: number) => {
  switch (roleId) {
    case 0:
      return new Werewolf();
    case 1:
      return new Villager();
    case 2:
      return new Bodyguard();
    case 3:
      return new Cursed();
    case 4:
      return new Seer();
    case 5:
      return new Detective();
    case 6:
      return new Witch();
    case 7:
      return new Fool();
    case 8:
      return new Medium();
    case 10:
      return new Maid();
    case 11:
      return new Lycan();
    case 12:
      return new WolfSeer();
    case 13:
      return new AlphaWerewolf();
    case 14:
      return new FoxSpirit();
    case 15:
      return new Elder();
    case 16:
      return new Stalker();
    case 17:
      return new Gunner();
    case 18:
      return new KittenWolf();
    case 19:
      return new Puppeteer();
    default:
      throw new Error(`Role id không hợp lệ`);
  }
};

const convertFactionRoles = (roleId: number) => {
  switch (roleId) {
    case 0:
      return FactionRole.Werewolf;
    case 1:
      return FactionRole.Village;
    case 2:
      return FactionRole.Solo;
    case 3:
      return FactionRole['Vi-Wolf'];
    default:
      return FactionRole.Village;
  }
};

const WEREROLE = Object.freeze({
  WEREWOLF: 0,
  VILLAGER: 1,
  BODYGUARD: 2,
  CURSED: 3,
  SEER: 4,
  DETECTIVE: 5,
  WITCH: 6,
  FOOL: 7,
  MEDIUM: 8,
  DEAD: 9,
  MAID: 10,
  LYCAN: 11,
  WOLFSEER: 12,
  ALPHAWEREWOLF: 13,
  FOXSPIRIT: 14,
  ELDER: 15,
  STALKER: 16,
  GUNNER: 17,
  KITTENWOLF: 18,
  PUPPETEER: 19,
});

const getRoleName = (roleId: number): string => {
  return (
    Object.keys(WEREROLE).find(
      (key) => WEREROLE[key as keyof typeof WEREROLE] === roleId
    ) || 'UNKNOWN'
  );
};

export {
  roleTable,
  assignRolesGame,
  convertFactionRoles,
  WEREROLE,
  getRoleName,
};
