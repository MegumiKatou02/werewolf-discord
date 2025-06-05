const Role = require('./role')

class Werewolf extends Role {
    constructor() {
        super("Ma Sói", 0);
        this.id = 0;
    }

    getDescription() {
        return "Ma Sói là phe phản diện, chiến thắng khi số sói ≥ số dân.";
    }
}

module.exports = Werewolf;