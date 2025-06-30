import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Interaction,
} from 'discord.js';
import ServerSettings from '../../../../models/ServerSettings.js';

class Settings {
  isModalSubmit = async (interaction: Interaction) => {
    if (!interaction.isModalSubmit()) return;

    const newSettings = {
      wolfVoteTime: parseInt(
        interaction.fields.getTextInputValue('wolfVoteTime')
      ),
      nightTime: parseInt(interaction.fields.getTextInputValue('nightTime')),
      discussTime: parseInt(
        interaction.fields.getTextInputValue('discussTime')
      ),
      voteTime: parseInt(interaction.fields.getTextInputValue('voteTime')),
    };

    await interaction.deferUpdate();

    if (
      Object.values(newSettings).some(
        (value) => isNaN(value) || value < 10 || value > 300
      )
    ) {
      await interaction.editReply({
        content: '❌ Vui lòng nhập số từ 10 đến 300 giây!',
      });
      return;
    }

    if (newSettings.wolfVoteTime >= newSettings.nightTime) {
      return interaction.editReply({
        content:
          'Thời gian sói vote không thể lớn hơn hoặc bằng thời gian trong đêm.',
      });
    }

    const guildId = interaction.guild?.id;
    if (!guildId) return;
    // serverSettings.set(guildId, newSettings);

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
        }
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
            .setStyle(ButtonStyle.Primary)
        ),
      ],
    });
  };
}

export default new Settings();
