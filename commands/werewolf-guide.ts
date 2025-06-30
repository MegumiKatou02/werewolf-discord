import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type Interaction,
  type MessageComponentInteraction,
} from 'discord.js';

import tips from '../data/tips.json' with { type: 'json' };

export default {
  data: new SlashCommandBuilder()
    .setName('huongdan')
    .setDescription('Xem hướng dẫn chi tiết về cách chơi Ma Sói'),

  async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const getRandomTip = () => {
      const tipsArray = Object.values(tips);
      const randomIndex = Math.floor(Math.random() * tipsArray.length);
      return tipsArray[randomIndex];
    };

    const tipsEmbed = new EmbedBuilder()
      .setColor(0x4caf50)
      .setTitle('💡 CÁCH CHƠI VỚI BOT')
      .addFields(
        {
          name: '⚠️ Lưu Ý Quan Trọng',
          value:
            '• **Bạn cần BẬT "Cho phép tin nhắn trực tiếp từ thành viên máy chủ" trong Discord để có thể chơi!**\n' +
            '• Cách bật: Chuột phải vào server > Cài đặt bảo mật > Bật "Cho phép tin nhắn trực tiếp từ thành viên máy chủ"\n' +
            '• Nếu không bật, bạn sẽ không nhận được thông báo vai trò và không thể tương tác trong game!',
        },
        {
          name: '📋 Cách Chơi Chính',
          value:
            '• Khi bắt đầu game bot sẽ nhắn cho bạn\n' +
            '• Bạn và người khác sẽ giao tiếp thông qua bot bằng cách nhắn trực tiếp vào thanh chat\n' +
            '• Bạn cũng có thể tương tác với vai trò của mình thông qua bot\n',
        },
        {
          name: '🎮 Các Lệnh Trong Game',
          value:
            '`/masoi-create` - Tạo phòng mới\n' +
            '`/masoi-join` - Tham gia phòng\n' +
            '`/masoi-leave` - Rời phòng\n' +
            '`/masoi-start` - Bắt đầu game (chỉ host)\n' +
            '`/role` - Xem thông tin chi tiết của các vai trò trong game Ma Sói\n' +
            '`/status` - Xem trạng thái phòng trong server\n' +
            '`/huongdan` - Xem hướng dẫn này\n' +
            '...',
        },
      )
      .setFooter({ text: `💡 Mẹo: ${getRandomTip()}` });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('guide_select')
      .setPlaceholder('Chọn hướng dẫn bạn muốn xem...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Cách Chơi với Bot')
          .setDescription('Hướng dẫn cách sử dụng bot và các lệnh cơ bản')
          .setValue('guide_tips')
          .setEmoji('💡'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Luật Chơi')
          .setDescription('Các luật chơi cơ bản và điều kiện thắng thua')
          .setValue('guide_rules')
          .setEmoji('📜'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Vai Trò')
          .setDescription('Thông tin về các vai trò trong game Ma Sói')
          .setValue('guide_roles')
          .setEmoji('🎭'),
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu,
    );

    const response = await interaction.reply({
      embeds: [tipsEmbed],
      components: [row],
      ephemeral: false,
    });

    const collector = response.createMessageComponentCollector({
      time: 300000,
    });

    collector.on('collect', async (i: MessageComponentInteraction) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: 'Bạn không thể sử dụng menu này!',
          ephemeral: true,
        });
        return;
      }

      const rulesEmbed = new EmbedBuilder()
        .setColor(0x9c27b0)
        .setTitle('📜 LUẬT CHƠI CƠ BẢN')
        .addFields(
          {
            name: '⏰ Chu Kỳ Ngày Đêm',
            value:
              '• **Ban Đêm**: Các vai trò đặc biệt thực hiện khả năng của mình\n' +
              '• **Ban Ngày**: Mọi người thảo luận và vote treo cổ người khả nghi',
          },
          {
            name: '🎯 Cách Vote',
            value:
              '• **Ban Đêm**: Sói vote để cắn người\n' +
              '• **Ban Ngày**: Tất cả vote để treo cổ\n' +
              '• Người có số vote cao nhất và ít nhất 2 vote sẽ bị treo',
          },
          {
            name: '🏆 Điều Kiện Thắng',
            value:
              '• **Phe Sói**: Thắng khi số Sói >= số Dân\n' +
              '• **Phe Dân**: Thắng khi tiêu diệt hết Sói\n' +
              '• **Phe Solo**: Thắng theo điều kiện riêng',
          },
        )
        .setFooter({ text: `💡 Mẹo: ${getRandomTip()}` });

      const rolesEmbed = new EmbedBuilder()
        .setColor(0x2196f3)
        .setTitle('🎭 CÁC VAI TRÒ TRONG GAME')
        .addFields(
          {
            name: '🐺 Sói (Phe Sói)',
            value:
              '• Mỗi đêm chọn 1 người để cắn\n• Biết được đồng đội là ai\n• Có thể chat riêng với nhau vào ban đêm',
            inline: true,
          },
          {
            name: '🛡️ Bảo Vệ (Phe Dân)',
            value:
              '• Mỗi đêm bảo vệ 1 người khỏi bị Sói cắn\n• Có 2 máu khi bảo vệ người bị cắn\n• Có thể tự bảo vệ mình',
            inline: true,
          },
          {
            name: '🔮 Tiên Tri (Phe Dân)',
            value:
              '• Mỗi đêm soi vai trò của 1 người\n• Biết được người đó thuộc phe nào',
            inline: true,
          },
          {
            name: '🕵️ Thám Tử (Phe Dân)',
            value:
              '• Mỗi đêm điều tra 2 người\n• Biết 2 người đó có cùng phe không',
            inline: true,
          },
          {
            name: '🧙‍♀️ Phù Thủy (Phe Dân)',
            value:
              '• Có 1 bình cứu và 1 bình độc\n• Biết ai bị Sói cắn để cứu\n• Có thể dùng bình độc giết 1 người',
            inline: true,
          },
          {
            name: '👻 Thầy Đồng (Phe Dân)',
            value:
              '• Có thể hồi sinh 1 người dân đã chết\n• Chỉ được dùng 1 lần trong game',
            inline: true,
          },
          {
            name: '🎪 Thằng Ngố (Phe Solo)',
            value:
              '• Thắng nếu bị dân làng treo cổ\n• Thua nếu chết vì lý do khác',
            inline: true,
          },
          {
            name: '🌙 Bán Sói (Phe Dân)',
            value: '• Ban đầu là dân thường\n• Biến thành Sói nếu bị Sói cắn',
            inline: true,
          },
          {
            name: '👒 Hầu Gái (Phe Dân)',
            value:
              '• Ban đầu là Hầu Gái và được chọn chủ trong đêm đầu tiên\n• Biến thành vai trò của chủ nếu chủ chết',
            inline: true,
          },
          {
            name: '🤷 Lycan (Phe Dân)',
            value:
              '• Không có gì cả ngoài việc bị cho là phe sói khi bị soi\n• LYCAN LÀ DÂN',
            inline: true,
          },
          {
            name: '🐺 Sói Trùm (Phe Sói)',
            value:
              '• Che các sói khỏi tiên tri\n• Được phép che liên tục một người',
            inline: true,
          },
          {
            name: '🐺 Sói Tiên Tri (Phe Sói)',
            value:
              '• Soi xem ai là tiên tri\n• Được quản trò báo cho cả làng soi ai và báo cho sói có phải tiên tri hay không',
            inline: true,
          },
          {
            name: '🦊 Cáo (Phe Dân)',
            value:
              '• Mỗi đêm dậy soi 3 người tự chọn trong danh sách, nếu 1 trong 3 người đó là sói thì được báo "Có sói", nếu đoán hụt thì mất chức năng.',
            inline: true,
          },
        )
        .setFooter({ text: `💡 Mẹo: ${getRandomTip()}` });

      await i.deferUpdate();

      if (i.isStringSelectMenu()) {
        switch (i.values[0]) {
        case 'guide_tips':
          await i.editReply({ embeds: [tipsEmbed], components: [row] });
          break;
        case 'guide_rules':
          await i.editReply({ embeds: [rulesEmbed], components: [row] });
          break;
        case 'guide_roles':
          await i.editReply({ embeds: [rolesEmbed], components: [row] });
          break;
        }
      }
    });

    collector.on('end', async () => {
      const disabledRow =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          StringSelectMenuBuilder.from(selectMenu).setDisabled(true),
        );

      await interaction
        .editReply({
          components: [disabledRow],
        })
        .catch(() => {});
    });
  },
};
