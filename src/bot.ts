import { Bot } from 'grammy';
import type { MyContext } from './types/context.js';
import { BOT_TOKEN } from './config/env.js';
import { initializationMiddleware } from './middlewares/initialization.js';
import { createSessionMiddleware } from './middlewares/session.js';
import { registerHandlers } from './handlers/index.js';
import { blockCheckMiddleware } from './middlewares/blocks.js';

export const bot = new Bot<MyContext>(BOT_TOKEN);

bot.use(initializationMiddleware);
bot.use(createSessionMiddleware());
bot.use(blockCheckMiddleware);

registerHandlers(bot);
