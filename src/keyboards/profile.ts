import { InlineKeyboard } from "grammy";

export function profileKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("💳 Пополнить баланс", "deposit")
    .row()
    .text("🛒 Магазин", "open-shop")
    .row()
    .url("Наш канал", "https://t.me/POSTAVKABOJLHOGO")
    .url("Тех.поддержка", "https://t.me/BoJlHoy")
    .row()
    .text("⛔️ Назад", "return");
}