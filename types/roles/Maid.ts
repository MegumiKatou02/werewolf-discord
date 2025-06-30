import Role from './role.js';

class Maid extends Role {
  master: string | null;

  constructor() {
    super('Hầu Gái', 1);
    this.id = 10;
    this.master = null;
  }

  resetDay() {}
}

export default Maid;
