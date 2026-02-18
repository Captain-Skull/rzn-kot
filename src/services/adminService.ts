import { isAdmin } from '../database/repo/adminRepo.js';
import { countAvailableCodes, getAvailableCodes, markCodesAsUsed } from '../database/repo/codeRepo.js';
import { saveOrder } from '../database/repo/orderRepo.js';
import { mainMessageKeyboard } from '../keyboards/common.js';
import type { MyContext } from '../types/context.js';
import { formatCodesMessage } from '../utils/formatters.js';
import { generateOrderNumber, getUserTag, resetState } from '../utils/helpers.js';
import { sendOrderNotification } from './notificationService.js';

export async function receiveCodes(ctx: MyContext): Promise<void> {
  const items = ctx.session.cart.items;
  const total = ctx.session.cart.total;
  const userId = ctx.from!.id;

  if (!isAdmin(userId)) return;

  const requiredCodes = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + 1;
    return acc;
  }, {});

  for (const [label, count] of Object.entries(requiredCodes)) {
    const available = await countAvailableCodes(label);
    if (available < count) {
      await ctx.reply('Недостаточно кодов для получения', {
        reply_markup: mainMessageKeyboard(),
      });

      return;
    }
  }

  await ctx.deleteMessage();

  const codesToSend: Record<string, string[]> = {};
  for (const [label, count] of Object.entries(requiredCodes)) {
    const codes = await getAvailableCodes(label, count);
    const codeKeys = Object.keys(codes);
    codesToSend[label] = codeKeys.map(key => codes[key].code);
    await markCodesAsUsed(label, codeKeys);
  }

  const orderNumber = generateOrderNumber(userId);
  const username = getUserTag(ctx);

  await saveOrder(userId, orderNumber, {
    orderId: orderNumber,
    userId,
    type: 'Admin codes',
    codes: codesToSend,
    items,
    total,
    status: 'confirmed',
    userInfo: {
      username,
    },
  });

  const codesMessage = formatCodesMessage(codesToSend);

  await ctx.reply(`Ваши коды:\n\n${codesMessage}`, {
    parse_mode: 'HTML',
    reply_markup: mainMessageKeyboard(),
  });

  await sendOrderNotification(
    `Получение кодов администратором\n` + `Пользователь: ${username} (ID: ${userId})\n` + `Коды:\n\n${codesMessage}` + `Сумма: ${total}₽\n`,
  );

  resetState(ctx);
}
