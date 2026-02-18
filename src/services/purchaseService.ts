import { InlineKeyboard } from 'grammy';
import type { MyContext } from '../types/context.js';
import { UserState, ProductCategory } from '../types/enums.js';
import { countAvailableCodes } from '../database/repo/codeRepo.js';
import { getProducts } from '../database/repo/productRepo.js';
import { savePendingPayment } from '../database/repo/pendingPaymentRepo.js';
import { saveOrder } from '../database/repo/orderRepo.js';
import { sendOrderNotification } from './notificationService.js';
import { createPayment } from './paymentService.js';
import { clearCart, addToCart } from './cartService.js';
import { resetState, getUserTag, generateOrderNumber } from '../utils/helpers.js';
import { mainMessageKeyboard, returnKeyboard } from '../keyboards/common.js';
import { orderModerationKeyboard } from '../keyboards/admin.js';

export async function purchaseCodes(ctx: MyContext): Promise<void> {
  const chatId = ctx.chat!.id;
  const messageId = ctx.msg?.message_id;
  const cart = ctx.session.cart;
  const firstName = ctx.from?.first_name || '';
  const lastName = ctx.from?.last_name || '';

  if (!cart || cart.items.length === 0) {
    await ctx.api.sendMessage(chatId, '❌ Корзина пуста!');
    return;
  }

  const requiredCodes = cart.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + 1;
    return acc;
  }, {});

  for (const [label, count] of Object.entries(requiredCodes)) {
    const available = await countAvailableCodes(label);
    if (available < count) {
      await ctx.api.sendMessage(chatId, '❌ Недостаточно кодов для выполнения заказа');
      return;
    }
  }

  const itemsCount = cart.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + 1;
    return acc;
  }, {});

  const description = Object.entries(itemsCount)
    .map(([label, count]) => `UC ${label} x${count}`)
    .join(', ');

  const payment = await createPayment(cart.total, `UC коды: ${description}`);

  if (!payment.success || !payment.paymentUrl || !payment.orderId) {
    await ctx.api.sendMessage(chatId, `❌ Ошибка создания платежа: ${payment.error || 'попробуйте позже'}`, {
      reply_markup: mainMessageKeyboard(),
    });
    return;
  }

  const botOrderId = generateOrderNumber(chatId);

  const paymentMessage = await ctx.api.sendMessage(
    chatId,
    `💳 Заказ #${botOrderId}\n` +
      `Сумма: ${cart.total}₽\n\n` +
      `Нажмите кнопку ниже для оплаты.\n` +
      `После оплаты коды придут автоматически.`,
    {
      reply_markup: new InlineKeyboard().url('Оплатить', payment.paymentUrl).icon('5427365243548361496').row().text('❌ Отмена', 'return'),
    },
  );

  await savePendingPayment({
    paycoreOrderId: payment.orderId,
    botOrderId,
    userId: chatId,
    type: 'codes',
    items: [...cart.items],
    total: cart.total,
    username: `${firstName} ${lastName}`.trim(),
    messageId: paymentMessage.message_id,
    createdAt: Date.now(),
  });

  if (messageId) {
    try {
      await ctx.api.deleteMessage(chatId, messageId);
    } catch (error) {
      console.log(error);
    }
  }

  resetState(ctx);
}

export async function initPurchaseSignin(ctx: MyContext): Promise<void> {
  const chatId = ctx.chat!.id;
  const cart = ctx.session.cart;

  if (!cart || cart.items.length === 0) {
    await ctx.api.sendMessage(chatId, '❌ Корзина пуста!');
    return;
  }

  ctx.session.state = {
    type: UserState.AWAITING_SIGNIN_NICKNAME,
    category: ProductCategory.SIGNIN,
  };

  await ctx.editMessageCaption({
    caption: '✦ Отправьте <b>игровой ник</b> для формирования заявки!',
    reply_markup: returnKeyboard(),
    parse_mode: 'HTML',
  });
}

export async function handleSigninNickname(ctx: MyContext): Promise<void> {
  const chatId = ctx.chat!.id;
  const nickname = ctx.msg?.text;
  if (!nickname) return;

  const cart = ctx.session.cart;
  const userTag = getUserTag(ctx);

  if (!cart || cart.items.length === 0) {
    await ctx.reply('❌ Корзина пуста!');
    return;
  }

  const products = getProducts(ProductCategory.SIGNIN);
  const itemsDetails = cart.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + 1;
    return acc;
  }, {});

  const itemsText = Object.entries(itemsDetails)
    .map(([label, count]) => {
      const product = products.find(p => p.label === label);
      return `➥ ${label} ×${count} = ${(product?.price || 0) * count}₽`;
    })
    .join('\n');

  const orderNumber = generateOrderNumber(chatId);
  await saveOrder(chatId, orderNumber, {
    orderId: orderNumber,
    userId: chatId,
    type: 'signin',
    nickname,
    items: cart.items,
    total: cart.total,
    status: 'pending',
    timestamp: Date.now(),
    userInfo: { username: userTag },
  });

  const orderText =
    `📋 Новая заявка (по входу)\n🧾#${orderNumber}\n` +
    `🛍 Товары:\n${itemsText}\n💵 Стоимость: ${cart.total}₽\n` +
    `🧸 Ник: ${nickname}\n` +
    `🪪 ${userTag} (ID: ${chatId})\n⚠️ Выберите действие ниже`;

  await sendOrderNotification(orderText, orderModerationKeyboard(chatId, orderNumber, cart.total));

  await ctx.reply('✅ Заявка отправлена! Ожидайте выполнения заказа.', { reply_markup: mainMessageKeyboard() });

  resetState(ctx);
}

export async function initPurchasePrime(ctx: MyContext, label: string): Promise<void> {
  clearCart(ctx);
  const products = getProducts(ProductCategory.PRIME);
  const product = products.find(p => p.label === label);
  if (product) {
    addToCart(ctx, product);
  }

  ctx.session.state = {
    type: UserState.AWAITING_PRIME_ID,
    category: ProductCategory.PRIME,
  };

  await ctx.editMessageCaption({
    caption: `✦ Отправьте <b>ID аккаунта</b> для получения Прайм+ (${label})`,
    reply_markup: returnKeyboard(),
    parse_mode: 'HTML',
  });
}

export async function handlePrimeIdInput(ctx: MyContext): Promise<void> {
  const pubgId = ctx.msg?.text;
  if (!pubgId) return;

  ctx.session.state = {
    type: UserState.AWAITING_PRIME_NICKNAME,
    category: ProductCategory.PRIME,
    pubgId,
  };

  await ctx.reply('Отправьте <b>игровой ник</b> для формирования заявки!', {
    reply_markup: returnKeyboard(),
    parse_mode: 'HTML',
  });
}

export async function handlePrimeNickname(ctx: MyContext): Promise<void> {
  const chatId = ctx.chat!.id;
  const nickname = ctx.msg?.text;
  if (!nickname) return;

  const state = ctx.session.state;
  const cart = ctx.session.cart;
  const pubgId = state.pubgId || '';
  const firstName = ctx.from?.first_name || '';
  const lastName = ctx.from?.last_name || '';

  if (!cart || cart.items.length === 0) {
    await ctx.reply('❌ Ошибка: товар не выбран!');
    return;
  }

  const description = cart.items.map(item => `Прайм+ ${item.label}`).join(', ');

  const payment = await createPayment(cart.total, description);

  if (!payment.success || !payment.paymentUrl || !payment.orderId) {
    await ctx.reply(`❌ Ошибка создания платежа: ${payment.error || 'попробуйте позже'}`, { reply_markup: mainMessageKeyboard() });
    resetState(ctx);
    return;
  }

  const botOrderId = generateOrderNumber(chatId);

  const paymentMessage = await ctx.reply(
    `💳 Заказ #${botOrderId}\n` +
      `Прайм+: ${cart.items.map(i => i.label).join(', ')}\n` +
      `Сумма: ${cart.total}₽\n\n` +
      `Нажмите кнопку ниже для оплаты.\n` +
      `После оплаты заявка будет отправлена автоматически.`,
    {
      reply_markup: new InlineKeyboard().url('💳 Оплатить', payment.paymentUrl).row().text('❌ Отмена', 'return'),
    },
  );

  await savePendingPayment({
    paycoreOrderId: payment.orderId,
    botOrderId,
    userId: chatId,
    type: 'prime',
    items: [...cart.items],
    total: cart.total,
    nickname,
    pubgId,
    username: `${firstName} ${lastName}`.trim(),
    messageId: paymentMessage.message_id,
    createdAt: Date.now(),
  });

  resetState(ctx);
}
