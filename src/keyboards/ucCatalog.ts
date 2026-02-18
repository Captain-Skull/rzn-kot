import { InlineKeyboard } from 'grammy';

export const ucCatalogKeyboard = new InlineKeyboard()
  .text('Вход', 'open-catalog_signin')
  .icon('5206182661256668709')
  .row()
  .text('По ID', 'open-catalog_codes')
  .icon('5206182661256668709')
  .row()
  .text('🔙 Назад', 'return');
