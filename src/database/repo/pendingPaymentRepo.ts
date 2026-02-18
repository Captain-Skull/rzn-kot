import { database } from '../firebase.js';
import { cache } from '../cache.js';
import type { PendingPayment } from '../../types/models.js';

export function getPendingPayment(paycoreOrderId: string): PendingPayment | undefined {
  return cache.pendingPayments[paycoreOrderId];
}

export async function savePendingPayment(payment: PendingPayment): Promise<void> {
  cache.pendingPayments[payment.paycoreOrderId] = payment;
  await database.ref(`pendingPayments/${payment.paycoreOrderId}`).set(payment);
}

export async function deletePendingPayment(paycoreOrderId: string): Promise<void> {
  delete cache.pendingPayments[paycoreOrderId];
  await database.ref(`pendingPayments/${paycoreOrderId}`).remove();
}

export function getUserPendingPayments(userId: number): PendingPayment[] {
  return Object.values(cache.pendingPayments).filter(p => p.userId === userId);
}
