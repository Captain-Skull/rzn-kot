import express from 'express';
import { PAYCORE_ALLOWED_IP, WEBHOOK_PORT } from './config/env.js';
import { handlePaycoreWebhook } from './services/webhookService.js';
import type { PaycoreWebhookBody } from './types/models.js';

const app = express();
app.use(express.json());

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '';
}

app.post('/webhook/paycore', async (req, res) => {
  const clientIp = getClientIp(req);
  console.log(`📨 Webhook от IP: ${clientIp}`);

  if (clientIp !== PAYCORE_ALLOWED_IP && clientIp !== `::ffff:${PAYCORE_ALLOWED_IP}`) {
    console.warn(`⚠️ Webhook отклонён: неизвестный IP ${clientIp}`);
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const body = req.body as PaycoreWebhookBody;

  if (!body.order_id || body.amount === undefined) {
    console.warn('⚠️ Webhook: невалидное тело', body);
    res.status(400).json({ error: 'Invalid body' });
    return;
  }

  try {
    const result = await handlePaycoreWebhook(body);

    if (result.success) {
      res.status(200).json({ status: 'ok' });
    } else {
      res.status(404).json({ error: result.message });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

export function startServer(): void {
  app.listen(WEBHOOK_PORT, () => {
    console.log(`🌐 Webhook сервер запущен на порту ${WEBHOOK_PORT}`);
  });
}
