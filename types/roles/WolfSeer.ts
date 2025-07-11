import Role from './role.js';

class WolfSeer extends Role {
  voteBite: string | null;
  biteCount: number;
  seerCount: number;

  constructor() {
    super('Sói Tiên Tri', 0);
    this.id = 12;
    this.voteBite = null; // id của người chơi bị cắn
    this.biteCount = 1;
    this.seerCount = 1;
  }

  resetDay() {
    this.seerCount = 1;
    this.voteBite = null;
    this.biteCount = 1;
  }
}

export default WolfSeer;
