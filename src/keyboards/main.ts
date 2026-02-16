import { InlineKeyboard } from 'grammy';
import { isAdmin } from '../database/repo/adminRepo.js';
import { getAdminUsername } from '../database/repo/adminUsernameRepo.js';

export function mainKeyboard(chatId: number): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text('💰 Купить UC', 'open-catalog_uc')
    .row()
    .text('💵 Прайм+', 'open-catalog_prime')
    .row()
    .url('📘 Отзывы', 'https://t.me/otzivrznkot')
    .row()
    .url('📖 Инструкция', 'https://t.me/instructionrznkot')
    .row()
    .url('⚙️ Тех.поддержка', `https://t.me/${getAdminUsername()}`);

  if (isAdmin(chatId)) {
    keyboard.row().text('👑 Админ-панель', 'admin-panel');
  }

  console.log(getAdminUsername());

  return keyboard;
}
