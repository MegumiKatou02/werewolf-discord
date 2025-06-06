const EmbedBuilderWerewolf = require('./embed')
const roles = require('../data/data.json');

const RoleResponse = async (message, commandName, fileName, indexRole, factionRole) => {
    if (message.content === commandName) {
        const { embed, file } = EmbedBuilderWerewolf(fileName, {
          title: `${roles[indexRole].title} (${roles[indexRole].eName})`,
          description: `${roles[indexRole].description}\n\nPhe: ${factionRole}`
        })
        
        await message.reply({ embeds: [embed], files: [file] });
    }
}

module.exports = { RoleResponse };