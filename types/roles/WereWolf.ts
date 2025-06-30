import Role from './role.js';

class Werewolf extends Role {
  voteBite: string | null;
  biteCount: number;

  constructor() {
    super('Ma Sói', 0);
    this.id = 0;
    this.voteBite = null; // id của người chơi bị cắn
    this.biteCount = 1;
  }

  getDescription() {
    return 'Mỗi đêm bạn có thể bỏ phiếu cùng đàn sói để chọn giết một người chơi.';
  }
  resetDay() {
    this.biteCount = 1;
    this.voteBite = null;
  }
}

export default Werewolf;
