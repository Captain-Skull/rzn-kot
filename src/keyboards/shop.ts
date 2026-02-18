import { InlineKeyboard } from 'grammy';
import type { Cart } from '../types/context.js';
import { ProductCategory } from '../types/enums.js';
import { getProducts } from '../database/repo/productRepo.js';
import { getAllAvailableCodesCount } from '../database/repo/codeRepo.js';
import { isAdmin } from '../database/repo/adminRepo.js';

export async function shopKeyboard(cart: Cart | undefined, category: ProductCategory, userId: number): Promise<InlineKeyboard> {
  const products = getProducts(category);
  const keyboard = new InlineKeyboard();

  const counts: Record<string, number> = {};
  if (cart) {
    cart.items.forEach(item => {
      counts[item.label] = (counts[item.label] || 0) + 1;
    });
  }

  let availableCodes: Record<string, number> = {};
  if (category === ProductCategory.CODES) {
    availableCodes = await getAllAvailableCodesCount();
  }

  for (const p of products) {
    const inCart = counts[p.label] || 0;
    let text: string = '';

    if (category === ProductCategory.CODES) {
      const available = availableCodes[p.label] || 0;
      text = `${p.label} - ${p.price}₽ (${inCart}/${available})`;
    } else if (category === ProductCategory.SIGNIN) {
      text = `${p.label} - ${p.price}₽ (×${inCart})`;
    } else if (category === ProductCategory.PRIME) {
      text = `${p.label} - ${p.price}₽`;
    }

    if (inCart > 0) {
      keyboard.text(text, `cart_add_${category}_${p.label}`).text('➖ Удалить', `cart_remove_${category}_${p.label}`).row();
    } else {
      if (category === ProductCategory.PRIME) {
        keyboard.text(text, `buy-prime_${p.label}`).row();
      } else {
        keyboard.text(text, `cart_add_${category}_${p.label}`).row();
      }
    }
  }

  if (category === ProductCategory.CODES) {
    keyboard.text('Оплатить', `cart_buy-codes`).icon('5427365243548361496').row();
    if (isAdmin(userId)) {
      keyboard.text('🫳 Получить', 'receive-codes').row();
    }
  } else if (category === ProductCategory.SIGNIN) {
    keyboard.text('🛒 Оставить заявку', `cart_buy-signin`).row();
  }

  keyboard.text('🗑 Очистить корзину', `cart_clear_${category}`).row().text('🔙 В главное меню', 'return');

  return keyboard;
}
