import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EmbedBuilderWerewolf = (
  fileName: string,
  { title, description }: { title: string; description: string }
) => {
  const imagePath = path.join(__dirname, '..', 'assets', fileName);
  const file = new AttachmentBuilder(imagePath);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0x00ae86)
    .setImage(`attachment://${fileName}`);

  return { embed, file };
};

export default EmbedBuilderWerewolf;
