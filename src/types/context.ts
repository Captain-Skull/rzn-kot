import { Context, type SessionFlavor } from 'grammy';
import type { Product } from './models.js';
import type { ProductCategory, UserState } from './enums.js';

export interface Cart {
  items: Product[];
  total: number;
}

interface StateData {
  type: UserState;

  pubgId?: string;

  product?: Product;

  productLabel?: string;

  newLabel?: string;

  category?: ProductCategory;
}

export interface SessionData {
  state: StateData;
  cart: Cart;
}

export type MyContext = Context & SessionFlavor<SessionData>;
