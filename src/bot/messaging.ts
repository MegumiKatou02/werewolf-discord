import type { Attachment } from 'discord.js';

import type Player from '../../types/player.js';

import { getCachedUser } from './cache.js';


export async function sendSyncMessages(
  players: Player[],
  messageContent: string,
  // eslint-disable-next-line no-unused-vars
  formatMessage: (player: Player, content: string) => string | { content: string; files?: Attachment[] } | null,
): Promise<void> {
  const MAX_RETRIES = 2;
  const MAX_CONCURRENT = 5;
  const results = new Map<string, boolean>();

  const getDelay = (index: number, playerCount: number): number => {
    if (playerCount <= 6) {
      return 0;
    }
    if (playerCount <= 12) {
      return index * 15;
    }
    return index * 25;
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const failedPlayers = attempt === 0 ? players : players.filter(p => !results.get(p.userId));

    if (failedPlayers.length === 0) {
      break;
    }

    for (let i = 0; i < failedPlayers.length; i += MAX_CONCURRENT) {
      const batch = failedPlayers.slice(i, i + MAX_CONCURRENT);
      const promises = batch.map(async (player: Player, batchIndex: number) => {
        try {
          const delay = getDelay(i + batchIndex, players.length);
          if (delay > 0 && attempt === 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          const user = await getCachedUser(player.userId);
          if (!user) {
            results.set(player.userId, false);
            return;
          }
          const message = formatMessage(player, messageContent);

          if (message === null) {
            results.set(player.userId, true);
            return;
          }

          if (typeof message === 'string') {
            await user.send(message);
          } else {
            await user.send(message);
          }
          results.set(player.userId, true);
        } catch (err) {
          console.error(`Attempt ${attempt + 1} failed for ${player.userId}:`, err);
          results.set(player.userId, false);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      });

      await Promise.allSettled(promises);
      if (i + MAX_CONCURRENT < failedPlayers.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (attempt < MAX_RETRIES) {
      const backoffDelay = Math.min(Math.pow(2, attempt) * 1000, 2000);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
}
