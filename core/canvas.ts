import { createCanvas, loadImage } from 'canvas';
import type Player from '../types/player.js';
import type { Client } from 'discord.js';

async function createAvatarCollage(players: Player[], client: Client) {
  const avatarSize = 64;
  const padding = 15;
  const textHeight = 20;
  const avatarsPerRow = 5;

  const rows = Math.ceil(players.length / avatarsPerRow);
  const width = padding + avatarsPerRow * (avatarSize + padding);
  const height = padding + rows * (avatarSize + textHeight + padding);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#2f3136';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'white';
  ctx.font = '12px sans-serif';
  ctx.textBaseline = 'top';

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const user = await client.users.fetch(player.userId);
    const avatarURL = user.displayAvatarURL({ extension: 'png', size: 64 });

    const img = await loadImage(avatarURL);

    const x = padding + (i % avatarsPerRow) * (avatarSize + padding);
    const y =
      padding +
      Math.floor(i / avatarsPerRow) * (avatarSize + textHeight + padding);

    ctx.drawImage(img, x, y, avatarSize, avatarSize);

    if (!player.alive) {
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + avatarSize, y + avatarSize);
      ctx.moveTo(x + avatarSize, y);
      ctx.lineTo(x, y + avatarSize);
      ctx.stroke();
    }

    let displayName = `(${i + 1}) ${user.globalName || user.username}`;
    const maxTextWidth = avatarSize;

    while (
      ctx.measureText(displayName).width > maxTextWidth &&
      displayName.length > 0
    ) {
      displayName = displayName.slice(0, -1);
    }
    if (displayName.length < (user.globalName || user.username).length) {
      displayName = displayName.slice(0, -3) + '...';
    }

    const textWidth = ctx.measureText(displayName).width;
    const textX = x + avatarSize / 2 - textWidth / 2;
    const textY = y + avatarSize + 2;

    ctx.fillText(displayName, textX, textY);
  }

  return canvas.toBuffer();
}

export { createAvatarCollage };
