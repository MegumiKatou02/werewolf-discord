class Role {
  id: number;
  name: string;
  faction: number;
  voteHanged: string | null;

  constructor(name: string, faction: number) {
    this.id = -1;
    this.name = name;
    this.faction = faction; // 0: sói, 1: dân, 2: solo, 3: dân làng hoặc ma sói
    this.voteHanged = null;
  }

  getDescription() {
    return '';
  }
  resetDay() {
    this.voteHanged = null;
  }
}

export default Role;
