import Role from './role.js';

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

export default KittenWolf;
