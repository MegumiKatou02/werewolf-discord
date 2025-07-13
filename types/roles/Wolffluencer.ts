import Role from './role.js';

class Wolffluence extends Role {
  influencePlayer: string | null;
  voteBite: string | null;
  biteCount: number;

  constructor() {
    super('Sói Thao Túng', 0);
    this.id = 21;
    this.voteBite = null; // id của người chơi bị cắn
    this.biteCount = 1;
    this.influencePlayer = null;
  }

  resetDay() {
    this.biteCount = 1;
    this.voteBite = null;
  }

  resetRestrict() {
    this.influencePlayer = null;
  }
}

export default Wolffluence;
