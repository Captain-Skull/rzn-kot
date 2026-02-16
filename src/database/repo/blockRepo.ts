import { database } from '../firebase.js';
import { cache } from '../cache.js';

export function isBlocked(userId: string | number): boolean {
  return Boolean(cache.blockedUsers[String(userId)]);
}

export async function blockUser(userId: string | number): Promise<void> {
  cache.blockedUsers[String(userId)] = true;
  await database.ref(`blockedUsers/${userId}`).set(true);
}

export async function unblockUser(userId: string | number): Promise<boolean> {
  const id = String(userId);
  if (!cache.blockedUsers[id]) return false;
  delete cache.blockedUsers[id];
  await database.ref(`blockedUsers/${id}`).remove();
  return true;
}

export function getBlockedUserIds(): string[] {
  return Object.keys(cache.blockedUsers);
}
