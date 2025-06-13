const FactionRole = Object.freeze({
  Village: 'Dân Làng',
  Werewolf: 'Ma Sói',
  'Vi-Wolf': 'Dân Làng hoặc Ma Sói',
  Solo: 'Solo',
});

const Faction = Object.freeze({
  WEREWOLF: 0,
  VILLAGER: 1,
  SOLO: 2,
});

module.exports = { FactionRole, Faction };
