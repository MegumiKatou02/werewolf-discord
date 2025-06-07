const Role = require('./role');

class Detective extends Role {
  constructor() {
    super('Phù Thuỷ', 1);
    this.id = 6;
    this.poisonCount = 1; // không reset
    this.healCount = 1; // không reset
    this.poisonedPerson = null;
    this.healedPerson = null;
    this.needHelpPerson = null;
  }

  getDescription() {
    return `Bạn có hai bình thuốc: Một bình dùng để giết và bình kia để bảo vệ người chơi. Bình bảo vệ chỉ được tiêu thụ nếu người chơi đó bị tấn công. Bạn không thể giết trong đêm đầu tiên.`;
  }
  resetDay() {
    this.poisonedPerson = null;
    this.healedPerson = null;
    this.needHelpPerson = null;
  }
}

module.exports = Detective;
