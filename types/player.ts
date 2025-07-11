import Role from './roles/role.js';

class Player {
  name: string;
  userId: string;
  alive: boolean;
  voted: boolean;
  role: Role;
  canUseSkill: boolean;
  canVote: boolean;
  canChat: boolean;

  constructor(userId: string, name: string) {
    this.name = name;
    this.userId = userId;
    this.alive = true;
    this.voted = false;
    this.role = new Role('none', -1);
    this.canUseSkill = true;
    this.canVote = true;
    this.canChat = true;
  }

  resetRound() {
    this.voted = false;
    this.canUseSkill = true;
  }

  resetDay() {
    this.canUseSkill = true;
  }

  resetRestrict() {
    this.canVote = true;
    this.canChat = true;
  }
}

export default Player;
