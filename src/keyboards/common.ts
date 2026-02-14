import { InlineKeyboard } from "grammy";

export function returnKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("🔙 В меню", "return");
}

export const cancelAdminKeyboard = new InlineKeyboard().text(
  "❌ Отмена",
  "admin-panel"
);

export const cancelProfileKeyboard = new InlineKeyboard().text(
  "❌ Отмена",
  "my-profile"
);

export const cancelReturnKeyboard = new InlineKeyboard().text(
  "⛔️ Назад",
  "admin-panel"
);