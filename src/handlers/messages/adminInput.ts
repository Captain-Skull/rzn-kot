import type { MyContext } from '../../types/context.js';
import { UserState, ProductCategory } from '../../types/enums.js';
import { userExists } from '../../database/repo/userRepo.js';
import { updateProductPrice, addProduct } from '../../database/repo/productRepo.js';
import { addAdmin, removeAdmin, isAdmin as checkAdmin } from '../../database/repo/adminRepo.js';
import { addCodes, deleteCode } from '../../database/repo/codeRepo.js';
import { blockUser, unblockUser, isBlocked } from '../../database/repo/blockRepo.js';
import { sendBroadcast } from '../../services/broadcastService.js';
import { bot } from '../../bot.js';
import { resetState } from '../../utils/helpers.js';
import { returnKeyboard, adminBackKeyboard } from '../../keyboards/common.js';
import { SUPPORT_USERNAME } from '../../config/constants.js';

export async function handleAdminInput(ctx: MyContext): Promise<void> {
  const chatId = ctx.chat!.id;
  const text = ctx.msg?.text;
  if (!text) return;

  const state = ctx.session.state;

  switch (state.type) {
    case UserState.AWAITING_PRODUCT_PRICE: {
      const newPrice = parseFloat(text);
      if (isNaN(newPrice)) {
        await ctx.reply('Введите корректную цену.');
        return;
      }
      await updateProductPrice(state.category as ProductCategory, state.product!.label, newPrice);
      await ctx.reply(`Цена ${state.product!.label} изменена на ${newPrice}₽.`, { reply_markup: returnKeyboard() });
      resetState(ctx);
      break;
    }

    case UserState.AWAITING_NEW_PRODUCT_LABEL: {
      ctx.session.state = { type: UserState.AWAITING_NEW_PRODUCT_PRICE, category: state.category as ProductCategory, newLabel: text };
      await ctx.reply(`Введите цену для товара (${text}):`);
      break;
    }

    case UserState.AWAITING_NEW_PRODUCT_PRICE: {
      const newPrice = parseFloat(text);
      if (isNaN(newPrice)) {
        await ctx.reply('Введите корректную цену');
        return;
      }
      await addProduct(state.category as ProductCategory, { label: state.newLabel!, price: newPrice });
      await ctx.reply(`Товар ${state.newLabel} добавлен за ${newPrice}₽`, { reply_markup: returnKeyboard() });
      resetState(ctx);
      break;
    }

    case UserState.AWAITING_BROADCAST: {
      if (!text) {
        await ctx.reply('Сообщение не может быть пустым.');
        return;
      }
      await sendBroadcast(chatId, text);
      resetState(ctx);
      break;
    }

    case UserState.AWAITING_ADD_ADMIN: {
      if (!userExists(text)) {
        await ctx.reply(`Пользователь "${text}" не найден.`, { reply_markup: returnKeyboard() });
        return;
      }
      if (checkAdmin(text)) {
        await ctx.reply(`${text} уже администратор.`, { reply_markup: returnKeyboard() });
      } else {
        await addAdmin(text);
        await ctx.reply(`${text} назначен администратором.`, { reply_markup: returnKeyboard() });
        try {
          await bot.api.sendMessage(text, 'Вы назначены администратором.', { reply_markup: returnKeyboard() });
        } catch (error) {
          console.log(error);
        }
      }
      resetState(ctx);
      break;
    }

    case UserState.AWAITING_REMOVE_ADMIN: {
      const removed = await removeAdmin(text);
      await ctx.reply(removed ? `${text} удален из администраторов.` : 'Нельзя удалить главного администратора.', {
        reply_markup: returnKeyboard(),
      });
      if (removed) {
        try {
          await bot.api.sendMessage(text, 'Вы удалены из администраторов.', { reply_markup: returnKeyboard() });
        } catch (error) {
          console.log(error);
        }
      }
      resetState(ctx);
      break;
    }

    case UserState.AWAITING_CODES: {
      const codes = text
        .split('\n')
        .map(c => c.trim())
        .filter(c => c.length > 0);
      await addCodes(state.productLabel!, codes);
      await ctx.reply(`✅ Добавлено ${codes.length} кодов для ${state.productLabel} UC`, { reply_markup: adminBackKeyboard() });
      resetState(ctx);
      break;
    }

    case UserState.AWAITING_CODE_TO_DELETE: {
      const deleted = await deleteCode(state.productLabel!, text);
      await ctx.reply(deleted ? `✅ Код ${text} удален` : '⚠️ Код не найден', { reply_markup: adminBackKeyboard() });
      resetState(ctx);
      break;
    }

    case UserState.AWAITING_BLOCK_USER: {
      const [targetId, ...reasonParts] = text.split(' ');
      const reason = reasonParts.join(' ').trim();
      if (!targetId || isNaN(Number(targetId))) {
        await ctx.reply('Укажите ID: `12345 причина`', { parse_mode: 'Markdown' });
        return;
      }
      if (checkAdmin(targetId)) {
        await ctx.reply('❌ Нельзя заблокировать админа!', { reply_markup: returnKeyboard() });
        resetState(ctx);
        return;
      }
      if (isBlocked(targetId)) {
        await ctx.reply('⚠️ Уже заблокирован.', { reply_markup: returnKeyboard() });
        resetState(ctx);
        return;
      }
      await blockUser(targetId);
      await ctx.reply(`${targetId} заблокирован${reason ? `: ${reason}` : ''}`, { reply_markup: returnKeyboard() });
      try {
        await bot.api.sendMessage(targetId, `⛔️ Доступ ограничен.\nПричина: ${reason || 'мошенничество'}\n${SUPPORT_USERNAME}`);
      } catch (error) {
        console.log(error);
      }
      resetState(ctx);
      break;
    }

    case UserState.AWAITING_UNBLOCK_USER: {
      if (!text || isNaN(Number(text))) {
        await ctx.reply('Укажите ID пользователя');
        return;
      }
      const unblocked = await unblockUser(text);
      await ctx.reply(unblocked ? `${text} разблокирован.` : `${text} не в списке блокировок.`, { reply_markup: returnKeyboard() });
      if (unblocked) {
        try {
          await bot.api.sendMessage(text, '✅ Доступ к боту восстановлен.');
        } catch (error) {
          console.log(error);
        }
      }
      resetState(ctx);
      break;
    }
  }
}
