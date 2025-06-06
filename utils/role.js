const Werewolf = require('../types/roles/WereWolf')
const Villager = require('../types/roles/Villager')
const Bodyguard = require('../types/roles/Bodyguard')
const Cursed = require('../types/roles/Cursed')
const Detective = require('../types/roles/Detective')
const Fool = require('../types/roles/Fool')
const Medium = require('../types/roles/Medium')
const Seer = require('../types/roles/Seer')
const Witch = require('../types/roles/Witch')
const Role = require('../types/roles/role')

const { FactionRole } = require('../types/faction')

const roleTable = {
  4:  { 0: 1, 1: 2, 2: 1 },                                     // Ma sói, Dân, Bảo vệ
  5:  { 0: 1, 1: 2, 2: 1, 6: 1 },                               // + Phù thủy
  6:  { 0: 2, 1: 1, 2: 1, 6: 1, 8: 1 },                         // + Medium
  7:  { 0: 2, 1: 1, 2: 1, 6: 1, 8: 1, 5: 1 },                   // + Thám tử
  8:  { 0: 2, 1: 1, 2: 1, 6: 1, 8: 1, 5: 1, 3: 1 },             // + Bán sói
  9:  { 0: 2, 1: 2, 2: 1, 6: 1, 8: 1, 5: 1, 3: 1 },             //
 10:  { 0: 3, 1: 2, 2: 1, 6: 1, 5: 1, 3: 1, 4: 1 },             // + Seer
 11:  { 0: 3, 1: 2, 2: 1, 6: 1, 5: 1, 3: 1, 4: 1, 7: 1 },       // + Thằng ngố
 12:  { 0: 3, 1: 3, 2: 1, 6: 1, 5: 1, 3: 1, 4: 1, 7: 1 },       //
};

const assignRolesGame = (roleId) => {
  switch (roleId) {
    case 0: return new Werewolf();
    case 1: return new Villager();
    case 2: return new Bodyguard();
    case 3: return new Cursed();
    case 4: return new Seer();
    case 5: return new Detective();
    case 6: return new Witch();
    case 7: return new Fool();
    case 8: return new Medium();
    default: return new Role();
  }
}

const convertFactionRoles = (roleId) => {
  switch (roleId) {
    case 0: return FactionRole.Werewolf
    case 1: return FactionRole.Village
    case 2: return FactionRole.Solo
    case 3: return FactionRole['Vi-Wolf']
    default: return FactionRole.Village
  }
}

module.exports = { roleTable, assignRolesGame, convertFactionRoles }