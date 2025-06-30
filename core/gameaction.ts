import { gameRooms } from './room.js';
import { Player } from './room.js';
import GameState from './gamestate.js';
const guildId = '';
const gameRoom = gameRooms.get(guildId);

if (gameRoom) {
  gameRoom.on(
    'night',
    (guildId: string, players: Player[], gameState: GameState) => {
      console.log(
        `🌙 Đêm ${gameState.nightCount} bắt đầu tại guild ${guildId}`
      );
    }
  );

  gameRoom.on(
    'day',
    (guildId: string, players: Player[], gameState: GameState) => {
      console.log(`☀️ Ban ngày bắt đầu`);
    }
  );

  gameRoom.on(
    'vote',
    (guildId: string, players: Player[], gameState: GameState) => {
      console.log(`🗳️ Thời gian bỏ phiếu`);
    }
  );

  gameRoom.on('end', (guildId: string) => {
    console.log(`🎮 Game tại guild ${guildId} đã kết thúc`);
  });
}
