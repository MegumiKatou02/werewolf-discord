const Role = require('./role');

/**
 * @description Có 2 viên đạn
 */
class Gunner extends Role {
  constructor() {
    super('Xạ Thủ', 1);
    this.id = 17;
    this.bullets = 2;
  }

  resetDay() {}
}

module.exports = Gunner;
