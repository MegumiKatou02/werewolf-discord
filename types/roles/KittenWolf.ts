import Role from './role.js';

/**
 * @description chết -> thay vote -> chuyển dạng
 */
class KittenWolf extends Role {
  voteBite: null | string;
  biteCount: number;

  constructor() {
    super('Sói Mèo Con', 0);
    this.id = 18;
    this.voteBite = null;
    this.biteCount = 1;
  }

  resetDay() {
    this.voteBite = null;
    this.biteCount = 1;
  }
}

export default KittenWolf;
