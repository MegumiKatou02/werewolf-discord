class Player {
  constructor(userId, name) {
    this.name = name;
    this.userId = userId;
    this.alive = true;
    this.voted = false;
    this.role = null;
  }

  resetRound() {
    this.voted = false;
  }
}

module.exports = Player;
