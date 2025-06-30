import Role from './role.js';

class Dead extends Role {
  originalRoleId: number;

  constructor(faction: number, originalRoleId: number) {
    super('Người Chết', faction);
    this.id = 9;
    this.originalRoleId = originalRoleId;
  }

  getDescription() {
    return `Bạn đã chết rồi, đừng hỏi gì cả...`;
  }

  resetDay() {}
}

export default Dead;
