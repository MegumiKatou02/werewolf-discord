import Role from './role.js';

class WolfSeer extends Role {
  voteBite: number | null;
  seerCount: number;

  constructor() {
    super('Ma Sói', 0);
    this.id = 12;
    this.voteBite = null; // id của người chơi bị cắn
    this.seerCount = 1;
  }

  resetDay() {
    this.seerCount = 1;
    this.voteBite = null;
  }
}

export default WolfSeer;
