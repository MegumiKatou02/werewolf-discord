const Role = require('./role');

/**
 * @description: Stalker có 3 lần theo dõi và 2 lần ám sát
 */
class Stalker extends Role {
  constructor() {
    super('Stalker', 2);
    this.id = 16;
    this.stalkCount = 3;
    this.killCount = 2;
    this.stalkedPerson = null;
    this.killedPerson = null;
  }

  getDescription() {
    return 'Mỗi đêm bạn có thể theo dõi 1 người chơi và biết đêm đó họ có hành động hay không. Bạn còn có thể chọn người để ám sát, nếu ám sát trúng người không làm gì đêm đó thì người đó chết. Thắng khi là người duy nhất sống sót.';
  }
  resetDay() {
    this.stalkedPerson = null;
    this.killedPerson = null;
  }
}

module.exports = Stalker;
