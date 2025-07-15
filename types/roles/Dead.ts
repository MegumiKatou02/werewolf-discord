import Role from './role.js';

type Store = {
  loudmouthPlayer?: string | null,
}

class Dead extends Role {
  originalRoleId: number;
  private storeInformation: Store;

  constructor(faction: number, originalRoleId: number, deathNight: number, storeInformation: Store = {}) {
    super('Người Chết', faction);
    this.id = 9;
    this.originalRoleId = originalRoleId;
    this.deathNight = deathNight;
    this.storeInformation = storeInformation;
  }

  getDescription() {
    return 'Bạn đã chết rồi, đừng hỏi gì cả...';
  }

  getStoreInformation = (): Store => {
    return this.storeInformation;
  };

  resetDay() {}
}

export default Dead;
