import type { NextFunction } from 'grammy';
import type { MyContext } from '../types/context.js';
import { isBlocked } from '../database/repo/blockRepo.js';
import { isAdmin } from '../database/repo/adminRepo.js';
import { SUPPORT_USERNAME } from '../config/constants.js';

export async function blockCheckMiddleware(ctx: MyContext, next: NextFunction): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return await next();

  if (isBlocked(userId) && !isAdmin(userId)) {
    await ctx.reply(`⛔️ Доступ ограничен.\nЕсли вы не согласны обратитесь к админу ${SUPPORT_USERNAME}`);
    return;
  }

  await next();
}
