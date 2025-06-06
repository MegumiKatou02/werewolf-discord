const { gameRooms } = require('./room');

const gameRoom = gameRooms.get(guildId);

if (gameRoom) {
  gameRoom.on('night', (guildId, players, gameState) => {
    console.log(`🌙 Đêm ${gameState.round} bắt đầu tại guild ${guildId}`);
  });

  gameRoom.on('day', (guildId, players, gameState) => {
    console.log(`☀️ Ban ngày bắt đầu`);
  });

  gameRoom.on('vote', (guildId, players, gameState) => {
    console.log(`🗳️ Thời gian bỏ phiếu`);
  });

  gameRoom.on('end', (guildId) => {
    console.log(`🎮 Game tại guild ${guildId} đã kết thúc`);
  });
}
