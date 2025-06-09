const defaultSettings = {
  wolfVoteTime: 40,
  nightTime: 70,
  discussTime: 90,
  voteTime: 30,
};

module.exports = {
  store: new Map(),
  serverSettings: new Map(),

  getSettings(guildId) {
    return this.serverSettings.get(guildId) || defaultSettings;
  },
};
