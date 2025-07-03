import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  PermissionsBitField,
  type Interaction,
  MessageFlags,
} from 'discord.js';

import ServerSettings from '../../../../models/ServerSettings.js';

class Settings {
  handleButtonClick = async (interaction: Interaction) => {
    if (!interaction.isButton()) {
      return;
    }

    const isAdmin =
      (interaction.member?.permissions instanceof PermissionsBitField &&
        interaction.member.permissions.has(
          PermissionFlagsBits.Administrator,
        )) ??
      false;
    const isDev = interaction.user.id === process.env.DEVELOPER;

    if (!isAdmin && !isDev) {
      await interaction.reply({
        content: '❌ Bạn cần có quyền Admin để thay đổi cài đặt!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guildId = interaction.guildId;
    let settings = await ServerSettings.findOne({ guildId });
    if (!settings) {
      const defaultSettings = {
        wolfVoteTime: 40,
        nightTime: 70,
        discussTime: 90,
        voteTime: 30,
      };
      settings = new ServerSettings({
        guildId,
        ...defaultSettings,
      });
      await settings.save();
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
      new ActionRowBuilder<TextInputBuilder>().addComponents(wolfVoteInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        nightTimeInput,
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        discussTimeInput,
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(voteTimeInput),
    );

    await interaction.showModal(modal);
  };

  isModalSubmit = async (interaction: Interaction) => {
    if (!interaction.isModalSubmit()) {
      return;
    }

    const newSettings = {
      wolfVoteTime: parseInt(
        interaction.fields.getTextInputValue('wolfVoteTime'),
      ),
      nightTime: parseInt(interaction.fields.getTextInputValue('nightTime')),
      discussTime: parseInt(
        interaction.fields.getTextInputValue('discussTime'),
      ),
      voteTime: parseInt(interaction.fields.getTextInputValue('voteTime')),
    };

    if (
      Object.values(newSettings).some(
        (value) => isNaN(value) || value < 10 || value > 300,
      )
    ) {
      await interaction.reply({
        content: '❌ Vui lòng nhập số từ 10 đến 300 giây!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (newSettings.wolfVoteTime >= newSettings.nightTime) {
      return interaction.reply({
        content:
          '❌ Thời gian sói vote không thể lớn hơn hoặc bằng thời gian trong đêm.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferUpdate();

    const guildId = interaction.guild?.id;
    if (!guildId) {
      return;
    }

    await ServerSettings.findOneAndUpdate({ guildId }, newSettings, {
      new: true,
      upsert: true,
    });

    const updatedEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('⚙️ CÀI ĐẶT GAME MA SÓI')
      .setDescription('```✅ Cài đặt đã được cập nhật thành công!```')
      .addFields(
        {
          name: '🐺 Thời Gian Sói Vote',
          value: `\`${newSettings.wolfVoteTime}\` giây`,
          inline: true,
        },
        {
          name: '🌙 Thời Gian Ban Đêm',
          value: `\`${newSettings.nightTime}\` giây`,
          inline: true,
        },
        {
          name: '💭 Thời Gian Thảo Luận',
          value: `\`${newSettings.discussTime}\` giây`,
          inline: true,
        },
        {
          name: '🗳️ Thời Gian Vote Treo Cổ',
          value: `\`${newSettings.voteTime}\` giây`,
          inline: true,
        },
      )
      .setFooter({
        text: '💡 Cài đặt sẽ được áp dụng cho các game tiếp theo',
      });

    await interaction.editReply({
      embeds: [updatedEmbed],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('edit_settings')
            .setLabel('🔧 Điều Chỉnh Cài Đặt')
            .setStyle(ButtonStyle.Primary),
        ),
      ],
    });
  };
}

export default new Settings();
