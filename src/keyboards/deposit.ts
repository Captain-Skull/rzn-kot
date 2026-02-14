import { InlineKeyboard } from "grammy";

export function depositConfirmKeyboard(
  userId: string | number
): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Подтвердить", `confirm_${userId}`)
    .text("❌ Отклонить", `reject_${userId}`);
}
