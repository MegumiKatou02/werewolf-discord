import { getCachedUser } from './cache.js';

interface UserMessageRecord {
  messageCount: number;
  lastMessageTime: number;
  warningCount: number;
  isMuted: boolean;
  muteEndTime: number;
}

const userMessageTracker = new Map<string, UserMessageRecord>();
let spamCleanupInterval: NodeJS.Timeout | null = null;

const RATE_LIMIT_CONFIG = {
  MAX_MESSAGES_PER_WINDOW: 5,
  TIME_WINDOW: 5 * 1000,
  WARNING_THRESHOLD: 3,
  MUTE_DURATION: 30 * 1000,
  MAX_MUTE_DURATION: 5 * 60 * 1000,
};

export function isUserSpamming(userId: string): { isSpam: boolean; shouldWarn: boolean; shouldMute: boolean } {
  const now = Date.now();
  const record = userMessageTracker.get(userId) || {
    messageCount: 0,
    lastMessageTime: now,
    warningCount: 0,
    isMuted: false,
    muteEndTime: 0,
  };

  if (record.isMuted && now < record.muteEndTime) {
    return { isSpam: true, shouldWarn: false, shouldMute: false };
  }

  if (record.isMuted && now >= record.muteEndTime) {
    record.isMuted = false;
    record.muteEndTime = 0;
  }

  if (now - record.lastMessageTime > RATE_LIMIT_CONFIG.TIME_WINDOW) {
    record.messageCount = 1;
    record.lastMessageTime = now;
    userMessageTracker.set(userId, record);
    return { isSpam: false, shouldWarn: false, shouldMute: false };
  }

  record.messageCount++;
  record.lastMessageTime = now;

  if (record.messageCount > RATE_LIMIT_CONFIG.MAX_MESSAGES_PER_WINDOW) {
    record.warningCount++;
    const shouldMute = record.warningCount >= RATE_LIMIT_CONFIG.WARNING_THRESHOLD;

    if (shouldMute) {
      record.isMuted = true;
      const muteDuration = Math.min(
        RATE_LIMIT_CONFIG.MUTE_DURATION * Math.pow(2, record.warningCount - RATE_LIMIT_CONFIG.WARNING_THRESHOLD),
        RATE_LIMIT_CONFIG.MAX_MUTE_DURATION,
      );
      record.muteEndTime = now + muteDuration;
      record.messageCount = 0;
    }

    userMessageTracker.set(userId, record);
    return { isSpam: true, shouldWarn: !shouldMute, shouldMute };
  }

  userMessageTracker.set(userId, record);
  return { isSpam: false, shouldWarn: false, shouldMute: false };
}

export async function handleSpamAction(userId: string, action: { isSpam: boolean; shouldWarn: boolean; shouldMute: boolean }): Promise<boolean> {
  if (!action.isSpam) {
    return false;
  }

  try {
    const user = await getCachedUser(userId);
    if (!user) {
      return true;
    }

    const record = userMessageTracker.get(userId);
    if (!record) {
      return true;
    }

    if (action.shouldMute) {
      const muteMinutes = Math.round((record.muteEndTime - Date.now()) / (60 * 1000));
      await user.send(`🔇 **BẠN ĐÃ BỊ TẠM KHÓA CHAT** do spam tin nhắn!\n⏰ Thời gian: ${muteMinutes} phút\n⚠️ Tiếp tục spam sẽ bị khóa lâu hơn.`);
    } else if (action.shouldWarn) {
      await user.send(`⚠️ **CẢNH BÁO**: Bạn đang gửi tin nhắn quá nhanh!\n📝 Tối đa ${RATE_LIMIT_CONFIG.MAX_MESSAGES_PER_WINDOW} tin nhắn trong ${RATE_LIMIT_CONFIG.TIME_WINDOW/1000} giây.\n🔇 Tiếp tục spam sẽ bị tạm khóa chat (Chờ ${RATE_LIMIT_CONFIG.TIME_WINDOW/1000} giây để nhắn tiếp).`);
    }

    return true;
  } catch (error) {
    console.error(`Lỗi xử lý spam cho user ${userId}:`, error);
    return true;
  }
}

async function cleanupSpamTracker(): Promise<void> {
  const now = Date.now();
  const threshold = 24 * 60 * 60 * 1000;

  if (userMessageTracker.size === 0) {
    return;
  }

  let cleanedCount = 0;
  const startTime = now;

  try {
    const entries = Array.from(userMessageTracker.entries());

    for (let i = 0; i < entries.length; i += 100) {
      const batch = entries.slice(i, i + 100);

      for (const [userId, record] of batch) {
        if (now - record.lastMessageTime > threshold && !record.isMuted) {
          userMessageTracker.delete(userId);
          cleanedCount++;
        }
      }

      if (i + 100 < entries.length) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Spam cleanup: Removed ${cleanedCount} old records in ${Date.now() - startTime}ms (${userMessageTracker.size} remaining)`);
    }

    if (userMessageTracker.size > 1000) {
      console.warn(`⚠️ Spam tracker has ${userMessageTracker.size} records. Consider lowering cleanup threshold.`);
    }
  } catch (error) {
    console.error('❌ Spam cleanup error:', error);
  }
}

export function startSpamCleanup(): void {
  if (spamCleanupInterval) {
    clearInterval(spamCleanupInterval);
    spamCleanupInterval = null;
  }
  spamCleanupInterval = setInterval(() => {
    cleanupSpamTracker().catch(error => {
      console.error('❌ Spam cleanup async error:', error);
    });
  }, 60 * 60 * 1000);
}

export function stopSpamCleanup(): void {
  if (spamCleanupInterval) {
    clearInterval(spamCleanupInterval);
    spamCleanupInterval = null;
  }
}

export function clearSpamTracker(): void {
  userMessageTracker.clear();
}
