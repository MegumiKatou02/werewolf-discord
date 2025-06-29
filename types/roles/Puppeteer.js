const Role = require('./role');

class Puppeteer extends Role {
  constructor() {
    super('Người Múa Rối', 1);
    this.id = 19;
    this.targetWolf = null;
  }

  resetDay() {}
}

module.exports = Puppeteer;
