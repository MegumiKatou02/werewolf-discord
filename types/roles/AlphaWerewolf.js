const Role = require('./role');

class AlphaWerewolf extends Role {
  constructor() {
    super('Sói Trùm', 0);
    this.id = 13;
    this.voteBite = null; // id của người chơi bị cắn
    this.biteCount = 1;
    this.maskWolf = null; // id của người chơi bị che
  }

  getDescription() {
    return 'Che các sói khỏi tiên tri, mỗi đêm 1 người, được phép che liên tục một người.';
  }
  resetDay() {
    this.biteCount = 1;
    this.voteBite = null;
    this.maskWolf = null;
  }
}

module.exports = AlphaWerewolf;
