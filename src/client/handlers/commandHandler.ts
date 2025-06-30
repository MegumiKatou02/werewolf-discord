import type { Message } from 'discord.js';

import { FactionRole } from '../../../types/faction.js';
import { RoleResponse } from '../../../utils/response.js';

const commandHandler = async (message: Message) => {
  await RoleResponse(
    message,
    ['!soi', '!masoi', '!werewolf'],
    'werewolf.png',
    0,
    FactionRole.Werewolf,
  );
  await RoleResponse(
    message,
    ['!danlang', '!villager'],
    'villager.png',
    1,
    FactionRole.Village,
  );
  await RoleResponse(
    message,
    ['!baove', '!bodyguard'],
    'bodyguard.png',
    2,
    FactionRole.Village,
  );
  await RoleResponse(
    message,
    ['!bansoi', '!cursed'],
    'cursed.png',
    3,
    FactionRole['Vi-Wolf'],
  );
  await RoleResponse(
    message,
    ['!tientri', '!seer'],
    'seer.png',
    4,
    FactionRole.Village,
  );
  await RoleResponse(
    message,
    ['!thamtu', '!detective'],
    'detective.png',
    5,
    FactionRole.Village,
  );
  await RoleResponse(
    message,
    ['!phuthuy', '!witch'],
    'witch.png',
    6,
    FactionRole.Village,
  );
  await RoleResponse(
    message,
    ['!thangngo', '!fool'],
    'fool.png',
    7,
    FactionRole.Solo,
  );
  await RoleResponse(
    message,
    ['!thaydong', '!medium'],
    'medium.png',
    8,
    FactionRole.Village,
  );
  await RoleResponse(
    message,
    ['!haugai', '!maid'],
    'maid.png',
    10,
    FactionRole.Village,
  );
  await RoleResponse(message, ['!lycan'], 'lycan.png', 11, FactionRole.Village);
  await RoleResponse(
    message,
    ['!stalker', '!hori', '!stalkẻ'],
    'stalker.png',
    16,
    FactionRole.Solo,
  );
  await RoleResponse(
    message,
    ['!wolfseer', '!soitientri', '!soitri'],
    'wolf_seer.png',
    12,
    FactionRole.Werewolf,
  );
  await RoleResponse(
    message,
    ['!alphawerewolf', '!soitrum', '!soicosplay'],
    'alpha_werewolf.png',
    13,
    FactionRole.Werewolf,
  );
  await RoleResponse(
    message,
    ['!cao', '!foxspirit', '!holy', '!fox'],
    'fox_spirit.png',
    14,
    FactionRole.Village,
  );
  await RoleResponse(
    message,
    ['!gialang', '!elder'],
    'elder.png',
    15,
    FactionRole.Village,
  );
  await RoleResponse(
    message,
    ['!xathu', '!gunner'],
    'gunner.png',
    17,
    FactionRole.Village,
  );
  await RoleResponse(
    message,
    ['!soimeocon', '!kittenwolf'],
    'kitten_wolf.png',
    18,
    FactionRole.Werewolf,
  );
  await RoleResponse(
    message,
    ['!puppeteer', '!nguoimuaroi'],
    'the_puppeteer.png',
    19,
    FactionRole.Village,
  );
};

export default commandHandler;
