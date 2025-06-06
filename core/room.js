const Player = require('../types/player');
const { roleTable, assignRolesGame } = require("../utils/role")

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

    assignRoles(playerCount) {
        const roles = [];

        if (playerCount < 4) {
            throw new Error('Cần ít nhất 4 người chơi.');
        }

        const table = roleTable[playerCount];

        if (table) {
            for (const [role, count] of Object.entries(table)) {
                for (let i = 0; i < count; i++) {
                    roles.push(Number(role));
                }
            }
        } else {
            const werewolves = Math.floor(playerCount / 4);
            for (let i = 0; i < werewolves; i++) roles.push(0);
            roles.push(2);
            roles.push(6);
            roles.push(8);
            if (playerCount >= 7) roles.push(4); 
            if (playerCount >= 7) roles.push(5);  
            if (playerCount >= 8) roles.push(3);
            if (playerCount >= 10) roles.push(7);

            const remaining = playerCount - roles.length;
            for (let i = 0; i < remaining; i++) roles.push(1);
        }

        for (let i = roles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [roles[i], roles[j]] = [roles[j], roles[i]];
        }

        return roles;
    }

    async startGame(interaction) {
        if (this.status !== 'waiting') throw new Error('Game đã bắt đầu hoặc kết thúc.');
        const roles = this.assignRoles(this.players.length);

        for (let i = 0; i < this.players.length; i++) {
            const role = assignRolesGame(roles[i]);
            this.players[i].role = role;

            try {

                const user = await interaction.client.users.fetch(this.players[i].userId);
                const roleName = role.name;

                await user.send(`🎮 Bạn được phân vai: **${roleName}**. Hãy giữ bí mật! 🤫`);
            } catch (err) {
                console.error(`Không thể gửi tin nhắn cho ${this.players[i].userId}`, err);
            }
        }

        console.log('-----');
        console.log(this.players);

        this.status = 'starting';
    }

    endGame() {
        this.status = 'ended';
        this.players = [];
    }

} 

// gameRoom có key là guilId và value là class GameRoom
module.exports = {
    gameRooms: new Map(),
    GameRoom,
    Player
};