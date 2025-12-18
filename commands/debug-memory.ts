import { SlashCommandBuilder } from 'discord.js';

import { gameRooms } from '../core/room.js';

export default {
  data: new SlashCommandBuilder()
    .setName('debug-memory')
    .setDescription('🔧 Kiểm tra memory usage và số lượng rooms đang hoạt động'),

  async execute(interaction: any) {
    const memUsage = process.memoryUsage();
    const activeRooms = gameRooms.size;

    const roomDetails = Array.from(gameRooms.entries()).map(([guildId, room]) => {
      return `- Guild: ${guildId} | Status: ${room.status} | Players: ${room.players.length} | Phase: ${room.gameState.phase}`;
    }).join('\n');

    await interaction.reply({
        content: `
            **📊 Memory Usage:**
            \`\`\`
            Heap Used:  ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB
            Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB
            RSS:        ${Math.round(memUsage.rss / 1024 / 1024)}MB
            External:   ${Math.round(memUsage.external / 1024 / 1024)}MB
            \`\`\`

            **🎮 Active Game Rooms:** ${activeRooms}
            ${roomDetails || '*Không có room nào đang chạy*'}

        ${activeRooms > 0 ? '⚠️ **Cảnh báo:** Nếu không có game nào đang chơi nhưng vẫn còn rooms, có thể đang bị memory leak!' : '✅ Không có rooms nào trong memory'}
            `,
            ephemeral: true,
            });
        },
    };

