import { InlineKeyboard } from "grammy";
import { isAdmin } from "../database/repo/adminRepo.js";

export function mainKeyboard(chatId: number): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text("🛒 Каталог", "open-shop")
    .row()
    .text("📦 Мои заказы", "my-orders")
    .text("👤 Мой профиль", "my-profile")
    .row()
    .url("🔗 Наш канал", "https://t.me/POSTAVKABOJLHOGO")
    .url("⚙️ Тех.поддержка", "https://t.me/BoJlHoy")
    .row()
    .url("📖 Отзывы", "https://t.me/Bolnojot");

  if (isAdmin(chatId)) {
    keyboard.row().text("👑 Админ-панель", "admin-panel");
  }

  return keyboard;
}