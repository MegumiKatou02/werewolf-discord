import Role from './role.js';

class Loudmouth extends Role {
  revealPlayer: string | null;

  constructor() {
    super('Cậu Bé Miệng Bự', 1);
    this.id = 22;
    this.revealPlayer = null;
  }

  resetDay() {}

  resetRestrict() {
    this.revealPlayer = null;
  }
}

export default Loudmouth;
