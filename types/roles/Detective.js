const Role = require('./role');

class Detective extends Role {
  constructor() {
    super('Thám Tử', 1);
    this.id = 5;
  }

  getDescription() {
    return `Mỗi đêm, bạn có thể chọn hai người chơi để điều tra và biết được họ ở cùng một phe hay là khác phe.`;
  }
}

module.exports = Detective;
