const Role = require('./role');

/**
 * @description chết -> thay vote -> chuyển dạng
 */
class KittenWolf extends Role {
  constructor() {
    super('Sói Mèo Con', 0);
    this.id = 18;
  }

  resetDay() {}
}

module.exports = KittenWolf;
