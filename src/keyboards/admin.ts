import { InlineKeyboard } from 'grammy';
import { ProductCategory } from '../types/enums.js';
import { getProducts } from '../database/repo/productRepo.js';

export function adminPanelKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🛠 Товары', 'manage-products')
    .text('📢 Рассылка', 'send-broadcast')
    .row()
    .text('➕ Коды UC', 'manage-codes')
    .text('👥 Админы', 'manage-admins')
    .row()
    .text('🚫 Блокировки', 'manage-blocks')
    .text('✏️ Имя админа', 'change-admin-username')
    .row()
    .text('🔙 На главную', 'return');
}

export function categorySelectKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('💰 UC по входу', 'manage-category_signin')
    .text('🔒 UC по кодам', 'manage-category_codes')
    .row()
    .text('💵 Прайм+', 'manage-category_prime')
    .row()
    .text('🔙 Назад', 'admin-panel');
}

export function productsManagementKeyboard(category: string): InlineKeyboard {
  const products = getProducts(category as ProductCategory);
  const kb = new InlineKeyboard();
  for (const p of products) {
    kb.text(`${p.label} - ${p.price}₽`, `edit-product_${category}_${p.label}`).row();
  }
  kb.text('➕ Добавить', `add-product_${category}`)
    .text('➖ Удалить', `delete-product-list_${category}`)
    .row()
    .text('🔙 Назад', 'manage-products');
  return kb;
}

export function deleteProductListKeyboard(category: string): InlineKeyboard {
  const products = getProducts(category as ProductCategory);
  const kb = new InlineKeyboard();
  for (const p of products) {
    kb.text(`${p.label} - ${p.price}₽`, `delete-product_${category}_${p.label}`).row();
  }
  kb.text('❌ Отмена', 'admin-panel');
  return kb;
}

export function codesManageKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('➕ Добавить', 'add-codes-list')
    .row()
    .text('➖ Удалить', 'remove-codes-list')
    .row()
    .text('🔙 Назад', 'admin-panel');
}

export function codesProductListKeyboard(action: 'add' | 'remove'): InlineKeyboard {
  const products = getProducts(ProductCategory.CODES);
  const kb = new InlineKeyboard();
  for (const p of products) {
    kb.text(`${p.label}`, `${action}-codes_${p.label}`).row();
  }
  kb.text('🔙 Назад', 'admin-panel');
  return kb;
}

export function adminsManagementKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('➕ Добавить', 'add-admin').text('➖ Удалить', 'remove-admin').row().text('🔙 Назад', 'admin-panel');
}

export function blocksManagementKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🚫 Заблокировать', 'block-user')
    .text('✅ Разблокировать', 'unblock-user')
    .row()
    .text('📋 Список', 'list-blocked')
    .row()
    .text('🔙 Назад', 'admin-panel');
}

export function orderModerationKeyboard(userId: number, orderId: string, total: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Выполнен', `order-completed_${userId}_${orderId}`)
    .text('❌ Отменить', `order-declined_${userId}_${orderId}_${total}`);
}
