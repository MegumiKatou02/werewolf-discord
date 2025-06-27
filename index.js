require('module-alias/register');
const {
  Client,
  GatewayIntentBits,
  Collection,
  ChannelType,
  Partials,
  ActivityType,
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { store } = require('./core/store');
const { gameRooms } = require('./core/room');
const { WEREROLE, convertFactionRoles } = require('./utils/role');
const connectDB = require('./config/database');
const commandHandler = require('./src/client/handlers/commandHandler');
const defaultRoles = require('@/interactions/defaultRoles');
const customizeRolesJson = require('@/interactions/customizeRolesJson');
const customizeRolesName = require('@/interactions/customizeRolesName');
const wolfInteraction = require('@/interactions/wolfInteraction');
const wolfSeerInteraction = require('@/interactions/wolfSeerInteraction');
const alphawerewolfInteraction = require('@/interactions/alphawerewolfInteraction');
const bodyguardInteraction = require('@/interactions/bodyguardInteraction');
const seerInteraction = require('@/interactions/seerInteraction');
const witchInteraction = require('@/interactions/witchInteraction');
const mediumInteraction = require('@/interactions/mediumInteraction');
const maidInteraction = require('@/interactions/maidInteraction');
const foxSpiritInteraction = require('@/interactions/foxSpiritInteraction');
const stalkerInteraction = require('@/interactions/stalkerInteraction');
const gunnerInteraction = require('@/interactions/gunnerInteraction');
const votingInteraction = require('@/interactions/votingInteraction');
const settingsModel = require('@/interactions/settings');
const detectiveInteraction = require('@/interactions/detectiveInteraction');
const { RoleResponseDMs } = require('./utils/response');
const rolesData = require('./data/data.json');
const { MAX_FILE_SIZE } = require('./src/constants/constants');
require('dotenv').config();

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

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

client.once('ready', () => {
  console.log('Bot online với tên', client.user.tag);
  client.user.setPresence({
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
      (room) =>
        room.status === 'starting' &&
        room.players.some((p) => p.userId === message.author.id)
    );

    if (!gameRoom) return;

    const sender = gameRoom.players.find((p) => p.userId === message.author.id);
    if (!sender) return;

    if (message.content === '!role' && sender.alive) {
      const roleId = sender.role?.id;

      if (roleId === null || roleId === undefined) return;

      const user = await client.users.fetch(sender.userId);

      await RoleResponseDMs(
        user,
        `${rolesData[roleId].eName.toLowerCase().replace(/\s+/g, '_')}.png`,
        roleId,
        convertFactionRoles(rolesData[roleId].faction)
      );
    }

    if (gameRoom.gameState.phase === 'night') {
      // Gửi tin nhắn cho các sói khác
      if (sender.role.id === WEREROLE.WOLFSEER) {
        try {
          const user = await client.users.fetch(sender.userId);
          await user.send(`_⚠️ Những sói khác sẽ không thấy bạn nhắn gì_`);
        } catch (err) {
          console.error('Không gửi được tin nhắn cho Sói khác', err);
        }
      }
      /**
       * Nếu là sói và không phải sói tiên tri thì có thể gửi tin nhắn cho các sói khác
       * (Sói còn sống mới gửi tin nhắn được)
       */
      if (
        sender.role.faction === 0 &&
        sender.role.id !== WEREROLE.WOLFSEER &&
        sender.alive
      ) {
        // lọc ra những sói khác (còn sống)
        const wolves = gameRoom.players.filter(
          (p) => p.role.faction === 0 && p.alive && p.userId !== sender.userId
        );
        const notifyPromises = wolves.map(async (wolf) => {
          try {
            const user = await client.users.fetch(wolf.userId);
            await user.send(`🐺 **${sender.name}**: ${message.content}`);
          } catch (err) {
            console.error('Không gửi được tin nhắn cho Sói khác', err);
          }
        });
        await Promise.allSettled(notifyPromises);
      }

      if (sender.role.id === WEREROLE.MEDIUM || sender.alive === false) {
        // Gửi tin nhắn cho hội người âm
        const playersDead = gameRoom.players.filter((p) => {
          return (
            p.userId !== sender.userId &&
            (p.alive === false || p.role.id === WEREROLE.MEDIUM)
          );
        });

        const notifyPromises = playersDead.map(async (player) => {
          try {
            const user = await client.users.fetch(player.userId);
            if (sender.role.id === WEREROLE.MEDIUM && sender.alive) {
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
        (p) => p.userId !== sender.userId
      );

      const notifyPromises = playersInGame.map(async (player) => {
        try {
          const user = await client.users.fetch(player.userId);
          if (!sender.alive) {
            if (!player.alive) {
              await user.send(`_💀 **${sender.name}**: ${message.content}_`);
            }
          } else {
            const validAttachments = Array.from(
              message.attachments.values()
            ).filter((attachment) => attachment.size <= MAX_FILE_SIZE);
            await user.send({
              content: `🗣️ **${sender.name}**: ${message.content}`,
              files: validAttachments,
            });
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
        ephemeral: true,
      });
    }

    const gameRoom = gameRooms.get(guildId);

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
  }

  if (interaction.isModalSubmit()) {
    const guildId = interaction.guild?.id || store.get(interaction.user.id);

    if (!guildId) {
      return interaction.reply({
        content: 'Không tìm thấy guild liên kết với người dùng này.',
        ephemeral: true,
      });
    }

    const gameRoom = gameRooms.get(guildId);
    let sender = null;
    if (gameRoom) {
      sender = gameRoom.players.find((p) => p.userId === interaction.user.id); // player
      if (!sender) return;
    }

    if (interaction.customId.startsWith('submit_vote_wolf_')) {
      await wolfInteraction.isModalSubmit(
        interaction,
        gameRoom,
        sender,
        client
      );
    }
    if (interaction.customId.startsWith('submit_view_wolfseer_')) {
      await wolfSeerInteraction.isModalSubmit(
        interaction,
        gameRoom,
        sender,
        client
      );
    }
    if (interaction.customId.startsWith('submit_mask_alphawerewolf_')) {
      await alphawerewolfInteraction.isModalSubmit(
        interaction,
        gameRoom,
        sender,
        client
      );
    }
    if (interaction.customId.startsWith('submit_protect_bodyguard_')) {
      await bodyguardInteraction.isModalSubmit(
        interaction,
        gameRoom,
        sender,
        client
      );
    }

    if (interaction.customId.startsWith('submit_view_seer_')) {
      await seerInteraction.isModalSubmit(
        interaction,
        gameRoom,
        sender,
        client
      );
    }
    if (interaction.customId.startsWith('submit_investigate_detective_')) {
      await detectiveInteraction.isModalSubmit(
        interaction,
        gameRoom,
        sender,
        client
      );
    }
    if (interaction.customId.startsWith('submit_poison_witch_')) {
      await witchInteraction.isModalSubmitPoison(
        interaction,
        gameRoom,
        sender,
        client
      );
    }
    if (interaction.customId.startsWith('submit_heal_witch_')) {
      await witchInteraction.isModalSubmitHeal(
        interaction,
        gameRoom,
        sender,
        client
      );
    }
    if (interaction.customId.startsWith('submit_vote_hanged_')) {
      await votingInteraction.isModalSubmitVoteHanged(
        interaction,
        gameRoom,
        sender,
        client
      );
    }
    if (interaction.customId.startsWith('submit_revive_medium_')) {
      await mediumInteraction.isModalSubmit(
        interaction,
        gameRoom,
        sender,
        client
      );
    }
    if (interaction.customId === 'settings_modal') {
      await settingsModel.isModalSubmit(interaction);
    }
    if (interaction.customId.startsWith('submit_choose_master_maid_')) {
      await maidInteraction.isModalSubmit(
        interaction,
        gameRoom,
        sender,
        client
      );
    }
    if (interaction.customId === 'customize_roles_json_modal') {
      await customizeRolesJson.isModalSubmit(interaction, gameRooms);
    }
    if (interaction.customId === 'customize_roles_name_modal') {
      await customizeRolesName.isModalSubmit(interaction, gameRooms);
    }
    if (interaction.customId.startsWith('submit_view_foxspirit_')) {
      await foxSpiritInteraction.isModalSubmit(
        interaction,
        gameRoom,
        sender,
        client
      );
    }
    if (interaction.customId.startsWith('submit_stalk_stalker_')) {
      await stalkerInteraction.isModalSubmitStalker(
        interaction,
        gameRoom,
        sender,
        client
      );
    }
    if (interaction.customId.startsWith('submit_kill_stalker_')) {
      await stalkerInteraction.isModalSubmitKill(
        interaction,
        gameRoom,
        sender,
        client
      );
    }
    if (interaction.customId.startsWith('submit_gunner_shoot_')) {
      await gunnerInteraction.isModalSubmitGunner(
        interaction,
        gameRoom,
        sender,
        client
      );
    }
  }

  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    return await interaction.reply({
      content: 'Lệnh không tồn tại!',
      ephemeral: true,
    });
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: 'Có lỗi xảy ra khi thực thi lệnh!',
      ephemeral: true,
    });
  }
});

client.login(process.env.TOKEN);
