const Role = require('./role');

class Maid extends Role {
  constructor() {
    super('Hầu Gái', 1);
    this.id = 10;
    this.master = null;
  }

  resetDay() {}
}

module.exports = Maid;
