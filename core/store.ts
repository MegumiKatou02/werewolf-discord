const defaultSettings = {
  wolfVoteTime: 40,
  nightTime: 70,
  discussTime: 90,
  voteTime: 30,
};

export const store = new Map();
export const serverSettings = new Map();

export const getSettings = (guildId: string) => {
  return serverSettings.get(guildId) || defaultSettings;
};
