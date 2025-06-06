const EmbedBuilderWerewolf = require('./embed')
const roles = require('../data/data.json');

const RoleResponse = async (message, commandName, fileName, indexRole) => {
    if (message.content === commandName) {
        const { embed, file } = EmbedBuilderWerewolf(fileName, {
          title: roles[indexRole].title,
          description: roles[indexRole].description
        })
        
        await message.reply({ embeds: [embed], files: [file] });
    }
}

module.exports = { RoleResponse };