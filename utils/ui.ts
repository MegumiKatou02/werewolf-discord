import { EmbedBuilder, MessageFlags, TextDisplayBuilder, type User } from 'discord.js';

export const UI_COLORS = {
  accent: 0x313338,
  success: 0x00a86b,
  warning: 0xffa500,
  danger: 0xff4d4f,
} as const;

export function createMinimalEmbed(options: {
  title?: string;
  description?: string;
  color?: number;
  footerUser?: User;
}): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(options.color ?? UI_COLORS.accent);

  if (options.title) {
    embed.setTitle(options.title);
  }
  if (options.description) {
    embed.setDescription(options.description);
  }
  if (options.footerUser) {
    embed.setFooter({ text: options.footerUser.displayName });
  }

  embed.setTimestamp();
  return embed;
}

export function buildMinimalReplyPayload(options: {
  title?: string;
  description?: string;
  color?: number;
  ephemeral?: boolean;
  footerUser?: User;
}): {
  components?: TextDisplayBuilder[];
  flags?: number;
  embeds?: EmbedBuilder[];
} {
  const useV2 = process.env.USE_COMPONENTS_V2 === 'true';

  if (useV2) {
    const blocks: TextDisplayBuilder[] = [];
    if (options.title) {
      blocks.push(new TextDisplayBuilder().setContent(`**${options.title}**`));
    }
    if (options.description) {
      blocks.push(new TextDisplayBuilder().setContent(options.description));
    }

    const flags = options.ephemeral
      ? MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
      : MessageFlags.IsComponentsV2;

    return { components: blocks, flags };
  }

  const embed = createMinimalEmbed({
    title: options.title,
    description: options.description,
    color: options.color,
    footerUser: options.footerUser,
  });

  return { embeds: [embed] };
}
