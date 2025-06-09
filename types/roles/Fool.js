const Role = require('./role');

class Fool extends Role {
  constructor() {
    super('Thằng Ngố', 3);
    this.id = 7;
  }

  getDescription() {
    return `Bạn phải lừa dân làng treo cổ bạn. Nếu họ treo cổ bạn, bạn thắng.`;
  }
  resetDay() {}
}

module.exports = Fool;
