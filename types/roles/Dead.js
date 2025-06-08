const Role = require('./role');

class Dead extends Role {
  constructor(faction, originalRoleId) {
    super('Người Chết', faction);
    this.id = 9;
    this.originalRoleId = originalRoleId;
  }

  getDescription() {
    return `Bạn đã chết rồi, đừng hỏi gì cả...`;
  }

  resetDay() {}
}

module.exports = Dead;
