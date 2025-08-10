import type { Client, User} from 'discord.js';

const userCache = new Map<string, { user: User; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;

let clientRef: Client | null = null;
let userCacheCleanupInterval: NodeJS.Timeout | null = null;

export function initializeCache(client: Client): void {
  clientRef = client;

  if (userCacheCleanupInterval) {
    clearInterval(userCacheCleanupInterval);
  }
  userCacheCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [userId, cached] of userCache.entries()) {
      if (now - cached.timestamp > CACHE_TTL) {
        userCache.delete(userId);
      }
    }
  }, 5 * 60 * 1000);
}

export function stopUserCacheCleanup(): void {
  if (userCacheCleanupInterval) {
    clearInterval(userCacheCleanupInterval);
    userCacheCleanupInterval = null;
  }
}

export function clearUserCache(): void {
  userCache.clear();
}

export async function getCachedUser(userId: string): Promise<User | null> {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.user;
  }

  try {
    if (!clientRef) {
      return null;
    }
    const user = await clientRef.users.fetch(userId);
    userCache.set(userId, { user, timestamp: Date.now() });
    return user;
  } catch (error) {
    console.error(`Failed to fetch user ${userId}:`, error);
    return null;
  }
}
