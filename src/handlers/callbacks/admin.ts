import { InlineKeyboard } from "grammy";
import type { MyContext } from "../../types/context.js";
import { UserState, ProductCategory } from "../../types/enums.js";
import { getBalance } from "../../database/repo/userRepo.js";
import { getProducts, deleteProduct } from "../../database/repo/productRepo.js";
import { isAdmin } from "../../database/repo/adminRepo.js";
import { IMAGES } from "../../config/constants.js";
import { resetState } from "../../utils/helpers.js";
import {
  adminPanelKeyboard,
  categoryManagementKeyboard,
  productsManagementKeyboard,
  deleteProductListKeyboard,
  codesProductsKeyboard,
  paymentMethodsEditKeyboard,
  adminsManagementKeyboard,
} from "../../keyboards/admin.js";
import { cancelAdminKeyboard, cancelReturnKeyboard } from "../../keyboards/common.js";
import { sendUnusedCodes } from "../../database/repo/codeRepo.js";
import { sendMainMessage } from "../../services/mainMessage.js";

export async function handleAdmin(
  ctx: MyContext,
  data: string
): Promise<void> {
  const chatId = ctx.chat!.id;
  const messageId = ctx.msg!.message_id;

  if (!isAdmin(chatId)) {
    await ctx.answerCallbackQuery({ text: "❌ Доступ запрещен!" });
    return;
  }

  if (data === "admin-panel") {
    resetState(ctx);

    await ctx.api.editMessageMedia(
      chatId,
      messageId,
      {
        type: "photo",
        media: IMAGES.welcome,
        caption:
          `🙋‍♂ Добрый день, ${ctx.chat?.first_name || ""}!\n` +
          `💰 Ваш текущий баланс - ${getBalance(chatId)}$.`,
      },
      { reply_markup: adminPanelKeyboard() }
    );
    return;
  }

  if (data === "manage-category") {
    await ctx.editMessageCaption({
      caption: "🛠 Выберите категорию товаров для изменения",
      reply_markup: categoryManagementKeyboard(),
    });
    return;
  }

  if (data.startsWith("manage-products_")) {
    const type = data.split("_")[1];

    await ctx.editMessageCaption({
      caption: `🛠 Управление товарами (Категория: ${type}):`,
      reply_markup: productsManagementKeyboard(type),
    });
    return;
  }

  if (data === "edit-payment-details") {
    await ctx.editMessageCaption({
      caption: "Выберите способ оплаты для редактирования:",
      reply_markup: paymentMethodsEditKeyboard(),
    });
    return;
  }

  if (data.startsWith("select-payment-method_")) {
    const method = data.split("_")[1];
    ctx.session.state = {
      type: UserState.AWAITING_CREDENTIALS,
      paymentMethod: method,
    };

    await ctx.editMessageCaption({
      caption: `Введите новые реквизиты для ${method}:`,
      reply_markup: cancelAdminKeyboard,
    });
    return;
  }

  if (data === "manage-balances") {
    ctx.session.state = { type: UserState.AWAITING_USER_FOR_BALANCE };

    await ctx.editMessageCaption({
      caption: "Введите ID пользователя, чей баланс вы хотите изменить:",
      reply_markup: cancelAdminKeyboard,
    });
    return;
  }

  if (data.startsWith("add-product_")) {
    const type = data.split("_")[1];
    ctx.session.state = {
      type: UserState.AWAITING_NEW_PRODUCT_LABEL,
      productType: type as ProductCategory,
    };

    await ctx.editMessageCaption({
      caption: "Введите название нового товара:",
      reply_markup: cancelAdminKeyboard,
    });
    return;
  }

  if (data.startsWith("delete-product-list_")) {
    const type = data.split("_")[1];

    await ctx.editMessageCaption({
      caption: "Выберите товар, который хотите удалить:",
      reply_markup: deleteProductListKeyboard(type),
    });
    return;
  }

  if (data.startsWith("edit-product_")) {
    const [, type, label] = data.split("_");
    const products = getProducts(type as ProductCategory);
    const product = products.find((p) => p.label === label);

    if (!product) {
      await ctx.api.sendMessage(
        chatId,
        `Товар с меткой ${label} не найден.`
      );
      return;
    }

    ctx.session.state = {
      type: UserState.AWAITING_PRODUCT_PRICE,
      productType: type as ProductCategory,
      product,
    };

    await ctx.api.sendMessage(
      chatId,
      `Введите новую цену для товара ${label} UC:`
    );
    return;
  }

  if (data.startsWith("delete-product_")) {
    const [, type, label] = data.split("_");
    const deleted = await deleteProduct(type as ProductCategory, label);

    if (deleted) {
      await ctx.api.sendMessage(chatId, `Товар ${label}UC был удален.`);
    } else {
      await ctx.api.sendMessage(chatId, `Товар ${label}UC не найден.`);
    }

    await sendMainMessage(ctx);
    return;
  }

  if (data === "manage-admins") {
    await ctx.editMessageCaption({
      caption: "👥 Управление администраторами:",
      reply_markup: adminsManagementKeyboard(),
    });
    return;
  }

  if (data === "add-admin") {
    ctx.session.state = { type: UserState.AWAITING_ADD_ADMIN };

    await ctx.editMessageCaption({
      caption:
        "Введите ID пользователя, которого хотите сделать администратором",
      reply_markup: cancelReturnKeyboard,
    });
    return;
  }

  if (data === "remove-admin") {
    ctx.session.state = { type: UserState.AWAITING_REMOVE_ADMIN };

    await ctx.editMessageCaption({
      caption:
        "Введите ID администратора, которого хотите удалить",
      reply_markup: cancelReturnKeyboard,
    });
    return;
  }

  if (data === "send-broadcast") {
    ctx.session.state = { type: UserState.AWAITING_BROADCAST };

    await ctx.api.sendMessage(
      chatId,
      "Отправьте текст сообщения, которое хотите разослать всем пользователям:",
      { reply_markup: cancelReturnKeyboard }
    );
    return;
  }

  if (data === "manage-codes") {
    await ctx.editMessageCaption({
      caption: "Выберите товар для добавления кодов:",
      reply_markup: codesProductsKeyboard(),
    });
    return;
  }

  if (data.startsWith("add-codes_")) {
    const productLabel = data.split("_")[1];
    ctx.session.state = {
      type: UserState.AWAITING_CODES,
      productLabel,
    };

    await sendUnusedCodes(ctx, productLabel);

    await ctx.editMessageCaption({
      caption: `Отправьте коды для ${productLabel} UC (по одному в строке):`,
      reply_markup: new InlineKeyboard().text(
        "❌ Отмена",
        "manage-codes"
      ),
    });
  }
}