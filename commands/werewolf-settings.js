const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require('discord.js');
const { gameRooms } = require('../core/room');
const { serverSettings } = require('../core/store');

const defaultSettings = {
  wolfVoteTime: 40,
  nightTime: 70,
  discussTime: 90,
  voteTime: 30,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Xem và điều chỉnh cài đặt game Ma Sói')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guildId = interaction.guildId;

    const gameRoom = gameRooms.get(guildId);
    if (gameRoom && gameRoom.status === 'starting') {
      return interaction.reply({
        content: '❌ Không thể thay đổi cài đặt khi đang có phòng chơi!',
        ephemeral: true,
      });
    }

    const settings = serverSettings.get(guildId) || defaultSettings;

    const settingsEmbed = new EmbedBuilder()
      .setColor(0x9c27b0)
      .setTitle('⚙️ CÀI ĐẶT GAME MA SÓI')
      .setDescription('```📋 Các thông số hiện tại của game```')
      .addFields(
        {
          name: '🐺 Thời Gian Sói Vote',
          value: `\`${settings.wolfVoteTime}\` giây`,
          inline: true,
        },
        {
          name: '🌙 Thời Gian Ban Đêm',
          value: `\`${settings.nightTime}\` giây`,
          inline: true,
        },
        {
          name: '💭 Thời Gian Thảo Luận',
          value: `\`${settings.discussTime}\` giây`,
          inline: true,
        },
        {
          name: '🗳️ Thời Gian Vote Treo Cổ',
          value: `\`${settings.voteTime}\` giây`,
          inline: true,
        }
      )
      .setFooter({ text: '💡 Chỉ Admin mới có thể thay đổi cài đặt' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('edit_settings')
        .setLabel('🔧 Điều Chỉnh Cài Đặt')
        .setStyle(ButtonStyle.Primary)
    );

    const response = await interaction.reply({
      embeds: [settingsEmbed],
      components: [row],
      // ephemeral: true,
    });

    const collector = response.createMessageComponentCollector({
      time: 60000, // 1p
    });

    collector.on('collect', async (i) => {
      if (i.customId === 'edit_settings') {
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
          await i.reply({
            content: '❌ Bạn cần có quyền Admin để thay đổi cài đặt!',
            ephemeral: true,
          });
          return;
        }

        const modal = new ModalBuilder()
          .setCustomId('settings_modal')
          .setTitle('⚙️ Điều Chỉnh Thông Số Game');

        const wolfVoteInput = new TextInputBuilder()
          .setCustomId('wolfVoteTime')
          .setLabel('🐺 Thời gian Sói vote (giây)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Mặc định: 40')
          .setValue(settings.wolfVoteTime.toString())
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(3);

        const nightTimeInput = new TextInputBuilder()
          .setCustomId('nightTime')
          .setLabel('🌙 Thời gian Ban đêm (giây)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Mặc định: 70')
          .setValue(settings.nightTime.toString())
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(3);

        const discussTimeInput = new TextInputBuilder()
          .setCustomId('discussTime')
          .setLabel('💭 Thời gian Thảo luận (giây)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Mặc định: 90')
          .setValue(settings.discussTime.toString())
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(3);

        const voteTimeInput = new TextInputBuilder()
          .setCustomId('voteTime')
          .setLabel('🗳️ Thời gian Vote treo cổ (giây)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Mặc định: 30')
          .setValue(settings.voteTime.toString())
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(3);

        modal.addComponents(
          new ActionRowBuilder().addComponents(wolfVoteInput),
          new ActionRowBuilder().addComponents(nightTimeInput),
          new ActionRowBuilder().addComponents(discussTimeInput),
          new ActionRowBuilder().addComponents(voteTimeInput)
        );

        await i.showModal(modal);
      }
    });
  },
};
