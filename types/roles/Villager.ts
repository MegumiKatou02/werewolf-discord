import Role from './role.js';

class Villager extends Role {
  constructor() {
    super('Dân Làng', 1);
    this.id = 1;
  }

  getDescription() {
    return 'Bạn là một dân làng bình thường và không có khả năng gì đặc biệt.';
  }
  resetDay() {}
}

export default Villager;
