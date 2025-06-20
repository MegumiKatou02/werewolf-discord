const Werewolf = require('../types/roles/WereWolf');
const Villager = require('../types/roles/Villager');
const Bodyguard = require('../types/roles/Bodyguard');
const Cursed = require('../types/roles/Cursed');
const Detective = require('../types/roles/Detective');
const Fool = require('../types/roles/Fool');
const Medium = require('../types/roles/Medium');
const Seer = require('../types/roles/Seer');
const Witch = require('../types/roles/Witch');
const Maid = require('../types/roles/Maid');
const Lycan = require('../types/roles/Lycan');
const WolfSeer = require('../types/roles/WolfSeer');
const AlphaWerewolf = require('../types/roles/AlphaWerewolf');
const FoxSpirit = require('../types/roles/FoxSpirit');
const Elder = require('../types/roles/Elder');
const Stalker = require('../types/roles/Stalker');
const Gunner = require('../types/roles/Gunner');
const KittenWolf = require('../types/roles/KittenWolf');
const { FactionRole } = require('../types/faction');

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

const assignRolesGame = (roleId) => {
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
    default:
      throw new Error(`Role id không hợp lệ`);
  }
};

const convertFactionRoles = (roleId) => {
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
});

const getRoleName = (roleId) => {
  return (
    Object.keys(WEREROLE).find((key) => WEREROLE[key] === roleId) || 'UNKNOWN'
  );
};

module.exports = {
  roleTable,
  assignRolesGame,
  convertFactionRoles,
  WEREROLE,
  getRoleName,
};
