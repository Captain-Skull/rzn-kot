import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env variable: ${name}`);
  }
  return value;
}

export const BOT_TOKEN = requireEnv('token');
export const ADMIN_CHAT_ID = requireEnv('ADMIN_CHAT_ID');
export const ORDERS_GROUP_ID = requireEnv('ORDERS_GROUP_ID');

export const PAYCORE_API_KEY = requireEnv('PAYCORE_API_KEY');
export const PAYCORE_API_URL = requireEnv('PAYCORE_API_URL');
export const WEBHOOK_BASE_URL = requireEnv('WEBHOOK_BASE_URL');
export const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PORT || '3000');

export const PAYCORE_ALLOWED_IP = '89.169.187.108';
