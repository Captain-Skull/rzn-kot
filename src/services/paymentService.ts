/**
 * Заглушка онлайн-кассы.
 *
 * TODO: Заменить на реальную интеграцию:
 * - ЮKassa, Тинькофф, Robokassa и т.д.
 *
 * Реальный flow будет примерно таким:
 * 1. createPayment() → возвращает URL для оплаты
 * 2. Пользователь переходит по ссылке и платит
 * 3. Касса присылает webhook → бот завершает заказ
 *
 * Сейчас заглушка сразу возвращает success.
 */

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  paymentUrl?: string;
  error?: string;
}

export interface PaymentItem {
  name: string;
  quantity: number;
  price: number;
}

export async function createPayment(userId: number, amount: number, description: string, items: PaymentItem[]): Promise<PaymentResult> {
  // ========== ЗАГЛУШКА ==========
  // Замените этот код на реальный вызов API кассы

  const paymentId = `PAY-${Date.now().toString(36).toUpperCase()}`;

  console.log(`💳 [STUB] Оплата: ${amount}₽`);
  console.log(`   Пользователь: ${userId}`);
  console.log(`   Описание: ${description}`);
  console.log(`   Товары: ${items.map(i => `${i.name} x${i.quantity}`).join(', ')}`);
  console.log(`   Payment ID: ${paymentId}`);

  // Имитация задержки обработки
  await new Promise(r => setTimeout(r, 500));

  return {
    success: true,
    paymentId,
    // paymentUrl: "https://payment-gateway.example/pay/...",
  };

  // ========== ПРИМЕР РЕАЛЬНОЙ ИНТЕГРАЦИИ (ЮKassa) ==========
  //
  // const response = await axios.post('https://api.yookassa.ru/v3/payments', {
  //   amount: { value: amount.toFixed(2), currency: 'RUB' },
  //   capture: true,
  //   confirmation: {
  //     type: 'redirect',
  //     return_url: 'https://t.me/your_bot'
  //   },
  //   description,
  //   receipt: {
  //     customer: { email: 'customer@example.com' },
  //     items: items.map(i => ({
  //       description: i.name,
  //       quantity: i.quantity.toString(),
  //       amount: { value: i.price.toFixed(2), currency: 'RUB' },
  //       vat_code: 1
  //     }))
  //   }
  // }, {
  //   auth: { username: SHOP_ID, password: SECRET_KEY }
  // });
  //
  // return {
  //   success: true,
  //   paymentId: response.data.id,
  //   paymentUrl: response.data.confirmation.confirmation_url
  // };
}

/**
 * Проверка статуса платежа (для webhook / polling)
 */
export async function checkPaymentStatus(paymentId: string): Promise<'pending' | 'succeeded' | 'canceled'> {
  // ЗАГЛУШКА
  console.log(`💳 [STUB] Проверка платежа ${paymentId}: succeeded`);
  return 'succeeded';
}
