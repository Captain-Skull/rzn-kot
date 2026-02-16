import { cache } from '../cache.js';
import { database } from '../firebase.js';

export function getAdminUsername() {
  return cache.adminUsername;
}

export async function setAdminUsername(newAdminUsername: string) {
  await database.ref('adminUsername').set(newAdminUsername);
  cache.adminUsername = newAdminUsername;
}
