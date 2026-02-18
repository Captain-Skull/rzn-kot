import { database } from '../firebase.js';
import { cache } from '../cache.js';

export async function createUser(userId: string | number): Promise<void> {
  const id = String(userId);
  if (cache.users[id] === undefined) {
    cache.users[id] = true;
    await database.ref(`users/${id}`).set(true);
  }
}

export async function deleteUser(userId: string | number): Promise<void> {
  const id = String(userId);
  delete cache.users[id];
  await database.ref(`users/${id}`).remove();
}

export function userExists(userId: string | number): boolean {
  return Boolean(cache.users[String(userId)]);
}

export function getAllUserIds(): string[] {
  return Object.keys(cache.users);
}
