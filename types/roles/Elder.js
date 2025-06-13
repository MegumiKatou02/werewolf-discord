const Role = require('./role');

class Elder extends Role {
  constructor() {
    super('Già Làng', 1);
    this.id = 15;
    this.hp = 2;
    this.isDead = false;
  }

  getDescription() {
    return `Sói phải cắn 2 lần thì Già làng mới chết. Già Làng chỉ chết ngay lập tức nếu bị cả làng treo cổ, Phù Thủy bỏ độc... Khi Già làng chết thì tất cả những người phe dân làng đều mất khả năng đặc biệt cho đến hết ván.`;
  }
  resetDay() {}
}

module.exports = Elder;
