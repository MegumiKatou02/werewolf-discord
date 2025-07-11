import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  Client,
  GatewayIntentBits,
  Collection,
  ChannelType,
  Partials,
  ActivityType,
  SlashCommandBuilder,
  type Interaction,
  User,
  Attachment,
  type InteractionReplyOptions,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type InteractionEditReplyOptions,
  type MessageContextMenuCommandInteraction,
  type UserContextMenuCommandInteraction,
} from 'discord.js';
import { MessageFlags } from 'discord.js';
import { config } from 'dotenv';

import connectDB from './config/database.js';
import { gameRooms } from './core/room.js';
import type { GameRoom } from './core/room.js';
import { store } from './core/store.js';
import rolesData from './data/data.json' with { type: 'json' };
import alphawerewolfInteraction from './src/client/events/interactions/alphawerewolfInteraction.js';
import bodyguardInteraction from './src/client/events/interactions/bodyguardInteraction.js';
import customizeRolesJson from './src/client/events/interactions/customizeRolesJson.js';
import customizeRolesName from './src/client/events/interactions/customizeRolesName.js';
import defaultRoles from './src/client/events/interactions/defaultRoles.js';
import detectiveInteraction from './src/client/events/interactions/detectiveInteraction.js';
import foxSpiritInteraction from './src/client/events/interactions/foxSpiritInteraction.js';
import gunnerInteraction from './src/client/events/interactions/gunnerInteraction.js';
import maidInteraction from './src/client/events/interactions/maidInteraction.js';
import mediumInteraction from './src/client/events/interactions/mediumInteraction.js';
import puppeteerInteraction from './src/client/events/interactions/puppeteerInteraction.js';
import seerInteraction from './src/client/events/interactions/seerInteraction.js';
import settingsModel from './src/client/events/interactions/settings.js';
import stalkerInteraction from './src/client/events/interactions/stalkerInteraction.js';
import voodooInteraction from './src/client/events/interactions/voodooInteraction.js';
import votingInteraction from './src/client/events/interactions/votingInteraction.js';
import witchInteraction from './src/client/events/interactions/witchInteraction.js';
import wolfInteraction from './src/client/events/interactions/wolfInteraction.js';
import wolfSeerInteraction from './src/client/events/interactions/wolfSeerInteraction.js';
import commandHandler from './src/client/handlers/commandHandler.js';
import { MAX_FILE_SIZE } from './src/constants/constants.js';
import type Player from './types/player.js';
import { RoleResponseDMs } from './utils/response.js';
import { WEREROLE, convertFactionRoles } from './utils/role.js';
config();

interface SlashCommand {
  data: SlashCommandBuilder;
  // eslint-disable-next-line no-unused-vars
  execute: (_interaction: Interaction) => Promise<void>;
}

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, SlashCommand>;
  }
}

connectDB();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.User,
  ],
});

client.commands = new Collection();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = await import(pathToFileURL(filePath).href);

  client.commands.set(command.default.data.name, command.default);
}

client.once('ready', () => {
  console.log('Bot online với tên', client.user?.tag);
  client.user?.setPresence({
    activities: [{ name: '/huongdan', type: ActivityType.Watching }],
    status: 'dnd',
  });
});

const userCache = new Map<string, { user: User; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 phút

let userCacheCleanupInterval: NodeJS.Timeout | null = null;

async function getCachedUser(userId: string) {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.user;
  }

  try {
    const user = await client.users.fetch(userId);
    userCache.set(userId, { user, timestamp: Date.now() });
    return user;
  } catch (error) {
    console.error(`Failed to fetch user ${userId}:`, error);
    return null;
  }
}

function isInteractionValid(interaction: Interaction): boolean {
  // 15 phút (900000ms)
  const INTERACTION_TIMEOUT = 15 * 60 * 1000;
  const createdTimestamp = interaction.createdTimestamp;
  const now = Date.now();

  return (now - createdTimestamp) < INTERACTION_TIMEOUT;
}

// Helper function để safely reply interaction
async function safeReply(
  interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction | MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction,
  options: InteractionReplyOptions,
): Promise<boolean> {
  try {
    if (!isInteractionValid(interaction)) {
      console.warn('Interaction đã hết hạn, bỏ qua reply');
      return false;
    }

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(options);
      return true;
    } else if (interaction.deferred) {
      const editOptions: InteractionEditReplyOptions = {
        content: options.content,
        embeds: options.embeds,
        components: options.components,
        files: options.files,
        allowedMentions: options.allowedMentions,
      };
      await interaction.editReply(editOptions);
      return true;
    } else {
      await interaction.followUp(options);
      return true;
    }
  } catch (error) {
    console.error('Lỗi khi reply interaction:', error);
    return false;
  }
}

// eslint-disable-next-line no-unused-vars
async function sendSyncMessages(players: Player[], messageContent: string, formatMessage: (player: Player, content: string) => string | { content: string; files?: Attachment[] } | null) {
  const MAX_RETRIES = 2;
  const MAX_CONCURRENT = 5;
  const results = new Map<string, boolean>();

  const getDelay = (index: number, playerCount: number): number => {
    if (playerCount <= 6) {
      return 0; // Không delay cho nhóm nhỏ
    }
    if (playerCount <= 12) {
      return index * 15; // 15ms
    }
    return index * 25; // 25ms
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const failedPlayers = attempt === 0 ? players :
      players.filter(p => !results.get(p.userId));

    if (failedPlayers.length === 0) {
      break;
    }

    for (let i = 0; i < failedPlayers.length; i += MAX_CONCURRENT) {
      const batch = failedPlayers.slice(i, i + MAX_CONCURRENT);
      const promises = batch.map(async (player: Player, batchIndex: number) => {
        try {
          // Smart micro-delay
          const delay = getDelay(i + batchIndex, players.length);
          if (delay > 0 && attempt === 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          const user = await getCachedUser(player.userId);
          if (!user) {
            results.set(player.userId, false);
            return;
          }
          const message = formatMessage(player, messageContent);

          if (message === null) {
            results.set(player.userId, true);
            return;
          }

          if (typeof message === 'string') {
            await user.send(message);
          } else {
            await user.send(message);
          }
          results.set(player.userId, true);
        } catch (err) {
          console.error(`Attempt ${attempt + 1} failed for ${player.userId}:`, err);
          results.set(player.userId, false);
        }
      });

      await Promise.allSettled(promises);
      if (i + MAX_CONCURRENT < failedPlayers.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (attempt < MAX_RETRIES) {
      const backoffDelay = Math.min(Math.pow(2, attempt) * 1000, 2000); // Max 2s
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
}

userCacheCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [userId, cached] of userCache.entries()) {
    if (now - cached.timestamp > CACHE_TTL) {
      userCache.delete(userId);
    }
  }
}, 5 * 60 * 1000); // Cleanup mỗi 5 phút

client.on('messageCreate', async (message) => {
  // Bất kể DM hay server đều dùng được
  commandHandler(message);

  if (message.channel.type === ChannelType.DM) {
    // console.log(`Tin nhắn DM từ ${message.author.tag}: ${message.content}`);

    const gameRoom = Array.from(gameRooms.values()).find(
      (room: GameRoom) =>
        room.status === 'starting' &&
        room.players.some((p: Player) => p.userId === message.author.id),
    );

    if (!gameRoom) {
      return;
    }

    const sender = gameRoom.players.find(
      (p: Player) => p.userId === message.author.id,
    );
    if (!sender) {
      return;
    }

    if (message.content === '!role' && sender.alive) {
      const roleId = sender.role?.id;

      if (roleId === null || roleId === undefined) {
        return;
      }

      const user = await getCachedUser(sender.userId);
      if (!user) {
        return;
      }

      const roleKey = roleId.toString() as keyof typeof rolesData;
      return await RoleResponseDMs(
        user,
        `${rolesData[roleKey].eName.toLowerCase().replace(/\s+/g, '_')}.png`,
        roleId,
        convertFactionRoles(rolesData[roleKey].faction),
      );
    }

    if (gameRoom.gameState.phase === 'night') {
      // Gửi tin nhắn cho các sói khác
      if (sender.role?.id === WEREROLE.WOLFSEER) {
        try {
          const user = await getCachedUser(sender.userId);
          if (user) {
            await user.send('_⚠️ Những sói khác sẽ không thấy bạn nhắn gì_');
          }
        } catch (err) {
          console.error('Không gửi được tin nhắn cho Sói khác', err);
        }
      }
      /**
       * Nếu là sói và không phải sói tiên tri thì có thể gửi tin nhắn cho các sói khác
       * (Sói còn sống mới gửi tin nhắn được)
       */
      if (
        sender.role?.faction === 0 &&
        sender.role?.id !== WEREROLE.WOLFSEER &&
        sender.alive
      ) {
        // lọc ra những sói khác (còn sống)
        const wolves = gameRoom.players.filter(
          (p: Player) =>
            p.role?.faction === 0 && p.alive && p.userId !== sender.userId,
        );

        // High sync với smart staggering
        await sendSyncMessages(wolves, `🐺 **${sender.name}**: ${message.content}`, () => `🐺 **${sender.name}**: ${message.content}`);
      }

      if (sender.role?.id === WEREROLE.MEDIUM || sender.alive === false) {
        // Gửi tin nhắn cho hội người âm
        const playersDead = gameRoom.players.filter((p: Player) => {
          return (
            p.userId !== sender.userId &&
            (p.alive === false || p.role?.id === WEREROLE.MEDIUM)
          );
        });

        await sendSyncMessages(playersDead, message.content, (player: Player, content: string) => {
          if (sender.role?.id === WEREROLE.MEDIUM && sender.alive) {
            return `_🔮 **Thầy Đồng**: ${content}_`;
          } else {
            return `_💀 **${sender.name}**: ${content}_`;
          }
        });
      }
    }
    if (
      gameRoom.gameState.phase === 'day' ||
      gameRoom.gameState.phase === 'voting'
    ) {
      // Gửi tin nhắn cho tất cả người chơi
      const playersInGame = gameRoom.players.filter(
        (p: Player) => p.userId !== sender.userId,
      );

      // Filter những người cần nhận tin nhắn
      const eligiblePlayers = playersInGame.filter((player: Player) => {
        if (!sender.alive) {
          return !player.alive; // Chỉ gửi cho người chết nếu sender đã chết
        }
        return true; // Gửi cho tất cả nếu sender còn sống
      });

      if (sender.alive && !sender.canChat) {
        const user = await gameRoom.fetchUser(sender.userId);
        if (user) {
          await user.send('⚠️ Bạn không thể chat trong hôm nay');
        }
        return;
      }

      if (eligiblePlayers.length > 0) {
        await sendSyncMessages(eligiblePlayers, message.content, (player: Player, content: string) => {
          const validAttachments = Array.from(
            message.attachments.values(),
          ).filter((attachment) => attachment.size <= MAX_FILE_SIZE);

          if (!sender.alive) {
            return `_💀 **${sender.name}**: ${content}_`;
          } else if (sender.userId === process.env.DEVELOPER) {
            return {
              content: `🔧 **${sender.name}**: ${content}`,
              files: validAttachments,
            };
          } else {
            return {
              content: `🗣️ **${sender.name}**: ${content}`,
              files: validAttachments,
            };
          }
        });
      }
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    try {
      const guildId = interaction.guild?.id || store.get(interaction.user.id);

      if (!guildId) {
        return interaction.reply({
          content: 'Không tìm thấy guild liên kết với người dùng này.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const gameRoom: GameRoom | undefined = gameRooms.get(guildId);

      /**
       * @description Button mà không bắt buộc phải tạo phòng trước
       */
      if (interaction.customId === 'edit_settings') {
        await settingsModel.handleButtonClick(interaction);
        return;
      }

      if (!gameRoom) {
        return interaction.reply({
          content: 'Không tìm thấy phòng chơi ma sói trong server này.',
          flags: MessageFlags.Ephemeral,
        });
      }

      /**
       * @description Button bắt buộc phải tạo phòng mới dùng được
       */
      if (interaction.customId === 'use_default_roles') {
        await defaultRoles.isButton(interaction, gameRooms);
      }
      if (interaction.customId === 'customize_roles_json') {
        await customizeRolesJson.isButton(interaction);
      }
      if (interaction.customId === 'customize_roles_name') {
        await customizeRolesName.isButton(interaction);
      }
      if (interaction.customId.startsWith('vote_target_wolf_')) {
        await wolfInteraction.isButton(interaction);
      }
      if (interaction.customId.startsWith('view_target_wolfseer_')) {
        await wolfSeerInteraction.isButton(interaction);
      }
      if (interaction.customId.startsWith('mask_target_alphawerewolf_')) {
        await alphawerewolfInteraction.isButton(interaction);
      }
      if (interaction.customId.startsWith('protect_target_bodyguard_')) {
        await bodyguardInteraction.isButton(interaction);
      }
      if (interaction.customId.startsWith('view_target_seer_')) {
        await seerInteraction.isButton(interaction);
      }
      if (interaction.customId.startsWith('investigate_target_detective_')) {
        await detectiveInteraction.isButton(interaction);
      }
      if (interaction.customId.startsWith('poison_target_witch_')) {
        await witchInteraction.isButtonPoison(interaction, gameRoom);
      }
      if (interaction.customId.startsWith('heal_target_witch_')) {
        await witchInteraction.isButtonHeal(interaction, gameRoom);
      }
      if (interaction.customId.startsWith('vote_hanged_')) {
        await votingInteraction.isButtonVoteHanged(interaction);
      }
      if (interaction.customId.startsWith('revive_target_medium_')) {
        await mediumInteraction.isButton(interaction);
      }
      if (interaction.customId.startsWith('choose_master_maid_')) {
        await maidInteraction.isButton(interaction);
      }
      if (interaction.customId.startsWith('view_target_foxspirit_')) {
        await foxSpiritInteraction.isButton(interaction, gameRoom);
      }
      if (interaction.customId.startsWith('stalk_target_stalker_')) {
        await stalkerInteraction.isButtonStalker(interaction, gameRoom);
      }
      if (interaction.customId.startsWith('kill_target_stalker_')) {
        await stalkerInteraction.isButtonKill(interaction, gameRoom);
      }
      if (interaction.customId.startsWith('gunner_shoot_')) {
        await gunnerInteraction.isButtonGunner(interaction);
      }
      if (interaction.customId.startsWith('puppet_target_puppeteer_')) {
        await puppeteerInteraction.isButton(interaction);
      }
      if (interaction.customId.startsWith('voodoo_silent_')) {
        await voodooInteraction.isButtonSilent(interaction);
      }
      if (interaction.customId.startsWith('voodoo_voodoo_')) {
        await voodooInteraction.isButtonVoodoo(interaction);
      }
    } catch (error) {
      console.error('Lỗi xử lý button interaction:', error);
      console.error('Button customId:', interaction.customId);
      console.error('User:', interaction.user?.tag);
      console.error('Guild:', interaction.guild?.name);

      await safeReply(interaction, {
        content: 'Có lỗi xảy ra khi xử lý button!',
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  if (interaction.isModalSubmit()) {
    try {
      const guildId = interaction.guild?.id || store.get(interaction.user.id);

      if (!guildId) {
        return interaction.reply({
          content: 'Không tìm thấy guild liên kết với người dùng này.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const gameRoom: GameRoom | undefined = gameRooms.get(guildId);

      /**
       * @description Button mà không bắt buộc phải tạo phòng trước
       */
      if (interaction.customId === 'settings_modal') {
        await settingsModel.isModalSubmit(interaction);
        return;
      }

      if (!gameRoom) {
        return interaction.reply({
          content: 'Không tìm thấy phòng chơi ma sói trong server này.',
          flags: MessageFlags.Ephemeral,
        });
      }

      let sender: Player | null | undefined = null;
      if (gameRoom) {
        sender = gameRoom.players.find(
          (p: Player) => p.userId === interaction.user.id,
        ); // player
        if (!sender) {
          return;
        }
      }

      /**
       * @description Button bắt buộc phải tạo phòng mới dùng được
       */
      if (interaction.customId.startsWith('submit_vote_wolf_')) {
        if (!sender) {
          return;
        }
        await wolfInteraction.isModalSubmit(
          interaction,
          gameRoom,
          sender,
        );
      }
      if (interaction.customId.startsWith('submit_view_wolfseer_')) {
        if (!sender) {
          return;
        }
        await wolfSeerInteraction.isModalSubmit(
          interaction,
          gameRoom,
          sender,
        );
      }
      if (interaction.customId.startsWith('submit_mask_alphawerewolf_')) {
        if (!sender) {
          return;
        }
        await alphawerewolfInteraction.isModalSubmit(
          interaction,
          gameRoom,
          sender,
        );
      }
      if (interaction.customId.startsWith('submit_protect_bodyguard_')) {
        if (!sender) {
          return;
        }
        await bodyguardInteraction.isModalSubmit(
          interaction,
          gameRoom,
          sender,
        );
      }

      if (interaction.customId.startsWith('submit_view_seer_')) {
        if (!sender) {
          return;
        }
        await seerInteraction.isModalSubmit(
          interaction,
          gameRoom,
          sender,
        );
      }
      if (interaction.customId.startsWith('submit_investigate_detective_')) {
        if (!sender) {
          return;
        }
        await detectiveInteraction.isModalSubmit(
          interaction,
          gameRoom,
          sender,
        );
      }
      if (interaction.customId.startsWith('submit_poison_witch_')) {
        if (!sender) {
          return;
        }
        await witchInteraction.isModalSubmitPoison(
          interaction,
          gameRoom,
          sender,
        );
      }
      if (interaction.customId.startsWith('submit_heal_witch_')) {
        if (!sender) {
          return;
        }
        await witchInteraction.isModalSubmitHeal(
          interaction,
          gameRoom,
          sender,
        );
      }
      if (interaction.customId.startsWith('submit_vote_hanged_')) {
        if (!sender) {
          return;
        }
        await votingInteraction.isModalSubmitVoteHanged(
          interaction,
          gameRoom,
          sender,
        );
      }
      if (interaction.customId.startsWith('submit_revive_medium_')) {
        if (!sender) {
          return;
        }
        await mediumInteraction.isModalSubmit(
          interaction,
          gameRoom,
          sender,
        );
      }
      if (interaction.customId.startsWith('submit_choose_master_maid_')) {
        if (!sender) {
          return;
        }
        await maidInteraction.isModalSubmit(
          interaction,
          gameRoom,
          sender,
        );
      }
      if (interaction.customId === 'customize_roles_json_modal') {
        await customizeRolesJson.isModalSubmit(interaction, gameRooms);
      }
      if (interaction.customId === 'customize_roles_name_modal') {
        await customizeRolesName.isModalSubmit(interaction, gameRooms);
      }
      if (interaction.customId.startsWith('submit_view_foxspirit_')) {
        if (!sender) {
          return;
        }
        await foxSpiritInteraction.isModalSubmit(
          interaction,
          gameRoom,
          sender,
        );
      }
      if (interaction.customId.startsWith('submit_stalk_stalker_')) {
        if (!sender) {
          return;
        }
        await stalkerInteraction.isModalSubmitStalker(
          interaction,
          gameRoom,
          sender,
        );
      }
      if (interaction.customId.startsWith('submit_kill_stalker_')) {
        if (!sender) {
          return;
        }
        await stalkerInteraction.isModalSubmitKill(
          interaction,
          gameRoom,
          sender,
        );
      }
      if (interaction.customId.startsWith('submit_gunner_shoot_')) {
        if (!sender) {
          return;
        }
        await gunnerInteraction.isModalSubmitGunner(
          interaction,
          gameRoom,
          sender,
        );
      }
      if (interaction.customId.startsWith('submit_puppeteer_')) {
        if (!sender) {
          return;
        }
        await puppeteerInteraction.isModalSubmit(interaction, gameRoom, sender);
      }
      if (interaction.customId.startsWith('submit_voodoo_silent_')) {
        if (!sender) {
          return;
        }
        await voodooInteraction.isModalSubmitSilent(interaction, gameRoom, sender);
      }
      if (interaction.customId.startsWith('submit_voodoo_voodoo_')) {
        if (!sender) {
          return;
        }
        await voodooInteraction.isModalSubmitVoodoo(interaction, gameRoom, sender);
      }
    } catch (error) {
      console.error('Lỗi xử lý modal interaction:', error);
      console.error('Modal customId:', interaction.customId);
      console.error('User:', interaction.user?.tag);
      console.error('Guild:', interaction.guild?.name);

      await safeReply(interaction, {
        content: 'Có lỗi xảy ra khi xử lý modal!',
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  if (!interaction.isCommand()) {
    return;
  }

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    return await interaction.reply({
      content: 'Lệnh không tồn tại!',
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Lỗi thực thi command:', error);
    console.error('Command name:', interaction.commandName);
    console.error('User:', interaction.user?.tag);
    console.error('Guild:', interaction.guild?.name);

    await safeReply(interaction, {
      content: 'Có lỗi xảy ra khi thực thi lệnh!',
      flags: MessageFlags.Ephemeral,
    });
  }
});

client.login(process.env.TOKEN);

process.on('SIGINT', async () => {
  console.log('🛑 Bot đang shutdown...');


  if (userCacheCleanupInterval) {
    clearInterval(userCacheCleanupInterval);
    userCacheCleanupInterval = null;
  }

  const cleanupPromises = Array.from(gameRooms.entries()).map(async ([guildId, gameRoom]) => {
    console.log(`Cleaning up game room ${guildId}`);
    try {
      const cleanupPromise = gameRoom.cleanup();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Cleanup timeout')), 5000),
      );
      await Promise.race([cleanupPromise, timeoutPromise]);
    } catch (err) {
      console.error(`Failed to cleanup game room ${guildId}:`, err);
    }
  });

  try {
    await Promise.race([
      Promise.allSettled(cleanupPromises),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Overall cleanup timeout')), 10000)),
    ]);
  } catch (err) {
    console.error('Cleanup timeout reached, forcing shutdown:', err);
  }
  gameRooms.clear();

  // Clear user cache
  userCache.clear();

  // Remove event listeners
  client.removeAllListeners();

  // Destroy client connection with timeout
  try {
    await Promise.race([
      client.destroy(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Client destroy timeout')), 3000)),
    ]);
  } catch (err) {
    console.error('Client destroy timeout:', err);
  }

  console.log('✅ Bot đã cleanup xong và thoát.');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Bot nhận SIGTERM, đang shutdown...');


  if (userCacheCleanupInterval) {
    clearInterval(userCacheCleanupInterval);
    userCacheCleanupInterval = null;
  }

  const cleanupPromises = Array.from(gameRooms.entries()).map(async ([guildId, gameRoom]) => {
    console.log(`Cleaning up game room ${guildId}`);
    try {
      const cleanupPromise = gameRoom.cleanup();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Cleanup timeout')), 5000),
      );
      await Promise.race([cleanupPromise, timeoutPromise]);
    } catch (err) {
      console.error(`Failed to cleanup game room ${guildId}:`, err);
    }
  });

  try {
    await Promise.race([
      Promise.allSettled(cleanupPromises),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Overall cleanup timeout')), 10000)),
    ]);
  } catch (err) {
    console.error('Cleanup timeout reached, forcing shutdown:', err);
  }

  gameRooms.clear();
  userCache.clear();
  client.removeAllListeners();

  try {
    await Promise.race([
      client.destroy(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Client destroy timeout')), 3000)),
    ]);
  } catch (err) {
    console.error('Client destroy timeout:', err);
  }

  console.log('✅ Bot đã cleanup xong và thoát.');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  const forceCleanup = async () => {
    try {
      if (userCacheCleanupInterval) {
        clearInterval(userCacheCleanupInterval);
        userCacheCleanupInterval = null;
      }
      const cleanupPromise = Promise.all(
        Array.from(gameRooms.values()).map(async (gameRoom) => {
          try {
            await Promise.race([
              gameRoom.cleanup(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Force cleanup timeout')), 2000)),
            ]);
          } catch (err) {
            console.error('Force cleanup error:', err);
          }
        }),
      );
      await Promise.race([
        cleanupPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Overall force cleanup timeout')), 5000)),
      ]);
      gameRooms.clear();
      userCache.clear();
    } catch (err) {
      console.error('Force cleanup failed:', err);
    } finally {
      process.exit(1);
    }
  };
  const timeoutId = setTimeout(() => {
    console.error('Force cleanup timeout reached, exiting immediately');
    process.exit(1);
  }, 10000);
  forceCleanup().finally(() => {
    clearTimeout(timeoutId);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
