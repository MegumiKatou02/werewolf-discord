const {
  Client,
  GatewayIntentBits,
  Collection,
  ChannelType,
  Partials,
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { RoleResponse } = require('./utils/response');
const { FactionRole } = require('./types/faction');
const { store } = require('./core/store');
const { gameRooms } = require('./core/room');
const { send } = require('node:process');

require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
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
});

client.on('messageCreate', async (message) => {
  // if (message.author.bot) return;

  await RoleResponse(message, '!soi', 'werewolf.png', 0, FactionRole.Werewolf);
  await RoleResponse(
    message,
    '!danlang',
    'villager.png',
    1,
    FactionRole.Village
  );
  await RoleResponse(
    message,
    '!baove',
    'bodyguard.png',
    2,
    FactionRole.Village
  );
  await RoleResponse(
    message,
    '!bansoi',
    'cursed.png',
    3,
    FactionRole['Vi-Wolf']
  );
  await RoleResponse(message, '!tientri', 'seer.png', 4, FactionRole.Village);
  await RoleResponse(
    message,
    '!thamtu',
    'detective.png',
    5,
    FactionRole.Village
  );
  await RoleResponse(message, '!phuthuy', 'witch.png', 6, FactionRole.Village);
  await RoleResponse(message, '!thangngo', 'fool.png', 7, FactionRole.Solo);
  await RoleResponse(
    message,
    '!thaydong',
    'medium.png',
    8,
    FactionRole.Village
  );

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

    if (gameRoom.gameState.phase === 'night') {
      // Gửi tin nhắn cho các sói khác
      if (sender.role.id === 0) {
        const wolves = gameRoom.players.filter(
          (p) => p.role.id === 0 && p.userId !== sender.userId
        );
        for (const wolf of wolves) {
          try {
            const user = await client.users.fetch(wolf.userId);
            await user.send(`🐺 <@${sender.userId}>: ${message.content}`);
          } catch (err) {
            console.error('Không gửi được tin nhắn cho Sói khác', err);
          }
        }
      }
      const playersDead = gameRoom.players.filter((p) => {
        return (
          p.userId !== sender.userId && (p.alive === false || p.role.id === 8)
        );
      });
      for (const player of playersDead) {
        try {
          const user = await client.users.fetch(player.userId);
          if (sender.role.id === 8 && sender.alive) {
            await user.send(`_🔮 <@${sender.userId}>: ${message.content}_`);
          } else {
            await user.send(`_💀 <@${sender.userId}>: ${message.content}_`);
          }
        } catch (err) {
          console.error('Không gửi được tin nhắn cho người chơi', err);
        }
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
      for (const player of playersInGame) {
        try {
          const user = await client.users.fetch(player.userId);
          if (!sender.alive) {
            if (!player.alive) {
              await user.send(`_💀 <@${sender.userId}>: ${message.content}_`);
            }
          } else {
            await user.send(`🗣️ <@${sender.userId}>: ${message.content}`);
          }
        } catch (err) {
          console.error('Không gửi được tin nhắn cho người chơi', err);
        }
      }
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('vote_target_wolf_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_vote_wolf_${playerId}`)
        .setTitle('Vote người chơi cần giết');

      const input = new TextInputBuilder()
        .setCustomId('vote_index_wolf')
        .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }
    if (interaction.customId.startsWith('protect_target_bodyguard_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_protect_bodyguard_${playerId}`)
        .setTitle('Chọn người cần bảo vệ');

      const input = new TextInputBuilder()
        .setCustomId('protect_index_bodyguard')
        .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }
    if (interaction.customId.startsWith('view_target_seer_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_view_seer_${playerId}`)
        .setTitle('Xem vai trò người chơi');

      const input = new TextInputBuilder()
        .setCustomId('view_index_seer')
        .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }
    if (interaction.customId.startsWith('investigate_target_detective_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_investigate_detective_${playerId}`)
        .setTitle('Điều tra người chơi');

      const input1 = new TextInputBuilder()
        .setCustomId('investigate_index_1')
        .setLabel('Nhập số thứ tự người chơi 1 (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const input2 = new TextInputBuilder()
        .setCustomId('investigate_index_2')
        .setLabel('Nhập số thứ tự người chơi 2 (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 4')
        .setRequired(true);

      const row1 = new ActionRowBuilder().addComponents(input1);
      const row2 = new ActionRowBuilder().addComponents(input2);
      modal.addComponents(row1, row2);

      await interaction.showModal(modal);
    }
    if (interaction.customId.startsWith('poison_target_witch_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_poison_witch_${playerId}`)
        .setTitle('Chọn người chơi để dùng thuốc');

      const input = new TextInputBuilder()
        .setCustomId('poison_index_witch')
        .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }
    if (interaction.customId.startsWith('heal_target_witch_')) {
      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_heal_witch_${playerId}`)
        .setTitle('Chọn người chơi để cứu');

      const input = new TextInputBuilder()
        .setCustomId('heal_index_witch')
        .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }
    if (interaction.customId.startsWith('vote_hanged_')) {
      const playerId = interaction.customId.split('_')[2];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được nhấn nút này.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`submit_vote_hanged_${playerId}`)
        .setTitle('Vote người chơi để treo cổ');

      const input = new TextInputBuilder()
        .setCustomId('vote_index_hanged')
        .setLabel('Nhập số thứ tự người chơi (bắt đầu từ 1)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 3')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }
  }

  if (interaction.isModalSubmit()) {
    const guildId = store.get(interaction.user.id);
    const gameRoom = gameRooms.get(guildId);

    const sender = gameRoom.players.find(
      (p) => p.userId === interaction.user.id
    ); // player
    if (!sender) return;

    if (interaction.customId.startsWith('submit_vote_wolf_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const voteIndexStr =
        interaction.fields.getTextInputValue('vote_index_wolf');
      const voteIndex = parseInt(voteIndexStr, 10);

      if (
        isNaN(voteIndex) ||
        voteIndex < 1 ||
        voteIndex > gameRoom.players.length
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[voteIndex - 1];

      if (sender.role.id === 0) {
        if (sender.role.biteCount <= 0) {
          return interaction.reply({
            content: 'Bạn đã hết lượt dùng chức năng',
            ephemeral: true,
          });
        }

        if (targetPlayer.role.faction === 0) {
          // FactionRole.Werewolf
          return interaction.reply({
            content: 'Bạn không thể vote giết đồng minh của mình.',
            ephemeral: true,
          });
        }

        // sender.role.biteCount -= 1; lỡ chọn lại
        sender.role.voteBite = targetPlayer.userId;
      }

      try {
        const user = await client.users.fetch(playerId);
        for (const player of gameRoom.players) {
          if (player.role.id === 0) {
            if (player.userId !== playerId) {
              const targetUser = await client.users.fetch(player.userId);
              await targetUser.send(
                `<@${sender.userId}> đã vote giết <@${targetPlayer.userId}>.`
              );
            } else {
              await user.send(`Bạn đã vote giết: <@${targetPlayer.userId}>.`);
            }
          }
        }
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }

      await interaction.reply({
        content: '✅ Vote của bạn đã được ghi nhận.',
        ephemeral: true,
      });
    }
    if (interaction.customId.startsWith('submit_protect_bodyguard_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const protectIndexStr = interaction.fields.getTextInputValue(
        'protect_index_bodyguard'
      );
      const protectIndex = parseInt(protectIndexStr, 10);

      if (
        isNaN(protectIndex) ||
        protectIndex < 1 ||
        protectIndex > gameRoom.players.length
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[protectIndex - 1];
      if (sender.role.id === 2) {
        if (sender.role.protectedCount <= 0) {
          return interaction.reply({
            content: 'Bạn đã hết lượt dùng chức năng',
            ephemeral: true,
          });
        }
        // sender.role.protectedCount -= 1; lỡ chọn lại
        sender.role.protectedPerson = targetPlayer.userId;
      }

      try {
        const user = await client.users.fetch(playerId);
        await user.send(`✅ Bạn đã bảo vệ: <@${targetPlayer.userId}>.`);
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }

      await interaction.reply({
        content: '✅ Bảo vệ thành công.',
        ephemeral: true,
      });
    }
    if (interaction.customId.startsWith('submit_view_seer_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const viewIndexStr =
        interaction.fields.getTextInputValue('view_index_seer');
      const viewIndex = parseInt(viewIndexStr, 10);

      if (
        isNaN(viewIndex) ||
        viewIndex < 1 ||
        viewIndex > gameRoom.players.length
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[viewIndex - 1];
      if (sender.role.id === 4) {
        if (sender.role.viewCount <= 0) {
          return interaction.reply({
            content: 'Bạn đã hết lượt dùng chức năng',
            ephemeral: true,
          });
        }

        if (sender.role.id === targetPlayer.role.id) {
          return interaction.reply({
            content: 'Bạn không thể xem vai trò của đồng minh.',
            ephemeral: true,
          });
        }

        sender.role.viewCount -= 1; // soi rồi không chọn lại được nữa
        await interaction.reply({
          content: `Vai trò của <@${targetPlayer.userId}> là: **${targetPlayer.role.name}**.`,
          ephemeral: false,
        });
      }

      try {
        const user = await client.users.fetch(playerId);
        await user.send(
          `✅ Bạn đã xem vai trò của: <@${targetPlayer.userId}>.`
        );
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }
    }
    if (interaction.customId.startsWith('submit_investigate_detective_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const index1Str = interaction.fields.getTextInputValue(
        'investigate_index_1'
      );
      const index2Str = interaction.fields.getTextInputValue(
        'investigate_index_2'
      );
      const index1 = parseInt(index1Str, 10);
      const index2 = parseInt(index2Str, 10);

      if (
        isNaN(index1) ||
        isNaN(index2) ||
        index1 < 1 ||
        index2 < 1 ||
        index1 > gameRoom.players.length ||
        index2 > gameRoom.players.length ||
        index1 === index2
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ hoặc trùng nhau.',
          ephemeral: true,
        });
      }

      const targetPlayer1 = gameRoom.players[index1 - 1];
      const targetPlayer2 = gameRoom.players[index2 - 1];

      if (sender.role.id === 5) {
        if (sender.role.investigatedCount <= 0) {
          return interaction.reply({
            content: 'Bạn đã hết lượt dùng chức năng',
            ephemeral: true,
          });
        }

        if (
          targetPlayer1.userId === sender.userId ||
          targetPlayer2.userId === sender.userId
        ) {
          return interaction.reply({
            content: 'Bạn không thể chọn chính bản thân bạn.',
            ephemeral: true,
          });
        }

        sender.role.investigatedPairs.push([
          targetPlayer1.userId,
          targetPlayer2.userId,
        ]);
        sender.role.investigatedCount -= 1; // soi rồi không chọn lại được nữa
        await interaction.reply({
          content: `Bạn đã điều tra: <@${targetPlayer1.userId}> và <@${targetPlayer2.userId}>. Họ ${targetPlayer1.role.faction === targetPlayer2.role.faction ? 'cùng phe' : 'khác phe'}.`,
          ephemeral: false,
        });
      }

      try {
        const user = await client.users.fetch(playerId);
        await user.send(
          `✅ Bạn đã điều tra: **${targetPlayer1.userId}** và **${targetPlayer2.userId}**.`
        );
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }
    }
    if (interaction.customId.startsWith('submit_poison_witch_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const pointIndexStr =
        interaction.fields.getTextInputValue('poison_index_witch');
      const pointIndex = parseInt(pointIndexStr, 10);

      if (
        isNaN(pointIndex) ||
        pointIndex < 1 ||
        pointIndex > gameRoom.players.length
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[pointIndex - 1];
      if (sender.role.id === 6) {
        if (sender.role.poisonCount <= 0) {
          return interaction.reply({
            content: 'Bạn đã hết lượt dùng chức năng',
            ephemeral: true,
          });
        }

        if (targetPlayer.userId === sender.userId) {
          return interaction.reply({
            content: 'Bạn không thể chọn chính bản thân bạn.',
            ephemeral: true,
          });
        }

        // sender.role.poisonCount -= 1; // lỡ chọn lại
        sender.role.poisonedPerson = targetPlayer.userId;
      }

      try {
        const user = await client.users.fetch(playerId);
        await user.send(
          `✅ Bạn đã chọn người chơi để dùng thuốc: <@${targetPlayer.userId}>.`
        );
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }

      await interaction.reply({
        content: '✅ Chọn người chơi thành công.',
        ephemeral: true,
      });
    }
    if (interaction.customId.startsWith('submit_heal_witch_')) {
      if (!gameRoom || gameRoom.gameState.phase !== 'night') return;

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const healIndexStr =
        interaction.fields.getTextInputValue('heal_index_witch');
      const healIndex = parseInt(healIndexStr, 10);

      if (
        isNaN(healIndex) ||
        healIndex < 1 ||
        healIndex > gameRoom.players.length
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[healIndex - 1];
      if (sender.role.id === 6) {
        if (sender.role.healCount <= 0) {
          return interaction.reply({
            content: 'Bạn đã hết lượt dùng chức năng',
            ephemeral: true,
          });
        }
        if (targetPlayer.userId === sender.userId) {
          return interaction.reply({
            content: 'Bạn không thể cứu chính bản thân bạn.',
            ephemeral: true,
          });
        }

        if (targetPlayer.userId !== sender.role.needHelpPerson) {
          return interaction.reply({
            content: 'Bạn chỉ có thể cứu người chơi đã được yêu cầu giúp đỡ.',
            ephemeral: true,
          });
        }

        sender.role.healCount -= 1; // cứu rồi không cứu lại được nữa
        sender.role.healedPerson = targetPlayer.userId;
      }

      try {
        const user = await client.users.fetch(playerId);
        await user.send(
          `✅ Bạn đã chọn người chơi để cứu: <@${targetPlayer.userId}>.`
        );
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }

      await interaction.reply({
        content: '✅ Chọn người chơi thành công.',
        ephemeral: true,
      });
    }
    if (interaction.customId.startsWith('submit_vote_hanged_')) {
      if (!gameRoom) return;

      if (
        gameRoom.gameState.phase !== 'voting' &&
        gameRoom.gameState.phase === 'day'
      ) {
        return interaction.reply({
          content: 'Bạn chưa thể vote ngay lúc này',
          ephemeral: true,
        });
      }

      const playerId = interaction.customId.split('_')[3];

      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: 'Bạn không được gửi form này.',
          ephemeral: true,
        });
      }

      const voteIndexStr =
        interaction.fields.getTextInputValue('vote_index_hanged');
      const voteIndex = parseInt(voteIndexStr, 10);

      if (
        isNaN(voteIndex) ||
        voteIndex < 1 ||
        voteIndex > gameRoom.players.length
      ) {
        return interaction.reply({
          content: 'Số thứ tự không hợp lệ.',
          ephemeral: true,
        });
      }

      const targetPlayer = gameRoom.players[voteIndex - 1];

      if (targetPlayer.userId === sender.userId) {
        return interaction.reply({
          content: 'Bạn không thể vote chính mình.',
          ephemeral: true,
        });
      }

      if (!sender.alive) {
        return interaction.reply({
          content: 'Người chết không thể vote.',
          ephemeral: true,
        });
      }

      if (!targetPlayer.alive) {
        return interaction.reply({
          content: 'Không thể vote người đã chết.',
          ephemeral: true,
        });
      }

      sender.role.voteHanged = targetPlayer.userId;

      try {
        const user = await client.users.fetch(playerId);
        for (const player of gameRoom.players) {
          if (player.userId !== playerId) {
            const targetUser = await client.users.fetch(player.userId);
            await targetUser.send(`✅ <@${sender.userId}> đã vote.`);
          } else {
            await user.send(
              `✅ Bạn đã vote treo cổ: <@${targetPlayer.userId}>.`
            );
          }
        }
      } catch (err) {
        console.error(`Không thể gửi DM cho ${playerId}:`, err);
      }
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
