import Role from './role.js';

class Bodyguard extends Role {
  protectedPerson: string | null;
  protectedCount: number;
  hp: number;

  constructor() {
    super('Bảo Vệ', 1);
    this.id = 2;
    this.protectedPerson = null;
    this.protectedCount = 1;
    this.hp = 2; // không reset
  }

  getDescription() {
    return 'Bạn có thể chọn một người chơi để bảo vệ mỗi đêm. Người được bảo vệ không thể bị giết vào đêm đó, thay vào đó bạn sẽ bị tấn công thay họ. Vì bạn rất khỏe nên sẽ không thể bị chết trong lần tấn công đầu tiên nhưng sẽ chết trong lần tấn công thứ hai. Mỗi đêm bạn sẽ tự bảo vệ chính mình.';
  }
  resetDay() {
    this.protectedPerson = null;
    this.protectedCount = 1;
  }
}

export default Bodyguard;
