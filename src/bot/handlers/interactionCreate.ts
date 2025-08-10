import type { Client, Interaction } from 'discord.js';
import { MessageFlags } from 'discord.js';

import { gameRooms } from '../../../core/room.js';
import type { GameRoom } from '../../../core/room.js';
import { store } from '../../../core/store.js';
import alphawerewolfInteraction from '../../client/events/interactions/alphawerewolfInteraction.js';
import bodyguardInteraction from '../../client/events/interactions/bodyguardInteraction.js';
import customizeRolesJson from '../../client/events/interactions/customizeRolesJson.js';
import customizeRolesName from '../../client/events/interactions/customizeRolesName.js';
import defaultRoles from '../../client/events/interactions/defaultRoles.js';
import detectiveInteraction from '../../client/events/interactions/detectiveInteraction.js';
import foxSpiritInteraction from '../../client/events/interactions/foxSpiritInteraction.js';
import gunnerInteraction from '../../client/events/interactions/gunnerInteraction.js';
import loudmouthInteraction from '../../client/events/interactions/loudmouthInteraction.js';
import maidInteraction from '../../client/events/interactions/maidInteraction.js';
import mediumInteraction from '../../client/events/interactions/mediumInteraction.js';
import puppeteerInteraction from '../../client/events/interactions/puppeteerInteraction.js';
import seerInteraction from '../../client/events/interactions/seerInteraction.js';
import settingsModel from '../../client/events/interactions/settings.js';
import stalkerInteraction from '../../client/events/interactions/stalkerInteraction.js';
import voodooInteraction from '../../client/events/interactions/voodooInteraction.js';
import votingInteraction from '../../client/events/interactions/votingInteraction.js';
import witchInteraction from '../../client/events/interactions/witchInteraction.js';
import wolffluenceInteraction from '../../client/events/interactions/wolffluenceInteraction.js';
import wolfInteraction from '../../client/events/interactions/wolfInteraction.js';
import wolfSeerInteraction from '../../client/events/interactions/wolfSeerInteraction.js';
import { safeReply } from '../reply.js';

export default function registerInteractionCreate(client: Client): void {
  client.on('interactionCreate', async (interaction: Interaction) => {
    if (interaction.isButton()) {
      try {
        const guildId = interaction.guild?.id || store.get(interaction.user.id);

        if (!guildId) {
          return interaction.reply({
            content: 'Không tìm thấy guild liên kết với người dùng này.',
            flags: MessageFlags.Ephemeral,
          });
        }

        const gameRoom: GameRoom | undefined = gameRooms.get(guildId);

        if (interaction.customId === 'edit_settings') {
          await settingsModel.handleButtonClick(interaction);
          return;
        }

        if (!gameRoom) {
          return interaction.reply({
            content: 'Không tìm thấy phòng chơi ma sói trong server này.',
            flags: MessageFlags.Ephemeral,
          });
        }

        if (interaction.customId === 'use_default_roles') {
          await defaultRoles.isButton(interaction, gameRooms);
        }
        if (interaction.customId === 'customize_roles_json') {
          await customizeRolesJson.isButton(interaction);
        }
        if (interaction.customId === 'customize_roles_name') {
          await customizeRolesName.isButton(interaction);
        }
        if (interaction.customId.startsWith('vote_target_wolf_')) {
          await wolfInteraction.isButton(interaction);
        }
        if (interaction.customId.startsWith('view_target_wolfseer_')) {
          await wolfSeerInteraction.isButton(interaction);
        }
        if (interaction.customId.startsWith('mask_target_alphawerewolf_')) {
          await alphawerewolfInteraction.isButton(interaction);
        }
        if (interaction.customId.startsWith('protect_target_bodyguard_')) {
          await bodyguardInteraction.isButton(interaction);
        }
        if (interaction.customId.startsWith('view_target_seer_')) {
          await seerInteraction.isButton(interaction);
        }
        if (interaction.customId.startsWith('investigate_target_detective_')) {
          await detectiveInteraction.isButton(interaction);
        }
        if (interaction.customId.startsWith('poison_target_witch_')) {
          await witchInteraction.isButtonPoison(interaction, gameRoom);
        }
        if (interaction.customId.startsWith('heal_target_witch_')) {
          await witchInteraction.isButtonHeal(interaction, gameRoom);
        }
        if (interaction.customId.startsWith('vote_hanged_')) {
          await votingInteraction.isButtonVoteHanged(interaction);
        }
        if (interaction.customId.startsWith('revive_target_medium_')) {
          await mediumInteraction.isButton(interaction);
        }
        if (interaction.customId.startsWith('choose_master_maid_')) {
          await maidInteraction.isButton(interaction);
        }
        if (interaction.customId.startsWith('view_target_foxspirit_')) {
          await foxSpiritInteraction.isButton(interaction, gameRoom);
        }
        if (interaction.customId.startsWith('stalk_target_stalker_')) {
          await stalkerInteraction.isButtonStalker(interaction, gameRoom);
        }
        if (interaction.customId.startsWith('kill_target_stalker_')) {
          await stalkerInteraction.isButtonKill(interaction, gameRoom);
        }
        if (interaction.customId.startsWith('gunner_shoot_')) {
          await gunnerInteraction.isButtonGunner(interaction);
        }
        if (interaction.customId.startsWith('puppet_target_puppeteer_')) {
          await puppeteerInteraction.isButton(interaction);
        }
        if (interaction.customId.startsWith('voodoo_silent_')) {
          await voodooInteraction.isButtonSilent(interaction);
        }
        if (interaction.customId.startsWith('voodoo_voodoo_')) {
          await voodooInteraction.isButtonVoodoo(interaction);
        }
        if (interaction.customId.startsWith('influence_target_wolffluence_')) {
          await wolffluenceInteraction.isButton(interaction);
        }
        if (interaction.customId.startsWith('target_loudmouth_player_')) {
          await loudmouthInteraction.isButton(interaction);
        }

      } catch (error) {
        console.error('Lỗi xử lý button interaction:', error);
        console.error('Modal customId:', interaction.customId);
        console.error('User:', interaction.user?.tag);
        console.error('Guild:', interaction.guild?.name);

        await safeReply(interaction, {
          content: 'Có lỗi xảy ra khi xử lý button!',
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    if (interaction.isModalSubmit()) {
      try {
        const guildId = interaction.guild?.id || store.get(interaction.user.id);

        if (!guildId) {
          return interaction.reply({
            content: 'Không tìm thấy guild liên kết với người dùng này.',
            flags: MessageFlags.Ephemeral,
          });
        }

        const gameRoom: GameRoom | undefined = gameRooms.get(guildId);

        if (interaction.customId === 'settings_modal') {
          await settingsModel.isModalSubmit(interaction);
          return;
        }

        if (!gameRoom) {
          return interaction.reply({
            content: 'Không tìm thấy phòng chơi ma sói trong server này.',
            flags: MessageFlags.Ephemeral,
          });
        }

        const sender = gameRoom.players.find(
          (p) => p.userId === interaction.user.id,
        );
        if (!sender) {
          return;
        }

        if (interaction.customId.startsWith('submit_vote_wolf_')) {
          await wolfInteraction.isModalSubmit(
            interaction,
            gameRoom,
            sender,
          );
        }
        if (interaction.customId.startsWith('submit_view_wolfseer_')) {
          await wolfSeerInteraction.isModalSubmit(
            interaction,
            gameRoom,
            sender,
          );
        }
        if (interaction.customId.startsWith('submit_mask_alphawerewolf_')) {
          await alphawerewolfInteraction.isModalSubmit(
            interaction,
            gameRoom,
            sender,
          );
        }
        if (interaction.customId.startsWith('submit_protect_bodyguard_')) {
          await bodyguardInteraction.isModalSubmit(
            interaction,
            gameRoom,
            sender,
          );
        }
        if (interaction.customId.startsWith('submit_view_seer_')) {
          await seerInteraction.isModalSubmit(
            interaction,
            gameRoom,
            sender,
          );
        }
        if (interaction.customId.startsWith('submit_investigate_detective_')) {
          await detectiveInteraction.isModalSubmit(
            interaction,
            gameRoom,
            sender,
          );
        }
        if (interaction.customId.startsWith('submit_poison_witch_')) {
          await witchInteraction.isModalSubmitPoison(
            interaction,
            gameRoom,
            sender,
          );
        }
        if (interaction.customId.startsWith('submit_heal_witch_')) {
          await witchInteraction.isModalSubmitHeal(
            interaction,
            gameRoom,
            sender,
          );
        }
        if (interaction.customId.startsWith('submit_vote_hanged_')) {
          await votingInteraction.isModalSubmitVoteHanged(
            interaction,
            gameRoom,
            sender,
          );
        }
        if (interaction.customId.startsWith('submit_revive_medium_')) {
          await mediumInteraction.isModalSubmit(
            interaction,
            gameRoom,
            sender,
          );
        }
        if (interaction.customId.startsWith('submit_choose_master_maid_')) {
          await maidInteraction.isModalSubmit(
            interaction,
            gameRoom,
            sender,
          );
        }
        if (interaction.customId === 'customize_roles_json_modal') {
          await customizeRolesJson.isModalSubmit(interaction, gameRooms);
        }
        if (interaction.customId === 'customize_roles_name_modal') {
          await customizeRolesName.isModalSubmit(interaction, gameRooms);
        }
        if (interaction.customId.startsWith('submit_view_foxspirit_')) {
          await foxSpiritInteraction.isModalSubmit(
            interaction,
            gameRoom,
            sender,
          );
        }
        if (interaction.customId.startsWith('submit_stalk_stalker_')) {
          await stalkerInteraction.isModalSubmitStalker(
            interaction,
            gameRoom,
            sender,
          );
        }
        if (interaction.customId.startsWith('submit_kill_stalker_')) {
          await stalkerInteraction.isModalSubmitKill(
            interaction,
            gameRoom,
            sender,
          );
        }
        if (interaction.customId.startsWith('submit_gunner_shoot_')) {
          await gunnerInteraction.isModalSubmitGunner(
            interaction,
            gameRoom,
            sender,
          );
        }
        if (interaction.customId.startsWith('submit_puppeteer_')) {
          await puppeteerInteraction.isModalSubmit(interaction, gameRoom, sender);
        }
        if (interaction.customId.startsWith('submit_voodoo_silent_')) {
          await voodooInteraction.isModalSubmitSilent(interaction, gameRoom, sender);
        }
        if (interaction.customId.startsWith('submit_voodoo_voodoo_')) {
          await voodooInteraction.isModalSubmitVoodoo(interaction, gameRoom, sender);
        }
        if (interaction.customId.startsWith('submit_ffluence_wolf_')) {
          await wolffluenceInteraction.isModalSubmit(interaction, gameRoom, sender);
        }
        if (interaction.customId.startsWith('submit_choose_loudmouth_player_')) {
          await loudmouthInteraction.isModalSubmit(interaction, gameRoom, sender);
        }
      } catch (error) {
        console.error('Lỗi xử lý modal interaction:', error);
        console.error('Modal customId:', interaction.customId);
        console.error('User:', interaction.user?.tag);
        console.error('Guild:', interaction.guild?.name);

        if (interaction.isRepliable()) {
          await safeReply(interaction, {
            content: 'Có lỗi xảy ra khi xử lý modal!',
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    }

    if (!interaction.isCommand()) {
      return;
    }

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      return await interaction.reply({
        content: 'Lệnh không tồn tại!',
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error('Lỗi thực thi command:', error);
      console.error('Command name:', interaction.commandName);
      console.error('User:', interaction.user?.tag);
      console.error('Guild:', interaction.guild?.name);

      await safeReply(interaction, {
        content: 'Có lỗi xảy ra khi thực thi lệnh!',
        flags: MessageFlags.Ephemeral,
      });
    }
  });
}
