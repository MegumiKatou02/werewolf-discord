class GameState {
  constructor() {
    this.nightCount = 0;
    this.phase = 'waiting'; // waiting, night, day, voting, ended
    this.log = [];
  }

  nextPhase() {
    const sequence = ['night', 'day', 'voting'];
    const index = sequence.indexOf(this.phase);
    if (index === -1 || index === sequence.length - 1) return;
    this.phase = sequence[index + 1];
  }

  resetToNight() {
    this.phase = 'night';
    this.nightCount++;
  }
}
module.exports = GameState;
