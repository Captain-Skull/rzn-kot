export enum UserState {
  DEFAULT = 'default',

  AWAITING_SIGNIN_NICKNAME = 'awaiting_signin_nickname',

  AWAITING_PRIME_ID = 'awaiting_prime_id',
  AWAITING_PRIME_NICKNAME = 'awaiting_prime_nickname',

  AWAITING_PRODUCT_PRICE = 'awaiting_product_price',
  AWAITING_NEW_PRODUCT_LABEL = 'awaiting_new_product_label',
  AWAITING_NEW_PRODUCT_PRICE = 'awaiting_new_product_price',

  AWAITING_BROADCAST = 'awaiting_broadcast',

  AWAITING_ADD_ADMIN = 'awaiting_add_admin',
  AWAITING_REMOVE_ADMIN = 'awaiting_remove_admin',

  AWAITING_CODES = 'awaiting_codes',
  AWAITING_CODE_TO_DELETE = 'awaiting_code_to_delete',

  AWAITING_BLOCK_USER = 'awaiting_block_user',
  AWAITING_UNBLOCK_USER = 'awaiting_unblock_user',

  AWAITING_NEW_ADMIN_USERNAME = 'awaiting_new_admin_username',
}

export enum ProductCategory {
  CODES = 'codes',
  SIGNIN = 'signin',
  PRIME = 'prime',
}

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CONFIRMED = 'confirmed',
  DECLINED = 'declined',
}
