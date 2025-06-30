import type { Message, User } from 'discord.js';

import roles from '../data/data.json' with { type: 'json' };

import EmbedBuilderWerewolf from './embed.js';

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
  message: Message,
  commandNames: string[],
  fileName: string,
  indexRole: number,
  factionRole: string,
) => {
  const msg = message.content.toLowerCase();

  if (commandNames.map((cmd) => cmd.toLowerCase()).includes(msg)) {
    const roleKey = indexRole.toString() as keyof typeof roles;
    const { embed, file } = EmbedBuilderWerewolf(fileName, {
      title: `${roles[roleKey].title} (${roles[roleKey].eName})`,
      description: `${roles[roleKey].description}\n\nPhe: ${factionRole}`,
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
const RoleResponseDMs = async (
  user: User,
  fileName: string,
  indexRole: number,
  factionRole: string,
) => {
  const roleKey = indexRole.toString() as keyof typeof roles;
  const { embed, file } = EmbedBuilderWerewolf(fileName, {
    title: `${roles[roleKey].title} (${roles[roleKey].eName})`,
    description: `${roles[roleKey].description}\n\nPhe: ${factionRole}`,
  });

  await user.send({ embeds: [embed], files: [file] });
};

export { RoleResponse, RoleResponseDMs };
