import type { Product } from '../types/models.js';

export interface AppCache {
  admins: Record<string, boolean>;
  users: Record<string, boolean>;
  productsCodes: Product[];
  productsSignin: Product[];
  productsPrime: Product[];
  blockedUsers: Record<string, boolean>;
}

export const cache: AppCache = {
  admins: {},
  users: {},
  productsCodes: [],
  productsSignin: [],
  productsPrime: [],
  blockedUsers: {},
};
