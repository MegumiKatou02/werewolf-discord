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
} from 'discord.js';
import { MessageFlags } from 'discord.js';
import { config } from 'dotenv';

import connectDB from './config/database.js';
import { gameRooms, Player } from './core/room.js';
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
import votingInteraction from './src/client/events/interactions/votingInteraction.js';
import witchInteraction from './src/client/events/interactions/witchInteraction.js';
import wolfInteraction from './src/client/events/interactions/wolfInteraction.js';
import wolfSeerInteraction from './src/client/events/interactions/wolfSeerInteraction.js';
import commandHandler from './src/client/handlers/commandHandler.js';
import { MAX_FILE_SIZE } from './src/constants/constants.js';
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
  .filter((file) => file.endsWith('.js'));

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

client.on('messageCreate', async (message) => {
  // Bất kể DM hay server đều dùng được
  commandHandler(message);

  if (message.channel.type === ChannelType.DM) {
    console.log(`Tin nhắn DM từ ${message.author.tag}: ${message.content}`);

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

      const user = await client.users.fetch(sender.userId);

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
          const user = await client.users.fetch(sender.userId);
          await user.send('_⚠️ Những sói khác sẽ không thấy bạn nhắn gì_');
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
        const notifyPromises = wolves.map(async (wolf: Player) => {
          try {
            const user = await client.users.fetch(wolf.userId);
            await user.send(`🐺 **${sender.name}**: ${message.content}`);
          } catch (err) {
            console.error('Không gửi được tin nhắn cho Sói khác', err);
          }
        });
        await Promise.allSettled(notifyPromises);
      }

      if (sender.role?.id === WEREROLE.MEDIUM || sender.alive === false) {
        // Gửi tin nhắn cho hội người âm
        const playersDead = gameRoom.players.filter((p: Player) => {
          return (
            p.userId !== sender.userId &&
            (p.alive === false || p.role?.id === WEREROLE.MEDIUM)
          );
        });

        const notifyPromises = playersDead.map(async (player: Player) => {
          try {
            const user = await client.users.fetch(player.userId);
            if (sender.role?.id === WEREROLE.MEDIUM && sender.alive) {
              await user.send(`_🔮 **Thầy Đồng**: ${message.content}_`);
            } else {
              await user.send(`_💀 **${sender.name}**: ${message.content}_`);
            }
          } catch (err) {
            console.error('Không gửi được tin nhắn cho người chơi', err);
          }
        });
        await Promise.allSettled(notifyPromises);
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

      const notifyPromises = playersInGame.map(async (player: Player) => {
        try {
          const user = await client.users.fetch(player.userId);
          if (!sender.alive) {
            if (!player.alive) {
              await user.send(`_💀 **${sender.name}**: ${message.content}_`);
            }
          } else {
            const validAttachments = Array.from(
              message.attachments.values(),
            ).filter((attachment) => attachment.size <= MAX_FILE_SIZE);
            if (sender.userId === process.env.DEVELOPER) {
              await user.send({
                content: `🔧 **${sender.name}**: ${message.content}`,
                files: validAttachments,
              });
            } else {
              await user.send({
                content: `🗣️ **${sender.name}**: ${message.content}`,
                files: validAttachments,
              });
            }
          }
        } catch (err) {
          console.error('Không gửi được tin nhắn cho người chơi', err);
        }
      });
      await Promise.allSettled(notifyPromises);
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    const guildId = interaction.guild?.id || store.get(interaction.user.id);

    if (!guildId) {
      return interaction.reply({
        content: 'Không tìm thấy guild liên kết với người dùng này.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const gameRoom = gameRooms.get(guildId);

    if (!gameRoom) {
      return interaction.reply({
        content: 'Không tìm thấy phòng chơi ma sói trong server này.',
        flags: MessageFlags.Ephemeral,
      });
    }

    //
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
  }

  if (interaction.isModalSubmit()) {
    const guildId = interaction.guild?.id || store.get(interaction.user.id);

    if (!guildId) {
      return interaction.reply({
        content: 'Không tìm thấy guild liên kết với người dùng này.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const gameRoom: GameRoom | undefined = gameRooms.get(guildId);

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

    if (interaction.customId.startsWith('submit_vote_wolf_')) {
      if (!sender) {
        return;
      }
      await wolfInteraction.isModalSubmit(
        interaction,
        gameRoom,
        sender,
        client,
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
        client,
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
        client,
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
        client,
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
        client,
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
        client,
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
        client,
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
        client,
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
        client,
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
        client,
      );
    }
    if (interaction.customId === 'settings_modal') {
      await settingsModel.isModalSubmit(interaction);
    }
    if (interaction.customId.startsWith('submit_choose_master_maid_')) {
      if (!sender) {
        return;
      }
      await maidInteraction.isModalSubmit(
        interaction,
        gameRoom,
        sender,
        client,
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
        client,
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
        client,
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
        client,
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
        client,
      );
    }
    if (interaction.customId.startsWith('submit_puppeteer_')) {
      if (!sender) {
        return;
      }
      await puppeteerInteraction.isModalSubmit(interaction, gameRoom, sender);
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
    console.error(error);
    await interaction.reply({
      content: 'Có lỗi xảy ra khi thực thi lệnh!',
      flags: MessageFlags.Ephemeral,
    });
  }
});

client.login(process.env.TOKEN);
