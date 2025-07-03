import Role from './role.js';

class Puppeteer extends Role {
  targetCount: number;
  targetWolf: string | null;

  constructor() {
    super('Người Múa Rối', 1);
    this.id = 19;
    this.targetCount = 1;
    this.targetWolf = null;
  }

  resetDay() {
    this.targetWolf = null;
  }
}

export default Puppeteer;
