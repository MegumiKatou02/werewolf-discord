const Role = require('./role');

class Werewolf extends Role {
  constructor() {
    super('Ma Sói', 0);
    this.id = 0;
  }

  getDescription() {
    return 'Mỗi đêm bạn có thể bỏ phiếu cùng đàn sói để chọn giết một người chơi.';
  }
}

module.exports = Werewolf;
