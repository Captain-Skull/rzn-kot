import { Bot } from 'grammy';
import type { MyContext } from '../../types/context.js';
import { handleNavigation } from './navigation.js';
import { handleShop } from './shop.js';
import { handleAdmin } from './admin.js';
import { handleModeration } from './moderation.js';

export function registerCallbacks(bot: Bot<MyContext>): void {
  bot.on('callback_query:data', async ctx => {
    const data = ctx.callbackQuery.data;

    try {
      if (['return', 'main-message'].includes(data) || data.startsWith('open-catalog_')) {
        return await handleNavigation(ctx, data);
      }

      if (data.startsWith('cart_') || data.startsWith('buy-prime_')) {
        return await handleShop(ctx, data);
      }

      if (
        [
          'admin-panel',
          'manage-products',
          'manage-admins',
          'manage-codes',
          'add-codes-list',
          'remove-codes-list',
          'send-broadcast',
          'add-admin',
          'remove-admin',
          'manage-blocks',
          'block-user',
          'unblock-user',
          'list-blocked',
          'back-from-blocked-list',
          'change-admin-username',
        ].includes(data) ||
        data.startsWith('manage-category_') ||
        data.startsWith('edit-product_') ||
        data.startsWith('delete-product') ||
        data.startsWith('add-product_') ||
        data.startsWith('add-codes_') ||
        data.startsWith('remove-codes_')
      ) {
        return await handleAdmin(ctx, data);
      }

      if (data.startsWith('order-completed_') || data.startsWith('order-declined_')) {
        return await handleModeration(ctx, data);
      }

      await ctx.answerCallbackQuery();
    } catch (error) {
      console.error('Callback error:', error);
    }
  });
}
