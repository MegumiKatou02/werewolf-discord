import GameState from './gamestate.js';
import { gameRooms } from './room.js';
const guildId = '';
const gameRoom = gameRooms.get(guildId);

if (gameRoom) {
  gameRoom.on('night', (guildId: string, gameState: GameState) => {
    console.log(`🌙 Đêm ${gameState.nightCount} bắt đầu tại guild ${guildId}`);
  });

  gameRoom.on('day', () => {
    console.log('☀️ Ban ngày bắt đầu');
  });

  gameRoom.on('vote', () => {
    console.log('🗳️ Thời gian bỏ phiếu');
  });

  gameRoom.on('end', (guildId: string) => {
    console.log(`🎮 Game tại guild ${guildId} đã kết thúc`);
  });
}
