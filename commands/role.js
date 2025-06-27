const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const rolesData = require('../data/data.json');
const { convertFactionRoles } = require('../utils/role');
const EmbedBuilderWerewolf = require('../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Xem thông tin chi tiết của các vai trò trong game Ma Sói'),

  async execute(interaction) {
    const roleOptions = Object.entries(rolesData)
      .filter(([id]) => id !== '9')
      .map(([id, role]) => {
        let emoji;
        switch (role.faction) {
          case 0:
            emoji = '🐺';
            break;
          case 1:
            emoji = '👤';
            break;
          case 2:
            emoji = '🎪';
            break;
          case 3:
            emoji = '🌙';
            break;
          default:
            emoji = '❓';
        }

        let shortDescription = role.description;
        if (shortDescription.length > 80) {
          shortDescription = shortDescription.substring(0, 80) + '...';
        }

        return new StringSelectMenuOptionBuilder()
          .setLabel(`${role.title} (${role.eName})`)
          .setDescription(shortDescription)
          .setValue(id)
          .setEmoji(emoji);
      });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('role_select')
      .setPlaceholder('Chọn một vai trò để xem thông tin chi tiết...')
      .addOptions(roleOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const initialEmbed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🎭 THÔNG TIN VAI TRÒ')
      .setDescription(
        'Chọn một vai trò từ menu bên dưới để xem thông tin chi tiết!\n\n' +
          '🐺 **Phe Sói** - Cần tiêu diệt dân làng\n' +
          '👤 **Phe Dân** - Cần tìm và tiêu diệt sói\n' +
          '🎪 **Phe Solo** - Có mục tiêu riêng\n' +
          '🌙 **??** - Có thể chuyển phe'
      )
      .setFooter({ text: 'Sử dụng menu bên dưới để chọn vai trò!' });

    const response = await interaction.reply({
      embeds: [initialEmbed],
      components: [row],
    });

    const collector = response.createMessageComponentCollector({
      time: 180000, // 3 phút
    });

    collector.on('collect', async (i) => {
      if (
        i.user.id !== interaction.user.id &&
        i.user.id !== process.env.DEVELOPER
      ) {
        await i.reply({
          content:
            'Bạn không thể sử dụng menu này! Hãy gõ `/role` để tạo menu riêng cho bạn :v',
          ephemeral: true,
        });
        return;
      }

      if (i.customId === 'role_select') {
        const selectedRoleId = i.values[0];
        const selectedRole = rolesData[selectedRoleId];

        const factionRole = convertFactionRoles(selectedRole.faction);

        const fileName = `${selectedRole.eName.toLowerCase().replace(/\s+/g, '_')}.png`;
        const { embed, file } = EmbedBuilderWerewolf(fileName, {
          title: `${selectedRole.title} (${selectedRole.eName})`,
          description: `${selectedRole.description}\n\n**Phe:** ${factionRole}`,
        });

        embed.setDescription(embed.data.description);

        await i.update({
          embeds: [embed],
          files: [file],
          components: [row],
        });
      }
    });

    collector.on('end', async () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        StringSelectMenuBuilder.from(selectMenu).setDisabled(true)
      );

      await interaction
        .editReply({
          components: [disabledRow],
        })
        .catch(() => {});
    });
  },
};
