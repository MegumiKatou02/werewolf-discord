import Role from './role.js';

class FoxSpirit extends Role {
  threeViewed: string[];
  viewCount: number;
  isHaveSkill: boolean;

  constructor() {
    super('Cáo', 1);
    this.id = 14;
    this.threeViewed = [];
    this.viewCount = 1;
    this.isHaveSkill = true;
  }

  getDescription() {
    return 'Mỗi đêm dậy soi 3 người tự chọn trong danh sách, nếu 1 trong 3 người đó là sói thì được báo \\"Có sói\\", nếu đoán hụt thì mất chức năng.';
  }
  resetDay() {
    this.threeViewed = [];
    this.viewCount = 1;
  }
}

export default FoxSpirit;
