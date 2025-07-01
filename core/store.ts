const defaultSettings = {
  wolfVoteTime: 40,
  nightTime: 70,
  discussTime: 90,
  voteTime: 30,
};

// [id người dùng]: id server
export const store = new Map<string, string>();
export const serverSettings = new Map();

export const getSettings = (guildId: string) => {
  return serverSettings.get(guildId) || defaultSettings;
};
