import type { MyContext } from '../../types/context.js';
import { UserState } from '../../types/enums.js';
import { handleSigninNickname, handlePrimeIdInput, handlePrimeNickname } from '../../services/purchaseService.js';

export async function handleShopInput(ctx: MyContext): Promise<void> {
  const state = ctx.session.state;

  switch (state.type) {
    case UserState.AWAITING_SIGNIN_NICKNAME:
      await handleSigninNickname(ctx);
      break;
    case UserState.AWAITING_PRIME_ID:
      await handlePrimeIdInput(ctx);
      break;
    case UserState.AWAITING_PRIME_NICKNAME:
      await handlePrimeNickname(ctx);
      break;
  }
}
