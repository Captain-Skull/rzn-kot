import { InlineKeyboard } from 'grammy';
import type { MyContext } from '../../types/context.js';
import { isAdmin } from '../../database/repo/adminRepo.js';
import { updateOrder } from '../../database/repo/orderRepo.js';
import { sendOrderNotification } from '../../services/notificationService.js';
import { bot } from '../../bot.js';
import { returnKeyboard } from '../../keyboards/common.js';

export async function handleModeration(ctx: MyContext, data: string): Promise<void> {
  const chatId = ctx.from!.id;
  if (!isAdmin(chatId)) return;

  if (data.startsWith('order-completed_')) {
    const [, userId, orderId] = data.split('_');

    try {
      await updateOrder(userId, orderId, {
        status: 'confirmed',
        confirmedAt: Date.now(),
        adminId: chatId,
      });

      await sendOrderNotification(`✅ Заказ для пользователя ${userId} выполнен.`);
      await bot.api.sendMessage(userId, '✅ Заказ выполнен!', { reply_markup: returnKeyboard() });
      await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
    } catch (error) {
      console.error('Order confirm error:', error);
    }
    return;
  }

  if (data.startsWith('order-declined_')) {
    const [, userId, orderId] = data.split('_');

    try {
      await updateOrder(userId, orderId, {
        status: 'declined',
        confirmedAt: Date.now(),
        adminId: chatId,
      });

      await sendOrderNotification(`❌ Заказ для пользователя ${userId} отменен.`);
      await bot.api.sendMessage(userId, '⛔️ Ваш заказ отклонён, причину узнайте у администратора', {
        reply_markup: returnKeyboard(),
      });
      await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
    } catch (error) {
      console.error('Order decline error:', error);
    }
  }
}
