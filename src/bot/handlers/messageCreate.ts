import { ChannelType, type Client, type Message } from 'discord.js';

import { gameRooms } from '../../../core/room.js';
import type { GameRoom } from '../../../core/room.js';
import rolesData from '../../../data/data.json' with { type: 'json' };
import type Player from '../../../types/player.js';
import { RoleResponseDMs } from '../../../utils/response.js';
import { WEREROLE, convertFactionRoles } from '../../../utils/role.js';
import commandHandler from '../../client/handlers/commandHandler.js';
import { MAX_FILE_SIZE } from '../../constants/constants.js';
import { isUserSpamming, handleSpamAction } from '../antiSpam.js';
import { getCachedUser } from '../cache.js';
import { sendSyncMessages } from '../messaging.js';

export default function registerMessageCreate(client: Client): void {
  client.on('messageCreate', async (message: Message) => {
    // Bất kể DM hay server đều dùng được
    commandHandler(message);

    if (message.channel.type === ChannelType.DM) {
      if (message.author.bot) {
        return;
      }

      const spamCheck = isUserSpamming(message.author.id);
      if (spamCheck.isSpam) {
        await handleSpamAction(message.author.id, spamCheck);
        return;
      }

      const gameRoom = Array.from(gameRooms.values()).find(
        (room: GameRoom) =>
          room.status === 'starting' &&
          room.players.some((p: Player) => p.userId === message.author.id),
      );

      if (!gameRoom) {
        return;
      }

      const sender = gameRoom.players.find(
        (p: Player) => p.userId === message.author.id,
      );
      if (!sender) {
        return;
      }

      if (message.content === '!role' && sender.alive) {
        const roleId = sender.role?.id;

        if (roleId === null || roleId === undefined) {
          return;
        }

        const user = await getCachedUser(sender.userId);
        if (!user) {
          return;
        }

        const roleKey = roleId.toString() as keyof typeof rolesData;
        return await RoleResponseDMs(
          user,
          `${rolesData[roleKey].eName.toLowerCase().replace(/\s+/g, '_')}.png`,
          roleId,
          convertFactionRoles(rolesData[roleKey].faction),
        );
      }

      if (gameRoom.gameState.phase === 'night') {
        if (sender.role?.id === WEREROLE.WOLFSEER) {
          try {
            const user = await getCachedUser(sender.userId);
            if (user) {
              await user.send('_⚠️ Những sói khác sẽ không thấy bạn nhắn gì_');
            }
          } catch (err) {
            console.error('Không gửi được tin nhắn cho Sói khác', err);
          }
        }

        if (
          sender.role?.faction === 0 &&
          sender.role?.id !== WEREROLE.WOLFSEER &&
          sender.alive
        ) {
          const wolves = gameRoom.players.filter(
            (p: Player) =>
              p.role?.faction === 0 && p.alive && p.userId !== sender.userId,
          );

          await sendSyncMessages(wolves, `🐺 **${sender.name}**: ${message.content}`, () => `🐺 **${sender.name}**: ${message.content}`);
        }

        if (sender.role?.id === WEREROLE.MEDIUM || sender.alive === false) {
          const playersDead = gameRoom.players.filter((p: Player) => {
            return (
              p.userId !== sender.userId &&
              (p.alive === false || p.role?.id === WEREROLE.MEDIUM)
            );
          });

          await sendSyncMessages(playersDead, message.content, (_player: Player, content: string) => {
            if (sender.role?.id === WEREROLE.MEDIUM && sender.alive) {
              return `_🔮 **Thầy Đồng**: ${content}_`;
            } else {
              return `_💀 **${sender.name}**: ${content}_`;
            }
          });
        }
      }

      if (
        gameRoom.gameState.phase === 'day' ||
        gameRoom.gameState.phase === 'voting'
      ) {
        const playersInGame = gameRoom.players.filter(
          (p: Player) => p.userId !== sender.userId,
        );

        const eligiblePlayers = playersInGame.filter((player: Player) => {
          if (!sender.alive) {
            return !player.alive;
          }
          return true;
        });

        if (sender.alive && !sender.canChat) {
          const user = await gameRoom.fetchUser(sender.userId);
          if (user) {
            await user.send('⚠️ Bạn không thể chat trong hôm nay');
          }
          return;
        }

        if (eligiblePlayers.length > 0) {
          await sendSyncMessages(eligiblePlayers, message.content, (_player: Player, content: string) => {
            const validAttachments = Array.from(
              message.attachments.values(),
            ).filter((attachment) => attachment.size <= MAX_FILE_SIZE);

            if (!sender.alive) {
              return `_💀 **${sender.name}**: ${content}_`;
            } else if (sender.userId === process.env.DEVELOPER) {
              return {
                content: `🔧 **${sender.name}**: ${content}`,
                files: validAttachments,
              };
            } else {
              return {
                content: `🗣️ **${sender.name}**: ${content}`,
                files: validAttachments,
              };
            }
          });
        }
      }
    }
  });
}
