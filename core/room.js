const Player = require('../types/player');

class GameRoom {
    constructor(guildId, hostId) {
        this.guildId = guildId;
        this.hostId = hostId;
        this.players = [];
        this.status = 'waiting'; // waiting, starting, ended
    }

    addPlayer(userId) {
        if (!this.players.some(p => p.userId === userId)) {
            this.players.push(new Player(userId));
        }
    }

    removePlayer(userId) {
        this.players = this.players.filter(p => p.userId !== userId);
    }

    hasPlayer(userId) {
        return this.players.some(p => p.userId === userId);
    }

    isEmpty() {
        return this.players.length === 0;
    }
} 

// gameRoom có key là guilId và value là class GameRoom
module.exports = {
    gameRooms: new Map(),
    GameRoom,
    Player
};