type GamePhase = 'waiting' | 'night' | 'day' | 'voting' | 'ended';

class GameState {
  nightCount: number;
  phase: GamePhase;
  log: string[];
  private maxLogEntries: number = 100; // Giới hạn số log entries

  constructor() {
    this.nightCount = 0;
    this.phase = 'waiting'; // waiting, night, day, voting, ended
    this.log = [];
  }

  nextPhase() {
    const sequence: GamePhase[] = ['night', 'day', 'voting'];
    const index = sequence.indexOf(this.phase);
    if (index === -1 || index === sequence.length - 1) {
      return;
    }
    this.phase = sequence[index + 1];
  }

  resetToNight() {
    this.phase = 'night';
    this.nightCount++;
  }

  // Thêm entry vào log và giới hạn số lượng
  addLog(entry: string) {
    this.log.push(entry);
    // Giữ lại chỉ 100 entries gần nhất để tránh rò rỉ bộ nhớ
    if (this.log.length > this.maxLogEntries) {
      this.log = this.log.slice(-this.maxLogEntries);
    }
  }

  // Dọn dẹp log
  clearLog() {
    this.log = [];
  }

  // Reset game state hoàn toàn
  reset() {
    this.nightCount = 0;
    this.phase = 'waiting';
    this.clearLog();
  }
}

export default GameState;
