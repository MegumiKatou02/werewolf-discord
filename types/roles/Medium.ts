import Role from './role.js';

class Medium extends Role {
  revivedPerson: string | null;
  revivedCount: number;

  constructor() {
    super('Thầy Đồng', 1);
    this.id = 8;
    this.revivedPerson = null;
    this.revivedCount = 1;
  }

  getDescription() {
    return 'Vào buổi đêm bạn có thể trò chuyện ẩn danh với người chết. Bạn có khả năng chọn một dân làng đã chết trong đêm và hồi sinh họ khi đêm kết thúc một lần trong ván đấu.';
  }

  resetDay() {
    this.revivedPerson = null;
  }
}

export default Medium;
