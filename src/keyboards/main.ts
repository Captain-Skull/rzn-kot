import { InlineKeyboard } from 'grammy';
import { isAdmin } from '../database/repo/adminRepo.js';
import { getAdminUsername } from '../database/repo/adminUsernameRepo.js';

export function mainKeyboard(chatId: number): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text('Купить UC', 'open-catalog_uc')
    .icon('5206182661256668709')
    .row()
    .text('Прайм+', 'open-catalog_prime')
    .icon('5375451711848591584')
    .row()
    .url('📘 Отзывы', 'https://t.me/otzivrznkot')
    .row()
    .url('📖 Инструкция', 'https://t.me/instructionrznkot')
    .row()
    .url('Админ', `https://t.me/${getAdminUsername()}`)
    .icon('5323336750477616586');

  if (isAdmin(chatId)) {
    keyboard.row().text('👑 Админ-панель', 'admin-panel');
  }

  return keyboard;
}
