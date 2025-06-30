import Role from './role.js';

class Lycan extends Role {
  appearsAsWerewolf: boolean;

  constructor() {
    super('Lycan', 1);
    this.id = 11;
    this.appearsAsWerewolf = true;
  }

  resetDay() {}
}

export default Lycan;
