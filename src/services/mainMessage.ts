import type { MyContext } from '../types/context.js';
import { IMAGES } from '../config/constants.js';
import { deleteUser } from '../database/repo/userRepo.js';
import { mainKeyboard } from '../keyboards/main.js';

export async function sendMainMessage(ctx: MyContext, messageId?: number): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const firstName = ctx.chat?.first_name || '';
  const lastName = ctx.chat?.last_name || '';
  const greetingName = lastName ? `${firstName} ${lastName}` : firstName;
  const keyboard = mainKeyboard(chatId);

  const caption = `🙋‍♂ Добрый день, ${greetingName}!`;

  try {
    if (messageId) {
      await ctx.api.editMessageMedia(
        chatId,
        messageId,
        {
          type: 'photo',
          media: IMAGES.welcome,
          caption,
        },
        { reply_markup: keyboard },
      );
    } else {
      await ctx.api.sendPhoto(chatId, IMAGES.welcome, {
        caption,
        reply_markup: keyboard,
      });
    }
  } catch (error: any) {
    if (error?.description?.includes('403')) {
      console.log(`Пользователь ${chatId} заблокировал бота. Удаляем...`);
      await deleteUser(chatId);
    } else {
      console.error('Main message error:', error);
    }
  }
}
