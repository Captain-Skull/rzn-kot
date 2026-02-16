import { InlineKeyboard } from 'grammy';
import { bot } from '../bot.js';
import { ORDERS_GROUP_ID } from '../config/env.js';
import { getAdminIds } from '../database/repo/adminRepo.js';

export async function sendToGroup(groupId: string, message: string, keyboard?: InlineKeyboard): Promise<void> {
  try {
    await bot.api.sendMessage(groupId, message, {
      parse_mode: 'HTML',
      reply_markup: keyboard || new InlineKeyboard(),
    });
  } catch (error) {
    console.error('Group send error:', error);
  }
}

export async function sendOrderNotification(message: string, keyboard?: InlineKeyboard): Promise<void> {
  await sendToGroup(ORDERS_GROUP_ID, message, keyboard);
}

export async function notifyAllAdmins(message: string, keyboard?: InlineKeyboard): Promise<void> {
  for (const adminId of getAdminIds()) {
    try {
      await bot.api.sendMessage(adminId, message, { reply_markup: keyboard || new InlineKeyboard() });
    } catch (error) {
      console.error(`Admin notify error (${adminId}):`, error);
    }
  }
}
