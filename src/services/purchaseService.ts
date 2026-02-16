import { InlineKeyboard } from 'grammy';
import type { MyContext } from '../types/context.js';
import { UserState, ProductCategory } from '../types/enums.js';
import { getAvailableCodes, markCodesAsUsed, countAvailableCodes } from '../database/repo/codeRepo.js';
import { getProducts } from '../database/repo/productRepo.js';
import { saveOrder } from '../database/repo/orderRepo.js';
import { sendOrderNotification } from './notificationService.js';
import { createPayment, type PaymentItem } from './paymentService.js';
import { clearCart, addToCart } from './cartService.js';
import { resetState, getUserTag, generateOrderNumber } from '../utils/helpers.js';
import { formatCodesMessage } from '../utils/formatters.js';
import { mainMessageKeyboard } from '../keyboards/common.js';
import { orderModerationKeyboard } from '../keyboards/admin.js';

export async function purchaseCodes(ctx: MyContext): Promise<void> {
  const chatId = ctx.chat!.id;
  const messageId = ctx.msg?.message_id;
  const cart = ctx.session.cart;
  const firstName = ctx.from?.first_name || '';
  const lastName = ctx.from?.last_name || '';
  const username = ctx.from?.username;

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

  const paymentItems: PaymentItem[] = Object.entries(requiredCodes).map(([label, count]) => {
    const product = getProducts(ProductCategory.CODES).find(p => p.label === label);
    return {
      name: `UC ${label}`,
      quantity: count,
      price: product?.price || 0,
    };
  });

  await ctx.api.sendMessage(chatId, '⏳ Обработка оплаты...');

  const payment = await createPayment(chatId, cart.total, 'Покупка UC кодов', paymentItems);

  if (!payment.success) {
    await ctx.api.sendMessage(chatId, '❌ Ошибка оплаты. Попробуйте позже.', {
      reply_markup: mainMessageKeyboard(),
    });
    return;
  }

  const codesToSend: Record<string, string[]> = {};
  for (const [label, count] of Object.entries(requiredCodes)) {
    const codes = await getAvailableCodes(label, count);
    const codeKeys = Object.keys(codes);
    codesToSend[label] = codeKeys.map(key => codes[key].code);
    await markCodesAsUsed(label, codeKeys);
  }

  const orderNumber = generateOrderNumber(chatId);
  await saveOrder(chatId, orderNumber, {
    orderId: orderNumber,
    userId: chatId,
    type: 'codes',
    codes: codesToSend,
    items: cart.items,
    total: cart.total,
    status: 'confirmed',
    paymentId: payment.paymentId,
    timestamp: Date.now(),
    userInfo: { username: `${firstName} ${lastName}`.trim() },
  });

  const codesMessage = formatCodesMessage(codesToSend);

  await ctx.api.sendMessage(chatId, `✅ Оплата прошла! Ваши коды:\n\n${codesMessage}`, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard()
      .url('📖 Инструкция', 'https://t.me/instructionrznkot/3')
      .row()
      .text('🏚 Главное меню', 'main-message'),
  });

  if (messageId) {
    try {
      await ctx.api.deleteMessage(chatId, messageId);
    } catch (error) {
      console.log(error);
    }
  }

  const availableUsername = username ? ` / @${username}` : '';
  await sendOrderNotification(
    `✅ Заказ кодами #${orderNumber} (оплачен)\n` +
      `Пользователь: ${firstName} ${lastName} (ID: ${chatId}${availableUsername})\n` +
      `Коды:\n\n${codesMessage}` +
      `Сумма: ${cart.total}₽\n` +
      `Payment: ${payment.paymentId}`,
  );

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
    caption: '✦ Отправьте игровой ник для формирования заявки!',
    reply_markup: new InlineKeyboard().text('🔙 В меню', 'return'),
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

  await ctx.reply('✅ Заявка отправлена! Ожидайте выполнения заказа.', {
    reply_markup: mainMessageKeyboard(),
  });

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
    caption: `✦ Отправьте ID аккаунта на который хотите получить Прайм+ (${label})`,
    reply_markup: new InlineKeyboard().text('🔙 В меню', 'return'),
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

  await ctx.reply('Отправьте игровой ник для формирования заявки!', {
    reply_markup: new InlineKeyboard().text('🔙 Назад', 'return'),
  });
}

export async function handlePrimeNickname(ctx: MyContext): Promise<void> {
  const chatId = ctx.chat!.id;
  const nickname = ctx.msg?.text;
  if (!nickname) return;

  const state = ctx.session.state;
  const cart = ctx.session.cart;
  const pubgId = state.pubgId || '';
  const userTag = getUserTag(ctx);

  if (!cart || cart.items.length === 0) {
    await ctx.reply('❌ Ошибка: товар не выбран!');
    return;
  }

  const paymentItems: PaymentItem[] = cart.items.map(item => ({
    name: `Прайм+ ${item.label}`,
    quantity: 1,
    price: item.price,
  }));

  await ctx.reply('⏳ Обработка оплаты...');

  const payment = await createPayment(chatId, cart.total, 'Покупка Прайм+', paymentItems);

  if (!payment.success) {
    await ctx.reply('❌ Ошибка оплаты. Попробуйте позже.', {
      reply_markup: mainMessageKeyboard(),
    });
    resetState(ctx);
    return;
  }

  const products = getProducts(ProductCategory.PRIME);
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
    type: 'prime',
    nickname,
    pubgId,
    items: cart.items,
    total: cart.total,
    status: 'paid',
    paymentId: payment.paymentId,
    timestamp: Date.now(),
    userInfo: { username: userTag },
  });

  const orderText =
    `💳 Новый оплаченный заказ (Прайм+)\n🧾#${orderNumber}\n` +
    `🛍 Товары:\n${itemsText}\n💵 Оплачено: ${cart.total}₽\n` +
    `🧸 Ник: ${nickname}\n🆔: ${pubgId}\n` +
    `🪪 ${userTag} (ID: ${chatId})\n` +
    `Payment: ${payment.paymentId}\n⚠️ Выберите действие ниже`;

  await sendOrderNotification(orderText, orderModerationKeyboard(chatId, orderNumber, cart.total));

  await ctx.reply('✅ Оплата прошла! Заявка отправлена, ожидайте выполнения.', {
    reply_markup: mainMessageKeyboard(),
  });

  resetState(ctx);
}
