import { InlineKeyboard } from 'grammy';

export function returnKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('🔙 В главное меню', 'return');
}

export function mainMessageKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('🏚 Главное меню', 'main-message');
}

export function cancelKeyboard(callbackData = 'return'): InlineKeyboard {
  return new InlineKeyboard().text('❌ Отмена', callbackData);
}

export function adminBackKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('🔙 Назад', 'admin-panel');
}
