import type { MyContext, Cart } from "../types/context.js";
import type { Product } from "../types/models.js";
import { ProductCategory } from "../types/enums.js";
import { getProducts } from "../database/repo/productRepo.js";
import { IMAGES } from "../config/constants.js";
import { shopKeyboard } from "../keyboards/shop.js";

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

export function generateCartText(
  cart: Cart | undefined,
  category: ProductCategory
): string {
  if (!cart || cart.items.length === 0) {
    return `<b>➤ Выберите товар для покупки (можно несколько)\n🛒 Ваша корзина пуста</b>`;
  }

  const products = getProducts(category);

  const itemsCount = cart.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + 1;
    return acc;
  }, {});

  const itemsText = Object.entries(itemsCount)
    .map(([label, count]) => {
      const product = products.find((p) => p.label === label);
      if (!product) return `<b>➥ ${label} × ${count}</b>`;
      const total = Math.round(count * product.price * 100) / 100;
      return `<b>➥ ${label} × ${count} = ${total}$</b>`;
    })
    .join("\n");

  return `<b>➤ Выберите товар для покупки (можно несколько)\n🛒 Ваша корзина:\n\n${itemsText}\n\n✦ Итого: <u>${cart.total}$</u></b>`;
}

export async function updateCartMessage(
  ctx: MyContext,
  category: ProductCategory,
  messageId?: number
): Promise<number | undefined> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const cart = getCart(ctx);
  const caption = generateCartText(cart, category);
  const keyboard = await shopKeyboard(cart, category);

  try {
    if (messageId) {
      await ctx.api.editMessageMedia(
        chatId,
        messageId,
        {
          type: "photo",
          media: IMAGES.pack,
          caption,
          parse_mode: "HTML",
        },
        { reply_markup: keyboard }
      );
      return messageId;
    }
  } catch (editError: any) {
    if (
      editError?.description?.includes("message to edit not found")
    ) {
      return await sendNewCartMessage(ctx, chatId, caption, keyboard);
    }
  }

  return await sendNewCartMessage(ctx, chatId, caption, keyboard);
}

async function sendNewCartMessage(
  ctx: MyContext,
  chatId: number,
  caption: string,
  keyboard: any
): Promise<number | undefined> {
  try {
    const sent = await ctx.api.sendPhoto(chatId, IMAGES.pack, {
      caption,
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
    return sent.message_id;
  } catch {
    const sent = await ctx.api.sendMessage(chatId, caption, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
    return sent.message_id;
  }
}