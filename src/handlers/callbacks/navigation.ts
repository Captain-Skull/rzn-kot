import type { MyContext } from '../../types/context.js';
import { ProductCategory } from '../../types/enums.js';
import { sendMainMessage } from '../../services/mainMessage.js';
import { clearCart, updateCartMessage } from '../../services/cartService.js';
import { resetState } from '../../utils/helpers.js';
import { ucCatalogKeyboard } from '../../keyboards/ucCatalog.js';

export async function handleNavigation(ctx: MyContext, data: string): Promise<void> {
  const messageId = ctx.msg!.message_id;

  if (data === 'return') {
    resetState(ctx);
    await sendMainMessage(ctx, messageId);
    return;
  }

  if (data.startsWith('open-catalog_')) {
    const productType = data.split('_')[1];
    clearCart(ctx);

    if (productType === 'uc') {
      await ctx.editMessageCaption({
        caption: 'Выберите каким способом вы хотите получить UC',
        reply_markup: ucCatalogKeyboard,
      });
    } else {
      const category = productType as ProductCategory;
      await updateCartMessage(ctx, category, messageId);
    }
  }

  if (data === 'main-message') {
    resetState(ctx);
    await sendMainMessage(ctx);
    return;
  }
}
