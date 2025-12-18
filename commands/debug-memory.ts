import { SlashCommandBuilder } from 'discord.js';

import { gameRooms } from '../core/room.js';

export default {
  data: new SlashCommandBuilder()
    .setName('debug-memory')
    .setDescription('🔧 Kiểm tra memory usage và số lượng rooms đang hoạt động'),

  async execute(interaction: any) {
    const memUsage = process.memoryUsage();
    const activeRooms = gameRooms.size;

    const roomDetails = Array.from(gameRooms.entries())
      .map(([guildId, room]) => {
        return `  • **${guildId}** → Status: \`${room.status}\` | Players: \`${room.players.length}\` | Phase: \`${room.gameState.phase}\``;
      })
      .join('\n');

    const statusEmoji = activeRooms === 0 ? '✅' : activeRooms > 2 ? '🔴' : '🟡';
    const statusMsg = activeRooms === 0 
      ? '✅ **Không có rooms nào trong memory - Tốt!**'
      : activeRooms > 2
        ? '🔴 **Cảnh báo:** Có quá nhiều rooms! Có thể đang bị memory leak.'
        : '🟡 **Chú ý:** Có rooms đang chạy, hãy đảm bảo đang có game.';

    await interaction.reply({
      content: `
## 📊 System Memory Usage
\`\`\`css
Heap Used  : ${Math.round(memUsage.heapUsed / 1024 / 1024).toString().padStart(4)} MB
Heap Total : ${Math.round(memUsage.heapTotal / 1024 / 1024).toString().padStart(4)} MB
RSS        : ${Math.round(memUsage.rss / 1024 / 1024).toString().padStart(4)} MB
External   : ${Math.round(memUsage.external / 1024 / 1024).toString().padStart(4)} MB
\`\`\`
🎮 Active Game Rooms: ${statusEmoji} **${activeRooms}**
${roomDetails || '*Không có room nào đang chạy*'}

${statusMsg}
      `.trim(),
      ephemeral: true,
    });
  },
};

