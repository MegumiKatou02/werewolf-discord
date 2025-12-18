import { checkVictory, revealRoles } from '../../src/game/helper.js';
import type { GameRoom } from '../room.js';
import { gameRooms } from '../room.js';
import { store } from '../store.js';

export async function checkEndGame(room: GameRoom): Promise<boolean> {
  const victoryResult = checkVictory(room.players);
  if (victoryResult) {
    room.status = 'ended';
    let winMessage = '';
    switch (victoryResult.winner) {
    case 'werewolf':
      winMessage = '🐺 **Ma Sói thắng!** Họ đã tiêu diệt tất cả dân làng.';
      break;
    case 'village':
      winMessage = '👥 **Dân Làng thắng!** Họ đã tiêu diệt tất cả Ma Sói.';
      break;
    case 'solo':
      winMessage =
          '🎭 **Phe Solo thắng!** Họ đã hoàn thành mục tiêu của mình.';
      break;
    }

    const roleRevealEmbed = revealRoles(room.players);
    const endGameMessages = room.players.map(player => ({
      userId: player.userId,
      content: {
        content: winMessage,
        embeds: [roleRevealEmbed],
      },
    }));

    try {
      await Promise.race([
        room.batchSendMessages(endGameMessages).catch((error) => console.error('Loi roi', error)),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('End game messages timeout')), 10000),
        ),
      ]);
    } catch (error) {
      console.error(`GameRoom ${room.guildId}: Failed to send end game messages:`, error);
    }

    console.log(room.gameState.log);
    room.status = 'ended';
    for (const player of room.players) {
      store.delete(player.userId);
    }
    try {
      await Promise.race([
        room.cleanup(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Cleanup timeout')), 5000),
        ),
      ]);
    } catch (error) {
      console.error(`GameRoom ${room.guildId}: Cleanup timeout in checkEndGame:`, error);
    }

    gameRooms.delete(room.guildId);
    console.log(`✅ Room ${room.guildId} removed from gameRooms. Remaining rooms: ${gameRooms.size}`);

    return true;
  }

  return false;
}
