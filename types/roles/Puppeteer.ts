import Role from './role.js';

class Puppeteer extends Role {
  targetWolf: string | null;

  constructor() {
    super('Người Múa Rối', 1);
    this.id = 19;
    this.targetWolf = null;
  }

  resetDay() {}
}

export default Puppeteer;
