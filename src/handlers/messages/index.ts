import { Bot } from 'grammy';
import type { MyContext } from '../../types/context.js';
import { UserState } from '../../types/enums.js';
import { isAdmin } from '../../database/repo/adminRepo.js';
import { notifyAllAdmins } from '../../services/notificationService.js';
import { handleShopInput } from './shopInput.js';
import { handleAdminInput } from './adminInput.js';
import { bot as botInstance } from '../../bot.js';

const messageRoutes: Record<string, (ctx: MyContext) => Promise<void>> = {
  [UserState.AWAITING_SIGNIN_NICKNAME]: handleShopInput,
  [UserState.AWAITING_PRIME_ID]: handleShopInput,
  [UserState.AWAITING_PRIME_NICKNAME]: handleShopInput,
  [UserState.AWAITING_PRODUCT_PRICE]: handleAdminInput,
  [UserState.AWAITING_NEW_PRODUCT_LABEL]: handleAdminInput,
  [UserState.AWAITING_NEW_PRODUCT_PRICE]: handleAdminInput,
  [UserState.AWAITING_BROADCAST]: handleAdminInput,
  [UserState.AWAITING_ADD_ADMIN]: handleAdminInput,
  [UserState.AWAITING_REMOVE_ADMIN]: handleAdminInput,
  [UserState.AWAITING_CODES]: handleAdminInput,
  [UserState.AWAITING_CODE_TO_DELETE]: handleAdminInput,
  [UserState.AWAITING_BLOCK_USER]: handleAdminInput,
  [UserState.AWAITING_UNBLOCK_USER]: handleAdminInput,
};

export function registerMessages(bot: Bot<MyContext>): void {
  bot.on('message', async ctx => {
    try {
      const chatId = ctx.chat.id;
      const text = ctx.msg.text;

      if (text?.startsWith('/')) return;

      if (isAdmin(chatId) && ctx.msg.reply_to_message) {
        const forwardFrom = (ctx.msg.reply_to_message as any).forward_from;
        if (forwardFrom?.id && text) {
          try {
            await botInstance.api.sendMessage(forwardFrom.id, `Ответ от администратора: ${text}`);
            await notifyAllAdmins(`Ответ пользователю ${forwardFrom.id} отправлен.`);
          } catch {
            await ctx.reply('❌ Не удалось отправить сообщение');
          }
          return;
        }
      }

      const state = ctx.session.state;
      if (!state || state.type === UserState.DEFAULT) return;

      const handler = messageRoutes[state.type];
      if (handler) await handler(ctx);
    } catch (error: any) {
      if (error?.description?.includes('403')) {
        console.log('Бот заблокирован пользователем');
      } else {
        console.error('Message error:', error);
      }
    }
  });
}
