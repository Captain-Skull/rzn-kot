import axios from 'axios';
import { PAYCORE_API_KEY, PAYCORE_API_URL, WEBHOOK_BASE_URL, WEBHOOK_PORT } from '../config/env.js';
import type { PaycoreInitResponse } from '../types/models.js';

export interface PaymentResult {
  success: boolean;
  paymentUrl?: string;
  orderId?: string;
  error?: string;
}
export async function createPayment(amount: number, description: string, method: 'card' | 'sbp' = 'sbp'): Promise<PaymentResult> {
  try {
    const response = await axios.post<PaycoreInitResponse>(
      `${PAYCORE_API_URL}/api/init`,
      {
        method,
        amount,
        description,
        returnLink: `${WEBHOOK_BASE_URL}:${WEBHOOK_PORT}/webhook/paycore`,
      },
      {
        headers: {
          'X-Api-Key': PAYCORE_API_KEY,
          'Content-Type': 'application/json',
        },
      },
    );

    return {
      success: response.status === 200,
      paymentUrl: response.data.url,
      orderId: response.data.order_id,
    };
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error('PayCore API error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.msg || 'Ошибка платежной системы',
      };
    }

    console.error('Payment error:', error);
    return {
      success: false,
      error: 'Неизвестная ошибка',
    };
  }
}
