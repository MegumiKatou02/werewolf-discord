const Role = require('./role');

class Lycan extends Role {
  constructor() {
    super('Lycan', 1);
    this.id = 11;
    this.appearsAsWerewolf = true;
  }

  resetDay() {}
}

module.exports = Lycan;
