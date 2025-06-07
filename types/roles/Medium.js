const Role = require('./role');

class Cursed extends Role {
  constructor() {
    super('Thầy Đồng', 1);
    this.id = 8;
    this.revivedPerson = null;
    this.revivedCount = 1;
  }

  getDescription() {
    return `Vào buổi đêm bạn có thể trò chuyện ẩn danh với người chết. Bạn có khả năng chọn một dân làng đã chết trong đêm và hồi sinh họ khi đêm kết thúc một lần trong ván đấu.`;
  }

  resetDay() {}
}

module.exports = Cursed;
