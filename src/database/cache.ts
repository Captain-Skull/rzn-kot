import { SUPPORT_USERNAME } from '../config/constants.js';
import type { Product } from '../types/models.js';

export interface AppCache {
  admins: Record<string, boolean>;
  users: Record<string, boolean>;
  productsCodes: Product[];
  productsSignin: Product[];
  productsPrime: Product[];
  blockedUsers: Record<string, boolean>;
  adminUsername: string;
}

export const cache: AppCache = {
  admins: {},
  users: {},
  productsCodes: [],
  productsSignin: [],
  productsPrime: [],
  blockedUsers: {},
  adminUsername: SUPPORT_USERNAME,
};
