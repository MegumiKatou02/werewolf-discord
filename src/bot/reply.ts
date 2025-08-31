import type { ButtonInteraction, CacheType, ChatInputCommandInteraction, Interaction, InteractionEditReplyOptions, InteractionReplyOptions, MessageContextMenuCommandInteraction, ModalSubmitInteraction, PrimaryEntryPointCommandInteraction, UserContextMenuCommandInteraction } from 'discord.js';

export function isInteractionValid(interaction: Interaction): boolean {
  const INTERACTION_TIMEOUT = 15 * 60 * 1000;
  const createdTimestamp = interaction.createdTimestamp;
  const now = Date.now();
  return (now - createdTimestamp) < INTERACTION_TIMEOUT;
}

export async function safeReply(
  interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction | MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction | PrimaryEntryPointCommandInteraction<CacheType>,
  options: InteractionReplyOptions,
): Promise<boolean> {
  try {
    if (!isInteractionValid(interaction)) {
      console.warn('Interaction đã hết hạn, bỏ qua reply');
      return false;
    }

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(options);
      return true;
    } else if (interaction.deferred) {
      const editOptions: InteractionEditReplyOptions = {
        content: options.content,
        embeds: options.embeds,
        components: options.components,
        files: options.files,
        allowedMentions: options.allowedMentions,
      };
      await interaction.editReply(editOptions);
      return true;
    } else {
      await interaction.followUp(options);
      return true;
    }
  } catch (error) {
    console.error('Lỗi khi reply interaction:', error);
    return false;
  }
}
