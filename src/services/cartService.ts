import type { MyContext, Cart } from '../types/context.js';
import type { Product } from '../types/models.js';
import { ProductCategory } from '../types/enums.js';
import { getProducts } from '../database/repo/productRepo.js';
import { IMAGES } from '../config/constants.js';
import { shopKeyboard } from '../keyboards/shop.js';

export function getCart(ctx: MyContext): Cart {
  if (!ctx.session.cart) {
    ctx.session.cart = { items: [], total: 0 };
  }
  return ctx.session.cart;
}

export function clearCart(ctx: MyContext): void {
  ctx.session.cart = { items: [], total: 0 };
}

export function addToCart(ctx: MyContext, product: Product): void {
  const cart = getCart(ctx);
  cart.items.push(product);
  cart.total = Math.round((cart.total + product.price) * 100) / 100;
}

export function removeFromCart(ctx: MyContext, product: Product): void {
  const cart = getCart(ctx);

  const index = cart.items.findIndex(item => item.label === product.label);

  if (index === -1) return;

  const removed = cart.items[index];
  cart.items.splice(index, 1);

  cart.total = Math.round((cart.total - removed.price) * 100) / 100;

  if (cart.total < 0) cart.total = 0;
}

export function generateCartText(cart: Cart | undefined, category: ProductCategory): string {
  if (category === ProductCategory.PRIME) {
    return `<b>➤ Выберите длительность Прайм+</b>`;
  }

  if (!cart || cart.items.length === 0) {
    return `<b>➤ Выберите UC для покупки (можно несколько)\n🛒 Ваша корзина пуста</b>`;
  }

  const products = getProducts(category);
  const itemsCount = cart.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + 1;
    return acc;
  }, {});

  const itemsText = Object.entries(itemsCount)
    .map(([label, count]) => {
      const product = products.find(p => p.label === label);
      if (!product) return `<b>➥ ${label} × ${count}</b>`;
      const total = Math.round(count * product.price * 100) / 100;
      return `<b>➥ ${label} × ${count} = ${total}₽</b>`;
    })
    .join('\n');

  return `<tg-emoji emoji-id="5206182661256668709"></tg-emoji> <b>➤ Выберите UC для покупки (можно несколько)\n🛒 Ваша корзина:\n\n${itemsText}\n\n✦ Итого: <u>${cart.total}₽</u></b>`;
}

export async function updateCartMessage(ctx: MyContext, category: ProductCategory, messageId?: number): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const cart = getCart(ctx);
  const caption = generateCartText(cart, category);
  const keyboard = await shopKeyboard(cart, category, chatId);

  try {
    if (messageId) {
      await ctx.api.editMessageCaption(chatId, messageId, {
        caption,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      return;
    }
  } catch (error: any) {
    if (error?.description?.includes('message is not modified')) return;
  }

  try {
    await ctx.api.sendPhoto(chatId, IMAGES.welcome, {
      caption,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch {
    await ctx.api.sendMessage(chatId, caption, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }
}
