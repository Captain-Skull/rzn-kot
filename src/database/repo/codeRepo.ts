import { database } from '../firebase.js';
import type { CodeEntry } from '../../types/models.js';

export async function getAvailableCodes(productLabel: string, limit?: number): Promise<Record<string, CodeEntry>> {
  let query: any = database.ref(`codes/${productLabel}`).orderByChild('used').equalTo(false);

  if (limit) {
    query = query.limitToFirst(limit);
  }

  const snapshot = await query.once('value');
  return snapshot.val() || {};
}

export async function countAvailableCodes(productLabel: string): Promise<number> {
  const snapshot = await database.ref(`codes/${productLabel}`).orderByChild('used').equalTo(false).once('value');

  return snapshot.numChildren();
}

export async function markCodesAsUsed(productLabel: string, codeKeys: string[]): Promise<void> {
  const updates: Record<string, boolean> = {};
  codeKeys.forEach(key => {
    updates[`codes/${productLabel}/${key}/used`] = true;
  });
  await database.ref().update(updates);
}

export async function addCodes(productLabel: string, codes: string[]): Promise<void> {
  const updates: Record<string, object> = {};

  codes.forEach(code => {
    const newKey = database.ref(`codes/${productLabel}`).push().key!;
    updates[newKey] = {
      code,
      used: false,
      addedAt: Date.now(),
    };
  });

  await database.ref(`codes/${productLabel}`).update(updates);
}

export async function deleteCode(productLabel: string, codeValue: string): Promise<boolean> {
  const snapshot = await database.ref(`codes/${productLabel}`).orderByChild('code').equalTo(codeValue).once('value');
  if (!snapshot.exists()) return false;
  const codeId = Object.keys(snapshot.val())[0];
  await database.ref(`codes/${productLabel}/${codeId}`).remove();
  return true;
}

export async function getAllAvailableCodesCount(): Promise<Record<string, number>> {
  const snapshot = await database.ref('codes').once('value');
  const codesData = snapshot.val() || {};
  const counts: Record<string, number> = {};

  Object.entries(codesData).forEach(([label, productCodes]: [string, any]) => {
    counts[label] = Object.values(productCodes).filter((c: any) => c.used === false).length;
  });

  return counts;
}

export async function getUnusedCodesFormatted(productLabel: string): Promise<string> {
  const codes = await getAvailableCodes(productLabel);
  const entries = Object.values(codes);
  let message = `📋 Неиспользованные коды для ${productLabel} UC:\n`;
  if (entries.length === 0) {
    message += 'Пусто';
  } else {
    entries.forEach((codeData, index) => {
      message += `${index + 1}. <code>${codeData.code}</code>\n`;
    });
  }
  return message;
}
