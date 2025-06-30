import Role from './role.js';

/**
 * @description Có 2 viên đạn
 */
class Gunner extends Role {
  bullets: number;

  constructor() {
    super('Xạ Thủ', 1);
    this.id = 17;
    this.bullets = 2;
  }

  resetDay() {}
}

export default Gunner;
