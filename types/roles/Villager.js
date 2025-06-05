const Role = require('./role')

class Villager extends Role {
    constructor() {
        super("Dân Làng", 1);
        this.id = 1;
    }

    getDescription() {
        return "Bạn thuộc phe dân làng, hãy cố gắng sống sót qua từng ngày";
    }
}

module.exports = Villager;