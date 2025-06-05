const Role = require('./role')

class Bodyguard extends Role {
    constructor() {
        super("Bảo Vệ", 1);
        this.id = 2;
    }

    getDescription() {
        return `Bạn có thể chọn một người chơi để bảo vệ mỗi đêm. Người được bảo vệ không thể bị giết vào đêm đó, thay vào đó bạn sẽ bị tấn công thay họ. Vì bạn rất khỏe nên sẽ không thể bị chết trong lần tấn công đầu tiên nhưng sẽ chết trong lần tấn công thứ hai. Mỗi đêm bạn sẽ tự bảo vệ chính mình.`;
    }
}

module.exports = Bodyguard;