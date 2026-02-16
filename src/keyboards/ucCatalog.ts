import { InlineKeyboard } from 'grammy';

export const ucCatalogKeyboard = new InlineKeyboard()
  .text('💰 Вход', 'open-catalog_signin')
  .row()
  .text('💰 По ID', 'open-catalog_codes')
  .row()
  .text('🔙 Назад', 'return');
