const Role = require('./role');

class Werewolf extends Role {
  constructor() {
    super('Ma Sói', 0);
    this.id = 0;
    this.voteBite = null; // id của người chơi bị cắn
    this.biteCount = 1;
  }

  getDescription() {
    return 'Mỗi đêm bạn có thể bỏ phiếu cùng đàn sói để chọn giết một người chơi.';
  }
  resetDay() {
    this.biteCount = 1;
    this.voteBite = null;
  }
}

module.exports = Werewolf;
