import Role from './role.js';

class Detective extends Role {
  investigatedCount: number;
  investigatedPairs: string[];

  constructor() {
    super('Thám Tử', 1);
    this.id = 5;
    this.investigatedCount = 1;
    this.investigatedPairs = [];
  }

  getDescription() {
    return `Mỗi đêm, bạn có thể chọn hai người chơi để điều tra và biết được họ ở cùng một phe hay là khác phe.`;
  }

  resetDay() {
    this.investigatedCount = 1;
    this.investigatedPairs = [];
  }
}

export default Detective;
