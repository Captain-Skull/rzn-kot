import { InlineKeyboard } from 'grammy';
import type { PaycoreWebhookBody } from '../types/models.js';
import { getPendingPayment, deletePendingPayment } from '../database/repo/pendingPaymentRepo.js';
import { getAvailableCodes, markCodesAsUsed, countAvailableCodes } from '../database/repo/codeRepo.js';
import { saveOrder } from '../database/repo/orderRepo.js';
import { getProducts } from '../database/repo/productRepo.js';
import { ProductCategory } from '../types/enums.js';
import { sendOrderNotification } from './notificationService.js';
import { formatCodesMessage } from '../utils/formatters.js';
import { bot } from '../bot.js';
import { mainMessageKeyboard } from '../keyboards/common.js';
import { orderModerationKeyboard } from '../keyboards/admin.js';

export async function handlePaycoreWebhook(body: PaycoreWebhookBody): Promise<{ success: boolean; message: string }> {
  const { order_id, amount, final_amount, method } = body;

  console.log(`💳 Webhook: order=${order_id}, amount=${amount}, final=${final_amount}, method=${method}`);

  const pending = getPendingPayment(order_id);
  if (!pending) {
    console.warn(`⚠️ Pending payment не найден: ${order_id}`);
    return { success: false, message: 'Payment not found' };
  }

  try {
    switch (pending.type) {
      case 'codes':
        await completePurchaseCodes(pending, body);
        break;
      case 'prime':
        await completePurchasePrime(pending, body);
        break;
      default:
        console.error(`Unknown payment type: ${pending.type}`);
        return { success: false, message: 'Unknown type' };
    }

    await deletePendingPayment(order_id);

    return { success: true, message: 'OK' };
  } catch (error) {
    console.error('Webhook processing error:', error);
    return { success: false, message: 'Processing error' };
  }
}

async function completePurchaseCodes(pending: ReturnType<typeof getPendingPayment> & {}, paycoreBody: PaycoreWebhookBody): Promise<void> {
  const { userId, botOrderId, items, total, username } = pending;

  const requiredCodes = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + 1;
    return acc;
  }, {});

  for (const [label, count] of Object.entries(requiredCodes)) {
    const available = await countAvailableCodes(label);
    if (available < count) {
      await bot.api.sendMessage(userId, '⚠️ Оплата прошла, но кодов не хватает. Администратор свяжется с вами.', {
        reply_markup: mainMessageKeyboard(),
      });

      await sendOrderNotification(
        `⚠️ ПРОБЛЕМА: Заказ #${botOrderId}\n` +
          `Оплата прошла, но не хватает кодов для ${label}!\n` +
          `Пользователь: ${username} (ID: ${userId})\n` +
          `PayCore: ${paycoreBody.order_id}`,
      );
      return;
    }
  }

  const codesToSend: Record<string, string[]> = {};
  for (const [label, count] of Object.entries(requiredCodes)) {
    const codes = await getAvailableCodes(label, count);
    const codeKeys = Object.keys(codes);
    codesToSend[label] = codeKeys.map(key => codes[key].code);
    await markCodesAsUsed(label, codeKeys);
  }

  await saveOrder(userId, botOrderId, {
    orderId: botOrderId,
    userId,
    type: 'codes',
    codes: codesToSend,
    items,
    total,
    status: 'confirmed',
    paymentId: paycoreBody.order_id,
    timestamp: Date.now(),
    userInfo: { username },
  });

  const codesMessage = formatCodesMessage(codesToSend);

  await bot.api.sendMessage(userId, `✅ Оплата прошла! Ваши коды:\n\n${codesMessage}`, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard()
      .url('📖 Инструкция', 'https://t.me/instructionrznkot/3')
      .row()
      .text('🏚 Главное меню', 'main-message'),
  });

  if (pending.messageId) {
    try {
      await bot.api.deleteMessage(userId, pending.messageId);
    } catch (error) {
      console.log(error);
    }
  }

  await sendOrderNotification(
    `✅ Заказ кодами #${botOrderId} (оплачен)\n` +
      `Пользователь: ${username} (ID: ${userId})\n` +
      `Коды:\n\n${codesMessage}` +
      `Сумма: ${total}₽\n` +
      `Комиссия: ${paycoreBody.commission_amount}\n` +
      `Payment: ${paycoreBody.order_id}`,
  );
}

async function completePurchasePrime(pending: ReturnType<typeof getPendingPayment> & {}, paycoreBody: PaycoreWebhookBody): Promise<void> {
  const { userId, botOrderId, items, total, nickname, pubgId, username } = pending;

  const products = getProducts(ProductCategory.PRIME);
  const itemsDetails = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + 1;
    return acc;
  }, {});

  const itemsText = Object.entries(itemsDetails)
    .map(([label, count]) => {
      const product = products.find(p => p.label === label);
      return `➥ ${label} ×${count} = ${(product?.price || 0) * count}₽`;
    })
    .join('\n');

  await saveOrder(userId, botOrderId, {
    orderId: botOrderId,
    userId,
    type: 'prime',
    nickname,
    pubgId,
    items,
    total,
    status: 'paid',
    paymentId: paycoreBody.order_id,
    timestamp: Date.now(),
    userInfo: { username },
  });

  await bot.api.sendMessage(userId, '✅ Оплата прошла! Заявка на Прайм+ отправлена, ожидайте выполнения.', {
    reply_markup: mainMessageKeyboard(),
  });

  if (pending.messageId) {
    try {
      await bot.api.deleteMessage(userId, pending.messageId);
    } catch (error) {
      console.log(error);
    }
  }

  const orderText =
    `💳 Оплаченный заказ (Прайм+)\n🧾#${botOrderId}\n` +
    `🛍 Товары:\n${itemsText}\n💵 Оплачено: ${total}₽\n` +
    `🧸 Ник: ${nickname}\n🆔: ${pubgId}\n` +
    `🪪 ${username} (ID: ${userId})\n` +
    `Payment: ${paycoreBody.order_id}\n⚠️ Выберите действие ниже`;

  await sendOrderNotification(orderText, orderModerationKeyboard(userId, botOrderId, total));
}
