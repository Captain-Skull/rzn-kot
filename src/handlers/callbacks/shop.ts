import type { MyContext } from '../../types/context.js';
import { ProductCategory } from '../../types/enums.js';
import { getProducts } from '../../database/repo/productRepo.js';
import { addToCart, clearCart, removeFromCart, updateCartMessage } from '../../services/cartService.js';
import { purchaseCodes, initPurchaseSignin, initPurchasePrime } from '../../services/purchaseService.js';

export async function handleShop(ctx: MyContext, data: string): Promise<void> {
  const messageId = ctx.msg!.message_id;

  if (data.startsWith('cart_')) {
    const parts = data.split('_');
    const action = parts[1];

    switch (action) {
      case 'clear': {
        const type = parts[2] as ProductCategory;
        clearCart(ctx);
        await updateCartMessage(ctx, type, messageId);
        break;
      }
      case 'buy-signin':
        await initPurchaseSignin(ctx);
        break;
      case 'buy-codes':
        await purchaseCodes(ctx);
        break;
      case 'add': {
        const type = parts[2] as ProductCategory;
        const label = parts[3];
        const products = getProducts(type);
        const product = products.find(p => p.label === label);
        if (product) {
          addToCart(ctx, product);
          await updateCartMessage(ctx, type, messageId);
        }
        break;
      }
      case 'remove': {
        const type = parts[2] as ProductCategory;
        const label = parts[3];
        const products = getProducts(type);
        const product = products.find(p => p.label === label);
        if (product) {
          removeFromCart(ctx, product);
          await updateCartMessage(ctx, type, messageId);
        }
        break;
      }
    }
    return;
  }

  if (data.startsWith('buy-prime_')) {
    const [, label] = data.split('_');
    await initPurchasePrime(ctx, label);
  }
}
