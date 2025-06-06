const Role = require('./role');

class Seer extends Role {
  constructor() {
    super('Tiên Tri', 1);
    this.id = 4;
  }

  getDescription() {
    return `Mỗi đêm bạn có thể xem vai trò của người chơi khác.`;
  }
}

module.exports = Seer;
