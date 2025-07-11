import Role from './role.js';

class VoodooWerewolf extends Role {
  voteBite: string | null;
  silentPlayer: string | null;
  voodooPlayer: string | null;
  biteCount: number;
  silentCount: number;
  voodooCount: number;

  constructor() {
    super('Sói Tà Thuật', 0);
    this.id = 20;
    this.voteBite = null; // id của người chơi bị cắn
    this.biteCount = 1;
    this.silentPlayer = null;
    this.voodooPlayer = null;
    this.silentCount = 2;
    this.voodooCount = 1;
  }
  resetDay() {
    this.voteBite = null;
    this.biteCount = 1;
    this.silentPlayer = null;
    this.voodooPlayer = null;
  }
}

export default VoodooWerewolf;
