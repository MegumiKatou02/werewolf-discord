const { SlashCommandBuilder } = require('discord.js')
const { gameRooms } = require('../core/room')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('masoi-start')
        .setDescription('Bắt đầu chơi game'),

    async execute(interaction) {
        const guildId = interaction.guildId;

        if (!gameRooms.has(guildId)) {
            return interaction.reply('Chưa có phòng chơi, hãy để người chơi tham gia trước.');
        }

        const room = gameRooms.get(guildId);

        if (room.status !== 'waiting') {
            return interaction.reply('Trò chơi đã bắt đầu hoặc kết thúc.');
        }

        try {
            await room.startGame(interaction);
            return interaction.reply('Trò chơi đã bắt đầu! Vai trò đã được chia.');
        } catch (err) {
            return interaction.reply(`Lỗi: ${err.message}`);
        }
    }
}