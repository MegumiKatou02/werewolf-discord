import Role from './role.js';

class Fool extends Role {
  constructor() {
    super('Thằng Ngố', 2);
    this.id = 7;
  }

  getDescription() {
    return 'Bạn phải lừa dân làng treo cổ bạn. Nếu họ treo cổ bạn, bạn thắng.';
  }
  resetDay() {}
}

export default Fool;
