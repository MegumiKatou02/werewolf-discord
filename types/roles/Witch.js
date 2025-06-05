const Role = require('./role')

class Detective extends Role {
    constructor() {
        super("Phù Thuỷ", 1);
        this.id = 6;
    }

    getDescription() {
        return `Bạn có hai bình thuốc: Một bình dùng để giết và bình kia để bảo vệ người chơi. Bình bảo vệ chỉ được tiêu thụ nếu người chơi đó bị tấn công. Bạn không thể giết trong đêm đầu tiên.`;
    }
}

module.exports = Detective;