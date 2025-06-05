class Player {
    constructor(userId) {
        this.userId = userId;
        this.alive = true;
        this.voted = false;
    }

    resetRound() {
        this.voted = false;
    }
}

module.exports = Player;