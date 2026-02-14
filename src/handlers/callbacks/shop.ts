import type { MyContext } from "../../types/context.js";
import { ProductCategory } from "../../types/enums.js";
import { getProducts } from "../../database/repo/productRepo.js";
import {
  addToCart,
  clearCart,
  updateCartMessage,
} from "../../services/cartService.js";
import {
  initPurchaseWithId,
  purchaseCodes,
} from "../../services/purchaseService.js";
import type { Product } from "../../types/models.js";

export async function handleShop(
  ctx: MyContext,
  data: string
): Promise<void> {
  const messageId = ctx.msg!.message_id;

  if (data.startsWith("add-to-cart_")) {
    const [, label, price, type] = data.split("_");
    const category = type as ProductCategory;
    const products = getProducts(category);
    const product = products.find((p: Product) => p.label === label);

    if (!product) {
      await ctx.answerCallbackQuery({ text: "Товар не найден" });
      return;
    }

    addToCart(ctx, product);
    await updateCartMessage(ctx, category, messageId);
    return;
  }

  if (data.startsWith("cart_")) {
    const [, action, type] = data.split("_");
    const category = (type || "codes") as ProductCategory;

    switch (action) {
      case "clear":
        clearCart(ctx);
        await updateCartMessage(ctx, category, messageId);
        break;
      case "buy-with-id":
        await initPurchaseWithId(ctx, category);
        break;
      case "buy-codes":
        await purchaseCodes(ctx);
        break;
    }
  }
}