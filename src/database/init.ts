import { database } from './firebase.js';
import { cache } from './cache.js';
import { ADMIN_CHAT_ID } from '../config/env.js';
import { SUPPORT_USERNAME } from '../config/constants.js';

export async function initializeCache(): Promise<void> {
  const [adminsSnap, usersSnap, codesSnap, signinSnap, primeSnap, blockedSnap, adminUsernameSnap] = await Promise.all([
    database.ref('admins').once('value'),
    database.ref('users').once('value'),
    database.ref('productsCodes').once('value'),
    database.ref('productsSignin').once('value'),
    database.ref('productsPrime').once('value'),
    database.ref('blockedUsers').once('value'),
    database.ref('adminUsername').once('value'),
  ]);

  cache.admins = adminsSnap.val() || {};
  cache.users = usersSnap.val() || {};
  cache.productsCodes = codesSnap.val() || [];
  cache.productsSignin = signinSnap.val() || [];
  cache.productsPrime = primeSnap.val() || [];
  cache.blockedUsers = blockedSnap.val() || {};
  cache.adminUsername = adminUsernameSnap.val() || SUPPORT_USERNAME;

  if (!Object.keys(cache.admins).length && ADMIN_CHAT_ID) {
    cache.admins[ADMIN_CHAT_ID] = true;
    await database.ref('admins').set(cache.admins);
  }

  console.log(`✅ Загружено: ${Object.keys(cache.users).length} пользователей, ` + `${Object.keys(cache.admins).length} админов`);
}
