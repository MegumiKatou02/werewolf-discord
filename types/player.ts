import Role from './roles/role.js';

class Player {
  name: string;
  userId: string;
  alive: boolean;
  voted: boolean;
  role: Role;

  constructor(userId: string, name: string) {
    this.name = name;
    this.userId = userId;
    this.alive = true;
    this.voted = false;
    this.role = new Role('none', -1);
  }

  resetRound() {
    this.voted = false;
  }
}

export default Player;
