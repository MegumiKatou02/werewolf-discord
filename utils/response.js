const EmbedBuilderWerewolf = require('./embed');
const roles = require('../data/data.json');

/**
 * Tạo embed theo từng role
 *
 * @param {import('discord.js').Message} message - Tin nhắn nhận được từ người dùng
 * @param {string[]} commandNames - 1 mảng các commands vd: ['!danlang', '!villager']
 * @param {string} fileName - Tên file
 * @param {number} indexRole - Role id
 * @param {string} factionRole - 'Dân làng', 'Ma sói'
 * @returns {Promise<void>}
 */
const RoleResponse = async (
  message,
  commandNames,
  fileName,
  indexRole,
  factionRole
) => {
  const msg = message.content.toLowerCase();

  if (commandNames.map((cmd) => cmd.toLowerCase()).includes(msg)) {
    const { embed, file } = EmbedBuilderWerewolf(fileName, {
      title: `${roles[indexRole].title} (${roles[indexRole].eName})`,
      description: `${roles[indexRole].description}\n\nPhe: ${factionRole}`,
    });

    await message.reply({ embeds: [embed], files: [file] });
  }
};

/**
 * Tạo embed theo từng role và gửi qua DM
 *
 * @param {import('discord.js').User} user - user discord
 * @param {string} fileName - Tên file
 * @param {number} indexRole - Role id
 * @param {string} factionRole - 'Dân làng', 'Ma sói'
 *
 * @returns {Promise<void>}
 */
const RoleResponseDMs = async (user, fileName, indexRole, factionRole) => {
  const { embed, file } = EmbedBuilderWerewolf(fileName, {
    title: `${roles[indexRole].title} (${roles[indexRole].eName})`,
    description: `${roles[indexRole].description}\n\nPhe: ${factionRole}`,
  });

  await user.send({ embeds: [embed], files: [file] });
};

module.exports = { RoleResponse, RoleResponseDMs };
