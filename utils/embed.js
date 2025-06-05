const path = require('node:path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

const EmbedBuilderWerewolf = (fileName, { title, description }) => {
  const imagePath = path.join(__dirname, '..', 'assets', fileName);
  const file = new AttachmentBuilder(imagePath);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0x00AE86)
    .setImage(`attachment://${fileName}`);

  return { embed, file };
};

module.exports = EmbedBuilderWerewolf;
