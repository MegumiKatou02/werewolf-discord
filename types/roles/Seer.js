const Role = require('./role');

class Seer extends Role {
  constructor() {
    super('Tiên Tri', 1);
    this.id = 4;
    this.viewCount = 1;
  }

  getDescription() {
    return `Mỗi đêm bạn có thể xem phe của người chơi khác.`;
  }
  resetDay() {
    this.viewCount = 1;
  }
}

module.exports = Seer;
