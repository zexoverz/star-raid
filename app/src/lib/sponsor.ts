import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { type Abi, type Address, parseUnits } from 'viem'
import { useConnection, usePublicClient, useReadContracts, useWriteContract } from 'wagmi'
import vaultAbi from '../../../deployments/abi/RaidVault.json'
import { ADDR } from './config'
import { ERC20_ABI, GAS, explainError } from './contracts'
import { notify } from './toast'

/**
 * Sponsor console logic. A sponsor locks a wall of its token and a prize in the vault with `post`;
 * the keeper opens it at w0 (puts the wall on Kuru at the cap price), closes it after w1 (Pyth
 * Entropy draws the end block) and settles it (unsold wall + tUSDC raised go back to the sponsor;
 * a lost prize becomes rollover credit for the sponsor's next raid, never withdrawable).
 *
 * Rules mirror RaidVault._checkTerms so the form refuses what the contract would revert.
 */
export const VAULT_ABI = vaultAbi as Abi

/** Testnet market (tSTAR / tUSDC on Kuru). Kuru units read from getMarketParams on testnet. */
export const MARKET = {
  address: ADDR.market as Address,
  sizePrecision: 10n ** 10n, // wall size in Kuru units = tokens * 1e10
  pricePrecision: 10n ** 8n, // price in Kuru units = tUSDC per tSTAR * 1e8
  minSize: 10n ** 12n, // 100 tSTAR
  maxSize: 10n ** 20n, // 1e10 tSTAR
  baseDecimals: 18,
  quoteDecimals: 6,
} as const

export const RULES = {
  OPEN_EARLY: 10n, // w0 must be more than this many blocks ahead when posting
  MIN_WINDOW: 40n,
  MAX_WINDOW: 400n,
  TARGET_PER_BOUNTY: 10n, // a win must buy at least 10x the prize
  BLOCK_SEC: 0.4,
  POST_GAS: 600_000n,
} as const

export interface Form {
  wallTokens: string // tSTAR in the wall
  capPrice: string // tUSDC per tSTAR, fixed anchor
  prize: string // tUSDC
  target: string // tUSDC of counted wall buys to win
  seatCap: string // tUSDC max counted per seat
  startInSec: number // from now
  lengthSec: number // window length
  holdSec: number
  affiliates: string // comma or newline separated addresses
}

export const DEFAULT_FORM: Form = { wallTokens: '100000', capPrice: '0.026', prize: '50', target: '500', seatCap: '600', startInSec: 60, lengthSec: 60, holdSec: 60, affiliates: '' }

const num = (s: string, d: number) => {
  try {
    return s.trim() ? parseUnits(s.trim(), d) : 0n
  } catch {
    return -1n
  }
}

export interface Built {
  ok: boolean
  errors: string[]
  wallWei: bigint
  wallSize: bigint
  bounty: bigint
  target: bigint
  seatCap: bigint
  anchorParam: bigint
  windowBlocks: bigint
  leadBlocks: bigint
  affiliates: Address[]
  /** tUSDC the wall raises if fully bought at the cap. */
  wallValue: bigint
}

/** Turn the form into contract units and check every rule the vault checks. */
export function buildTerms(f: Form): Built {
  const errors: string[] = []
  const wallWei = num(f.wallTokens, MARKET.baseDecimals)
  const priceUnits = num(f.capPrice, 8) // Kuru price precision 1e8
  const bounty = num(f.prize, MARKET.quoteDecimals)
  const target = num(f.target, MARKET.quoteDecimals)
  const seatCap = num(f.seatCap, MARKET.quoteDecimals)
  const wallSize = wallWei > 0n ? (wallWei * MARKET.sizePrecision) / 10n ** 18n : 0n
  const leadBlocks = BigInt(Math.ceil(f.startInSec / RULES.BLOCK_SEC))
  const windowBlocks = BigInt(Math.round(f.lengthSec / RULES.BLOCK_SEC))
  const affiliates = f.affiliates
    .split(/[\s,]+/)
    .map((a) => a.trim())
    .filter(Boolean) as Address[]

  if (wallWei <= 0n) errors.push('Wall size must be a positive amount of tSTAR.')
  else if (wallSize < MARKET.minSize) errors.push('Wall is too small: Kuru needs at least 100 tSTAR.')
  else if (wallSize > MARKET.maxSize) errors.push('Wall is too big for this market.')
  else if (wallWei % (10n ** 18n / MARKET.sizePrecision) !== 0n) errors.push('Wall size has too many decimals (max 10).')
  if (priceUnits <= 0n) errors.push('Cap price must be above 0.')
  if (bounty <= 0n) errors.push('The prize must be above 0.')
  if (target <= 0n) errors.push('The target must be above 0.')
  if (seatCap <= 0n) errors.push('The seat cap must be above 0.')
  if (bounty > 0n && target > 0n && bounty * RULES.TARGET_PER_BOUNTY > target) errors.push(`The target must be at least 10x the prize (at least ${(Number(bounty) * 10) / 1e6} tUSDC).`)
  if (leadBlocks <= RULES.OPEN_EARLY + 4n) errors.push('Start at least 10 seconds from now.')
  if (windowBlocks < RULES.MIN_WINDOW) errors.push(`The window must be at least ${Number(RULES.MIN_WINDOW) * RULES.BLOCK_SEC} seconds.`)
  if (windowBlocks > RULES.MAX_WINDOW) errors.push(`The window can be at most ${Number(RULES.MAX_WINDOW) * RULES.BLOCK_SEC} seconds.`)
  for (const a of affiliates) if (!/^0x[0-9a-fA-F]{40}$/.test(a)) errors.push(`"${a.slice(0, 14)}…" is not an address.`)

  const wallValue = wallWei > 0n && priceUnits > 0n ? (wallWei * priceUnits) / 10n ** 18n / 100n : 0n // tUSDC 6dp
  if (target > 0n && wallValue > 0n && target > wallValue) errors.push('The target is more than the whole wall is worth at the cap, so nobody could ever win.')
  return { ok: errors.length === 0, errors, wallWei, wallSize, bounty, target, seatCap, anchorParam: priceUnits, windowBlocks, leadBlocks, affiliates, wallValue }
}

/** The sponsor's own raids and rollover credit. */
export function useSponsorState() {
  const { address } = useConnection()
  const reads = useReadContracts({
    contracts: [
      { address: ADDR.base, abi: ERC20_ABI, functionName: 'balanceOf', args: [address!] },
      { address: ADDR.quote, abi: ERC20_ABI, functionName: 'balanceOf', args: [address!] },
      { address: ADDR.vault, abi: VAULT_ABI, functionName: 'rollover', args: [address!, ADDR.quote] },
    ],
    query: { enabled: !!address, refetchInterval: 8000 },
  })
  return {
    address,
    star: reads.data?.[0]?.result as bigint | undefined,
    usdc: reads.data?.[1]?.result as bigint | undefined,
    rollover: (reads.data?.[2]?.result as bigint | undefined) ?? 0n,
    refetch: reads.refetch,
  }
}

export type Step = { label: string; state: 'todo' | 'doing' | 'done' | 'error' }

/**
 * Post a raid: mint missing test tokens (testnet only), approve exactly what is needed, then post.
 * w0/w1 are computed from the chain head at send time so the start delay holds.
 */
export function usePostRaid() {
  const { address } = useConnection()
  const client = usePublicClient()
  const { mutateAsync: write } = useWriteContract()
  const qc = useQueryClient()
  const [steps, setSteps] = useState<Step[]>([])
  const [busy, setBusy] = useState(false)
  const [posted, setPosted] = useState<string | null>(null)

  const post = useCallback(
    async (b: Built, f: Form, have: { star: bigint; usdc: bigint; rollover: bigint }) => {
      if (!address || !client || !b.ok) return false
      const needStar = b.wallWei > have.star ? b.wallWei - have.star : 0n
      const prizeDue = b.bounty > have.rollover ? b.bounty - have.rollover : 0n
      const needUsdc = prizeDue > have.usdc ? prizeDue - have.usdc : 0n
      const jobs: { label: string; run: () => Promise<`0x${string}`> }[] = []
      if (needStar > 0n) jobs.push({ label: `Mint ${Number(needStar / 10n ** 18n).toLocaleString()} test tSTAR`, run: () => write({ address: ADDR.base, abi: ERC20_ABI, functionName: 'mint', args: [address, needStar], gas: GAS.mint }) })
      if (needUsdc > 0n) jobs.push({ label: `Mint ${Number(needUsdc) / 1e6} test tUSDC`, run: () => write({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'mint', args: [address, needUsdc], gas: GAS.mint }) })
      jobs.push({ label: 'Approve the wall (tSTAR)', run: () => write({ address: ADDR.base, abi: ERC20_ABI, functionName: 'approve', args: [ADDR.vault, b.wallWei], gas: GAS.approve }) })
      if (prizeDue > 0n) jobs.push({ label: 'Approve the prize (tUSDC)', run: () => write({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'approve', args: [ADDR.vault, prizeDue], gas: GAS.approve }) })
      jobs.push({
        label: 'Post the raid',
        run: async () => {
          const head = await client.getBlockNumber({ cacheTime: 0 })
          const w0 = head + b.leadBlocks
          const terms = { market: MARKET.address, prizeToken: ADDR.quote, wallSize: b.wallSize, bounty: b.bounty, target: b.target, seatCap: b.seatCap, w0, w1: w0 + b.windowBlocks, hold: f.holdSec, capBps: 0, anchorMode: 0, anchorParam: b.anchorParam }
          return write({ address: ADDR.vault, abi: VAULT_ABI, functionName: 'post', args: [terms, b.affiliates], gas: RULES.POST_GAS })
        },
      })
      setSteps(jobs.map((j) => ({ label: j.label, state: 'todo' })))
      setBusy(true)
      setPosted(null)
      try {
        for (let i = 0; i < jobs.length; i++) {
          setSteps((s) => s.map((x, k) => (k === i ? { ...x, state: 'doing' } : x)))
          const hash = await jobs[i].run()
          const r = await client.waitForTransactionReceipt({ hash })
          if (r.status !== 'success') throw new Error(`${jobs[i].label} failed on chain.`)
          setSteps((s) => s.map((x, k) => (k === i ? { ...x, state: 'done' } : x)))
        }
        const id = (await client.readContract({ address: ADDR.vault, abi: VAULT_ABI, functionName: 'raidCount' })) as bigint
        setPosted(id.toString())
        await qc.invalidateQueries()
        notify.success(`Raid #${id} posted! The keeper opens the wall when the window starts.`)
        return true
      } catch (e) {
        setSteps((s) => s.map((x) => (x.state === 'doing' ? { ...x, state: 'error' } : x)))
        notify.error(explainSponsorError(e))
        return false
      } finally {
        setBusy(false)
      }
    },
    [address, client, write, qc],
  )
  return { post, steps, busy, posted }
}

const VAULT_ERRORS: Record<string, string> = {
  BadWindow: 'The start or length is outside what the vault allows. Start at least 10 s ahead, run 16 to 160 s.',
  BadCapBps: 'The cap setting is not allowed for this market.',
  BadAmounts: 'Prize, target and seat cap must all be above 0.',
  BadSize: 'The wall size does not fit this market (min 100 tSTAR, max 10 decimals).',
  BountyTooLarge: 'The target must be at least 10x the prize.',
  MarketNotAllowed: 'This market is not allowed for raids.',
  IsPaused: 'Posting is paused right now.',
  NativeMismatch: 'Wrong MON value sent with the post.',
}
export function explainSponsorError(e: unknown) {
  const msg = e instanceof Error ? `${e.message} ${(e as { details?: string }).details ?? ''}` : String(e)
  for (const [k, v] of Object.entries(VAULT_ERRORS)) if (msg.includes(k)) return v
  return explainError(e)
}
