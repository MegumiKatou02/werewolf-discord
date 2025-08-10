import type { Client } from 'discord.js';

import { gameRooms } from '../../core/room.js';

import { stopSpamCleanup, clearSpamTracker } from './antiSpam.js';
import { stopUserCacheCleanup, clearUserCache } from './cache.js';

export default function attachGracefulShutdown(client: Client): void {
  const cleanupAndExit = async (code: number) => {
    console.log('🛑 Bot đang shutdown...');

    stopSpamCleanup();
    stopUserCacheCleanup();

    const cleanupPromises = Array.from(gameRooms.entries()).map(async ([guildId, gameRoom]) => {
      console.log(`Cleaning up game room ${guildId}`);
      try {
        const cleanupPromise = gameRoom.cleanup();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Cleanup timeout')), 5000),
        );
        await Promise.race([cleanupPromise, timeoutPromise]);
      } catch (err) {
        console.error(`Failed to cleanup game room ${guildId}:`, err);
      }
    });

    try {
      await Promise.race([
        Promise.allSettled(cleanupPromises),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Overall cleanup timeout')), 10000)),
      ]);
    } catch (err) {
      console.error('Cleanup timeout reached, forcing shutdown:', err);
    }

    gameRooms.clear();
    clearUserCache();
    clearSpamTracker();

    client.removeAllListeners();

    try {
      await Promise.race([
        client.destroy(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Client destroy timeout')), 3000)),
      ]);
    } catch (err) {
      console.error('Client destroy timeout:', err);
    }

    console.log('✅ Bot đã cleanup xong và thoát.');
    process.exit(code);
  };

  process.on('SIGINT', () => {
    cleanupAndExit(0);
  });

  process.on('SIGTERM', () => {
    cleanupAndExit(0);
  });

  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    const forceCleanup = async () => {
      try {
        stopSpamCleanup();
        stopUserCacheCleanup();

        const cleanupPromise = Promise.all(
          Array.from(gameRooms.values()).map(async (gameRoom) => {
            try {
              await Promise.race([
                gameRoom.cleanup(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Force cleanup timeout')), 2000)),
              ]);
            } catch (err) {
              console.error('Force cleanup error:', err);
            }
          }),
        );
        await Promise.race([
          cleanupPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Overall force cleanup timeout')), 5000)),
        ]);
        gameRooms.clear();
        clearUserCache();
        clearSpamTracker();
      } catch (err) {
        console.error('Force cleanup failed:', err);
      } finally {
        process.exit(1);
      }
    };
    const timeoutId = setTimeout(() => {
      console.error('Force cleanup timeout reached, exiting immediately');
      process.exit(1);
    }, 10000);
    forceCleanup().finally(() => {
      clearTimeout(timeoutId);
    });
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  });
}
