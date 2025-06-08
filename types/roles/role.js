class Role {
  constructor(name, faction) {
    this.id = -1;
    this.name = name;
    this.faction = faction; // 0: sói, 1: dân, 2: solo, 3: dân làng hoặc ma sói
    this.voteHanged = null;
  }

  getDescription() {}
  resetDay() {
    this.voteHanged = null;
  }
}

module.exports = Role;
