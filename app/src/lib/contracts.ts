import type { Abi } from 'viem'
import routerAbi from '../../../deployments/abi/RaidRouter.json'
import seatGateAbi from '../../../deployments/abi/SeatGate.json'
import erc20Abi from '../../../deployments/abi/MockERC20.json'
import starsAbi from '../../../deployments/abi/MockStars.json'

export const ROUTER_ABI = routerAbi as Abi
export const GATE_ABI = seatGateAbi as Abi
export const ERC20_ABI = erc20Abi as Abi
export const STARS_ABI = starsAbi as Abi

/** Every custom error the router and seat gate can raise, in the words the user should read. */
export const ERROR_TEXT: Record<string, string> = {
  NotOpen: 'The raid is not open right now. It has not started yet, or it is already closing.',
  OutsideWindow: 'That block was outside the raid window. Buys only count between the start and end blocks.',
  Excluded: 'The sponsor and its listed affiliates cannot raid their own wall.',
  SizeTooSmall: 'That amount is under the market minimum (about 2.6 tUSDC). Raise it a little.',
  SizeTooLarge: 'That amount is over the market maximum. Lower it.',
  NativeNotAccepted: 'This raid takes tUSDC only. No MON should be attached.',
  NotStarOwner: 'That wallet does not own this Star right now.',
  TokenUsed: 'This Star already opened a seat for another wallet in this raid.',
  SeatTaken: 'This holder already has a seat played by another wallet in this raid.',
  PlayerHasSeat: 'This wallet already plays a different seat in this raid.',
  BadBind: "The holder's signature does not match.",
  Expired: "The holder's signature has expired. Ask for a fresh one.",
  BadHuman: 'The personhood proof did not verify.',
  HolderNeedsStarSeat: 'Star holders must raid with their Star seat.',
  NotSettled: 'Claims open once the raid has settled.',
  NoSeat: 'This wallet has no seat in this raid.',
  HoldNotOver: 'The hold is still running. You can wait, or exit early and forfeit your prize share.',
  AlreadyDone: 'Already claimed or exited for this raid.',
  SafeERC20FailedOperation: 'The tUSDC transfer failed. Check that the wallet (or raid key) still holds enough tUSDC.',
}

export function explainError(e: unknown): string {
  const msg = e instanceof Error ? `${e.message} ${(e as { details?: string }).details ?? ''}` : String(e)
  for (const name of Object.keys(ERROR_TEXT)) if (msg.includes(name)) return ERROR_TEXT[name]
  if (/User rejected|denied/i.test(msg)) return 'You cancelled it in your wallet. Nothing was sent.'
  // Monad's RPC answers "Missing or invalid parameters" + "Signer had insufficient balance" when the
  // sender cannot cover gas limit x max fee (Monad bills the limit).
  if (/reserve balance/i.test(msg)) return 'The network is still crediting the MON that was just sent (Monad needs a couple of seconds). Try again in a moment.'
  if (/insufficient (funds|balance)/i.test(msg)) return 'Not enough MON for gas. Monad charges the full gas limit up front, so top up a little MON and try again.'
  if (/requests limited|429|rate limit/i.test(msg)) return 'The testnet RPC is busy (rate limited). Wait a second and try again.'
  if (/Missing or invalid parameters/i.test(msg)) return 'The network refused the transaction, usually because there is not enough MON for gas. Top up and try again.'
  return msg.split('\n')[0].slice(0, 220)
}

// Monad bills the gas limit, not gas used (AGENTS rule 10). Mirrors keeper/src/gas.ts.
export const GAS = { approve: 80_000n, mint: 120_000n, claim: 400_000n, exitEarly: 400_000n }
export const RAID_GAS_CEILING = 2_000_000n
export function raidGasLimit(extraMakers: number, estimate?: bigint): bigint {
  const floor = 800_000n + 40_000n * BigInt(extraMakers)
  if (estimate === undefined) return floor
  const padded = (estimate * 3n) / 2n
  const limit = padded > floor ? padded : floor
  return limit > RAID_GAS_CEILING ? RAID_GAS_CEILING : limit
}
