export interface Product {
  label: string;
  price: number;
}

export interface Order {
  orderId: string;
  userId: number;
  type: string;
  nickname?: string;
  pubgId?: string;
  codes?: Record<string, string[]>;
  items: Product[];
  total: number;
  status: string;
  paymentId?: string;
  timestamp: number;
  userInfo?: {
    username: string;
  };
  confirmedAt?: number;
  adminId?: number;
}

export interface CodeEntry {
  code: string;
  used: boolean;
  addedAt?: number;
}

export interface PendingPayment {
  paycoreOrderId: string; // order_id от PayCore
  botOrderId: string; // Наш номер заказа
  userId: number;
  type: 'codes' | 'prime';
  items: Product[];
  total: number;
  nickname?: string;
  pubgId?: string;
  username: string;
  messageId?: number; // Сообщение с кнопкой оплаты (для удаления)
  createdAt: number;
}

export interface PaycoreInitResponse {
  url: string;
  order_id: string;
  amount: string;
}

export interface PaycoreWebhookBody {
  order_id: string;
  amount: number;
  final_amount: number;
  commission_amount: number;
  method: string;
}
