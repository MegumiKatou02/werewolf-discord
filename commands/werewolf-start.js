const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { gameRooms } = require('../core/room');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('masoi-start')
    .setDescription('Bắt đầu chơi game'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: 'Lệnh này chỉ sử dụng được trong server.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;

    if (!gameRooms.has(guildId)) {
      return interaction.editReply(
        'Chưa có phòng chơi, hãy để người chơi tham gia trước.'
      );
    }

    const room = gameRooms.get(guildId);

    if (room.status !== 'waiting') {
      return interaction.editReply('Trò chơi đã bắt đầu hoặc kết thúc.');
    }

    // const member = interaction.member;

    const isAdmin =
      interaction.member?.permissions.has(PermissionFlagsBits.Administrator) ??
      false;
    const isHost = interaction.user.id === room.hostId;

    if (!isAdmin && !isHost) {
      return interaction.editReply({
        content: '❌ Chỉ host hoặc admin mới được phép bắt đầu trò chơi.',
        ephemeral: true,
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('use_default_roles')
        .setLabel('Dùng vai trò mặc định')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('customize_roles_json')
        .setLabel('Tuỳ chỉnh vai trò (JSON)')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: '🎮 Chọn cách phân vai trò:',
      components: [row],
    });
  },
};
