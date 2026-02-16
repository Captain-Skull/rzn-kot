import { InlineKeyboard } from 'grammy';
import type { MyContext } from '../../types/context.js';
import { UserState, ProductCategory } from '../../types/enums.js';
import { getProducts, deleteProduct } from '../../database/repo/productRepo.js';
import { isAdmin } from '../../database/repo/adminRepo.js';
import { getBlockedUserIds } from '../../database/repo/blockRepo.js';
import { getUnusedCodesFormatted } from '../../database/repo/codeRepo.js';
import { IMAGES } from '../../config/constants.js';
import { resetState } from '../../utils/helpers.js';
import { getCategoryName } from '../../utils/formatters.js';
import { sendMainMessage } from '../../services/mainMessage.js';
import {
  adminPanelKeyboard,
  categorySelectKeyboard,
  productsManagementKeyboard,
  deleteProductListKeyboard,
  codesManageKeyboard,
  codesProductListKeyboard,
  adminsManagementKeyboard,
  blocksManagementKeyboard,
} from '../../keyboards/admin.js';
import { cancelKeyboard } from '../../keyboards/common.js';

export async function handleAdmin(ctx: MyContext, data: string): Promise<void> {
  const chatId = ctx.chat!.id;
  const messageId = ctx.msg!.message_id;

  if (!isAdmin(chatId)) {
    await ctx.answerCallbackQuery({ text: '❌ Доступ запрещен!' });
    return;
  }

  if (data === 'admin-panel') {
    resetState(ctx);
    const name = ctx.from?.first_name || '';
    await ctx.api.editMessageMedia(
      chatId,
      messageId,
      { type: 'photo', media: IMAGES.welcome, caption: `🙋‍♂ Добрый день, ${name}!\n💰 Вы вошли в Админ панель.` },
      { reply_markup: adminPanelKeyboard() },
    );
    return;
  }

  if (data === 'manage-products') {
    await ctx.editMessageCaption({
      caption: '📦 Выберите категорию товаров:',
      reply_markup: categorySelectKeyboard(),
    });
    return;
  }

  if (data.startsWith('manage-category_')) {
    const category = data.split('_')[1];
    await ctx.editMessageCaption({
      caption: `🛠 Управление товарами (${getCategoryName(category)}):`,
      reply_markup: productsManagementKeyboard(category),
    });
    return;
  }

  if (data.startsWith('edit-product_')) {
    const [, categoryStr, label] = data.split('_');
    const category = categoryStr as ProductCategory;
    const products = getProducts(category);
    const product = products.find(p => p.label === label);
    if (!product) {
      await ctx.api.sendMessage(chatId, `Товар ${label} не найден.`);
      return;
    }
    ctx.session.state = { type: UserState.AWAITING_PRODUCT_PRICE, product, category };
    await ctx.api.sendMessage(chatId, `Введите новую цену для товара ${label}:`);
    return;
  }

  if (data.startsWith('add-product_')) {
    const category = data.split('_')[1] as ProductCategory;
    ctx.session.state = { type: UserState.AWAITING_NEW_PRODUCT_LABEL, category };
    await ctx.editMessageCaption({
      caption: 'Введите название нового товара:',
      reply_markup: cancelKeyboard('admin-panel'),
    });
    return;
  }

  if (data.startsWith('delete-product-list_')) {
    const category = data.split('_')[1];
    await ctx.editMessageCaption({
      caption: 'Выберите товар для удаления:',
      reply_markup: deleteProductListKeyboard(category),
    });
    return;
  }

  if (data.startsWith('delete-product_')) {
    const [, category, label] = data.split('_');
    const deleted = await deleteProduct(category as ProductCategory, label);
    await ctx.api.sendMessage(chatId, deleted ? `Товар ${label} удален.` : `Товар ${label} не найден.`);
    await sendMainMessage(ctx);
    return;
  }

  if (data === 'send-broadcast') {
    ctx.session.state = { type: UserState.AWAITING_BROADCAST };
    await ctx.editMessageCaption({
      caption: 'Отправьте текст сообщения для рассылки:',
      reply_markup: cancelKeyboard('admin-panel'),
    });
    return;
  }

  if (data === 'manage-codes') {
    resetState(ctx);
    await ctx.editMessageCaption({
      caption: 'Выберите действие с кодами:',
      reply_markup: codesManageKeyboard(),
    });
    return;
  }

  if (data === 'add-codes-list') {
    await ctx.editMessageCaption({
      caption: 'Выберите товар для добавления кодов:',
      reply_markup: codesProductListKeyboard('add'),
    });
    return;
  }

  if (data === 'remove-codes-list') {
    await ctx.editMessageCaption({
      caption: 'Выберите товар для удаления кодов:',
      reply_markup: codesProductListKeyboard('remove'),
    });
    return;
  }

  if (data.startsWith('add-codes_')) {
    const productLabel = data.split('_')[1];
    ctx.session.state = { type: UserState.AWAITING_CODES, productLabel };
    const codesMessage = await getUnusedCodesFormatted(productLabel);
    await ctx.api.sendMessage(chatId, codesMessage, { parse_mode: 'HTML' });
    await ctx.editMessageCaption({
      caption: `Отправьте коды для ${productLabel} UC (по одному в строке):`,
      reply_markup: cancelKeyboard('manage-codes'),
    });
    return;
  }

  if (data.startsWith('remove-codes_')) {
    const productLabel = data.split('_')[1];
    ctx.session.state = { type: UserState.AWAITING_CODE_TO_DELETE, productLabel };
    const codesMessage = await getUnusedCodesFormatted(productLabel);
    await ctx.api.sendMessage(chatId, codesMessage, { parse_mode: 'HTML' });
    await ctx.editMessageCaption({
      caption: 'Отправьте код для удаления (скопируйте нажатием):',
      reply_markup: cancelKeyboard('manage-codes'),
    });
    return;
  }

  if (data === 'manage-admins') {
    await ctx.editMessageCaption({
      caption: '👥 Управление администраторами:',
      reply_markup: adminsManagementKeyboard(),
    });
    return;
  }

  if (data === 'add-admin') {
    ctx.session.state = { type: UserState.AWAITING_ADD_ADMIN };
    await ctx.editMessageCaption({
      caption: 'Введите ID пользователя для назначения администратором',
      reply_markup: cancelKeyboard('admin-panel'),
    });
    return;
  }

  if (data === 'remove-admin') {
    ctx.session.state = { type: UserState.AWAITING_REMOVE_ADMIN };
    await ctx.editMessageCaption({
      caption: 'Введите ID администратора для удаления',
      reply_markup: cancelKeyboard('admin-panel'),
    });
    return;
  }

  if (data === 'manage-blocks') {
    await ctx.editMessageCaption({
      caption: '🚫 Управление блокировками:',
      reply_markup: blocksManagementKeyboard(),
    });
    return;
  }

  if (data === 'block-user') {
    ctx.session.state = { type: UserState.AWAITING_BLOCK_USER };
    await ctx.editMessageCaption({
      caption: 'Введите ID и причину:\nНапример: `12345 спам`',
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard('manage-blocks'),
    });
    return;
  }

  if (data === 'unblock-user') {
    ctx.session.state = { type: UserState.AWAITING_UNBLOCK_USER };
    await ctx.editMessageCaption({
      caption: 'Введите ID пользователя для разблокировки:',
      reply_markup: cancelKeyboard('manage-blocks'),
    });
    return;
  }

  if (data === 'list-blocked') {
    const blocked = getBlockedUserIds();
    if (blocked.length === 0) {
      await ctx.api.sendMessage(chatId, 'Список блокировок пуст.', {
        reply_markup: new InlineKeyboard().text('🔙 Назад', 'manage-blocks'),
      });
      return;
    }
    const listText = blocked.map(id => `• <code>${id}</code>`).join('\n');
    await ctx.api.deleteMessage(chatId, messageId);
    await ctx.api.sendMessage(chatId, `Заблокированы:\n${listText}`, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('🔙 Назад', 'back-from-blocked-list'),
    });
    return;
  }

  if (data === 'back-from-blocked-list') {
    await ctx.api.deleteMessage(chatId, messageId);
    await ctx.api.sendPhoto(chatId, IMAGES.welcome, {
      caption: '🚫 Управление блокировками:',
      reply_markup: blocksManagementKeyboard(),
    });
  }
}
