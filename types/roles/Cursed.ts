import Role from './role.js';

class Cursed extends Role {
  constructor() {
    super('Bán Sói', 3);
    this.id = 3;
  }

  getDescription() {
    return 'Bạn là dân làng bình thường cho tới khi bị ma sói cắn, lúc đó bạn sẽ trở thành Ma sói.';
  }
  resetDay() {}
}

export default Cursed;
