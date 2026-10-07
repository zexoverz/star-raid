import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPublicClient, createWalletClient, http, maxUint256, zeroHash, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { monadTestnet } from 'viem/chains'
import { useConnection, useSignTypedData, useWriteContract, usePublicClient } from 'wagmi'
import { ADDR, CHAIN_ID, RPC_URL } from './config'
import { ERC20_ABI, GAS, ROUTER_ABI, explainError, raidGasLimit } from './contracts'
import { formatUnits } from 'viem'
import { notify } from './toast'

const fmtUnits = (v: bigint, d: number, dp = 2) => Number(formatUnits(v, d)).toLocaleString(undefined, { maximumFractionDigits: dp })

/**
 * One-tap raiding, set up once per wallet and reused for every raid.
 *
 * Setup: the browser makes one raid key for the connected wallet and keeps it in this browser
 * (localStorage, never sent anywhere). The Star holder signs one EIP-712
 * `Bind{holder, player: raidKey, expiry}` (a seat pass, valid PASS_DAYS) so the key can play the
 * holder's Star in any raid (SeatGate kind 1 checks holder, player, expiry and that the holder owns
 * the Star, not the raid id). The holder funds the key with the tUSDC they choose plus a little MON
 * for gas, and the key approves the router once.
 *
 * Joining a new raid: nothing, as long as the pass is valid and the key has funds. Tapping is one
 * `router.raid` per tap from the key, explicit gas limit, no popup.
 *
 * Claims for a raid the key played are sent from the key (the seat is bound to it); the tSTAR and
 * prize land on the key and "Return to wallet" sends tUSDC, tSTAR and MON back to the holder.
 */
const PASS_DAYS = 7
const PASS_TTL = PASS_DAYS * 24 * 60 * 60 // seconds

export interface Pass {
  pk: Hex
  holder: Hex
  tokenId: string
  expiry: string
  sig: Hex
}

/** One raid key per holder, in localStorage: it may hold funds, so it must survive a closed tab. */
const KEY_EVENT = 'starraid:key'
const changed = () => window.dispatchEvent(new Event(KEY_EVENT))
const keys = {
  id: (holder: string) => `starraid.key.${holder.toLowerCase()}`,
  pk(holder: string): Hex | null {
    return localStorage.getItem(this.id(holder)) as Hex | null
  },
  ensure(holder: string): Hex {
    let pk = this.pk(holder)
    if (!pk) {
      localStorage.setItem(this.id(holder), (pk = generatePrivateKey()))
      changed()
    }
    return pk
  },
  passId: (holder: string) => `starraid.pass.${holder.toLowerCase()}`,
  pass(holder: string): Pass | null {
    try {
      const raw = localStorage.getItem(this.passId(holder))
      return raw ? (JSON.parse(raw) as Pass) : null
    } catch {
      return null
    }
  },
  savePass(p: Pass) {
    localStorage.setItem(this.passId(p.holder), JSON.stringify(p))
    changed()
  },
  dropPass(holder: string) {
    localStorage.removeItem(this.passId(holder))
    changed()
  },
}

/** Keys from the per-raid design (sessionStorage / pending) are swept back once, then forgotten. */
function legacyKeys(holder: string): Hex[] {
  const out = new Set<Hex>()
  const h = holder.toLowerCase()
  for (const store of [localStorage, sessionStorage]) {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i)
      if (!k) continue
      try {
        if (k.startsWith('starraid.pending.') && k.endsWith(`.${h}`)) out.add(store.getItem(k) as Hex)
        if (k.startsWith('sr-session-')) {
          const s = JSON.parse(store.getItem(k) ?? 'null') as { pk: Hex; holder: string } | null
          if (s?.holder?.toLowerCase() === h) out.add(s.pk)
        }
      } catch {}
    }
  }
  return [...out]
}
function forgetLegacy(holder: string, pk: Hex) {
  const h = holder.toLowerCase()
  for (const store of [localStorage, sessionStorage]) {
    for (let i = store.length - 1; i >= 0; i--) {
      const k = store.key(i)
      if (!k) continue
      const v = store.getItem(k) ?? ''
      if ((k.startsWith('starraid.pending.') && k.endsWith(`.${h}`) && v === pk) || (k.startsWith('sr-session-') && v.includes(pk))) store.removeItem(k)
    }
  }
}

const pub = createPublicClient({
  chain: monadTestnet,
  // The public RPC allows 15 req/s per client: batch reads and retry on 429/limit errors.
  transport: http(RPC_URL, { batch: { batchSize: 20, wait: 16 }, retryCount: 4, retryDelay: 400 }),
  // Receipt waits poll once a second (viem's default is half the 400 ms block time), so a burst of
  // hits in flight shares one slow block poll instead of adding up toward the limit.
  pollingInterval: 1_000,
})

/**
 * Monad bills the gas LIMIT at maxFeePerGas, so the key needs limit x maxFee per hit in flight.
 * Cap the fee near the base fee (same policy as the keeper) instead of viem's default 2x + tip.
 */
async function fees() {
  // Monad's base fee never drops below 100 gwei; floor it so a stale or odd reading never underfunds the key.
  const MIN_BASE = 100_000_000_000n
  const read = (await pub.getBlock()).baseFeePerGas ?? MIN_BASE
  const base = read > MIN_BASE ? read : MIN_BASE
  const tip = 2_000_000_000n
  return { maxFeePerGas: (base * 5n) / 4n + tip, maxPriorityFeePerGas: tip }
}
/** A hit's gas limit (rule 10): measured testnet estimate for a seated hit is ~823-865k, x1.5 padded. */
const HIT_GAS = raidGasLimit(1, 865_000n)
/** MON the key keeps for gas: about 8 hits plus a claim and the return, at a 1.25x base fee. */
const KEY_HITS = 8n
const gasBudget = (maxFee: bigint) => (HIT_GAS * KEY_HITS + GAS.claim + 4n * GAS.approve + 21_000n) * maxFee

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const refusedForBalance = (e: unknown) => /insufficient (funds|balance)|reserve balance|Missing or invalid parameters/i.test(String((e as { details?: string })?.details ?? '') + String((e as Error)?.message ?? e))

/**
 * Monad consensus checks balances against state a few blocks old, so a key that was empty cannot
 * spend MON it just received until that transfer is Verified (about 5 blocks, ~2 s). Wait for that,
 * then retry a refused send a few times instead of failing (docs: asynchronous execution, newly
 * funded accounts).
 */
async function waitSpendable(fundedBlock: bigint) {
  for (let i = 0; i < 40; i++) {
    if ((await pub.getBlockNumber({ cacheTime: 0 })) >= fundedBlock + 5n) return
    await sleep(400)
  }
}
async function sendWhenFunded<T>(send: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await send()
    } catch (e) {
      if (i >= 5 || !refusedForBalance(e)) throw e
      await sleep(800 * (i + 1))
    }
  }
}

const keyWalletOf = (pk: Hex) => createWalletClient({ account: privateKeyToAccount(pk), chain: monadTestnet, transport: http(RPC_URL, { retryCount: 4, retryDelay: 400 }) })

async function balancesOf(a: Hex) {
  const [usdc, star, mon] = await Promise.all([
    pub.readContract({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'balanceOf', args: [a] }) as Promise<bigint>,
    pub.readContract({ address: ADDR.base, abi: ERC20_ABI, functionName: 'balanceOf', args: [a] }) as Promise<bigint>,
    pub.getBalance({ address: a }),
  ])
  return { usdc, star, mon }
}

/** Send a raid key's tSTAR (and unless `starOnly`, its tUSDC and MON too) to `to`. */
async function sweepKey(pk: Hex, to: Hex, { starOnly = false } = {}) {
  const wallet = keyWalletOf(pk)
  const a = wallet.account.address
  const f = await fees()
  const b = await balancesOf(a)
  const tokens = starOnly ? ([[ADDR.base, b.star]] as const) : ([[ADDR.quote, b.usdc], [ADDR.base, b.star]] as const)
  for (const [token, bal] of tokens) {
    if (bal > 0n) {
      const h = await sendWhenFunded(() => wallet.writeContract({ address: token, abi: ERC20_ABI, functionName: 'transfer', args: [to, bal], gas: GAS.approve, ...f }))
      await pub.waitForTransactionReceipt({ hash: h })
    }
  }
  if (starOnly) return
  const fee = 21_000n * f.maxFeePerGas
  const mon = await pub.getBalance({ address: a })
  if (mon > fee) {
    const h = await sendWhenFunded(() => wallet.sendTransaction({ to, value: mon - fee, gas: 21_000n, ...f }))
    await pub.waitForTransactionReceipt({ hash: h })
  }
}

export function useOneTap(raidId: string) {
  const { address } = useConnection()
  const [pass, setPass] = useState<Pass | null>(() => null)
  const [usdc, setUsdc] = useState<bigint>(0n)
  const [star, setStar] = useState<bigint>(0n)
  const [mon, setMon] = useState<bigint>(0n)
  const [allowance, setAllowance] = useState<bigint>(0n)
  const [status, setStatusRaw] = useState<string | null>(null)
  const [error, setErrorRaw] = useState<string | null>(null)
  // Errors pop a Lil Stars toast; long steps show a "working on it" toast that the next step replaces.
  const setError = useCallback((m: string | null) => {
    setErrorRaw(m)
    if (m) notify.error(m, { id: 'onetap-err' })
  }, [])
  const setStatus = useCallback((m: string | null) => {
    setStatusRaw(m)
    if (m) notify.loading(m, { id: 'onetap-status' })
    else notify.dismiss('onetap-status')
  }, [])
  const [inflight, setInflight] = useState(0)
  const [hits, setHits] = useState(0)
  const nonce = useRef<number | null>(null)
  const { signTypedDataAsync } = useSignTypedData()
  const { mutateAsync: write } = useWriteContract()
  const client = usePublicClient()

  // The key and pass follow the connected wallet, and every useOneTap on the page (top bar chip,
  // key page, join panel) re-reads them when any of them sets up, renews or tops up.
  const [pk, setPk] = useState<Hex | null>(null)
  const [rev, setRev] = useState(0)
  useEffect(() => {
    const on = () => setRev((n) => n + 1)
    window.addEventListener(KEY_EVENT, on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener(KEY_EVENT, on)
      window.removeEventListener('storage', on)
    }
  }, [])
  useEffect(() => {
    setPk(address ? keys.pk(address) : null)
    setPass(address ? keys.pass(address) : null)
    nonce.current = null
  }, [address, rev])
  useEffect(() => setHits(0), [raidId])

  const account = useMemo(() => (pk ? privateKeyToAccount(pk) : null), [pk])
  const wallet = useMemo(() => (pk ? keyWalletOf(pk) : null), [pk])
  const passValid = !!pass && !!address && pass.holder.toLowerCase() === address.toLowerCase() && Number(pass.expiry) > Date.now() / 1000 + 120

  // Latest key balances, written synchronously by refresh() so the tap ledger never reads a stale render.
  const balRef = useRef({ usdc: 0n, mon: 0n })
  const refresh = useCallback(async () => {
    if (!account) return
    // Background poll: a busy RPC (15 req/s limit) just means this tick is skipped, never an uncaught error.
    const got = await Promise.all([
      balancesOf(account.address),
      pub.readContract({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'allowance', args: [account.address, ADDR.router] }) as Promise<bigint>,
    ]).catch(() => null)
    if (!got) return
    const [b, al] = got
    balRef.current = { usdc: b.usdc, mon: b.mon }
    setUsdc(b.usdc)
    setStar(b.star)
    setMon(b.mon)
    setAllowance(al)
  }, [account])

  useEffect(() => {
    void refresh()
    const i = setInterval(refresh, 8000)
    return () => clearInterval(i)
  }, [refresh, rev])

  // Hits read nothing from the chain: fee and nonce are prepared once and refreshed in the background.
  const feeRef = useRef<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } | null>(null)
  useEffect(() => {
    if (!account) return
    const load = () => void fees().then((f) => (feeRef.current = f)).catch(() => {})
    load()
    const i = setInterval(load, 15_000)
    return () => clearInterval(i)
  }, [account])

  /**
   * Set up (or top up) one-tap. Only asks for what is missing: a seat pass if there is none or it
   * is about to expire, tUSDC if the key holds less than `budget`, MON if the key is low on gas.
   * The router approval is made once and covers every later raid.
   */
  const arm = useCallback(
    async (tokenId: string, budget: bigint) => {
      if (!address || !client) return false
      setError(null)
      try {
        const keyPk = keys.ensure(address)
        setPk(keyPk)
        const acct = privateKeyToAccount(keyPk)
        let p = keys.pass(address)
        // The Bind names holder and key, not a Star or a raid, so one pass covers every raid until it expires.
        const fresh = p && p.pk === keyPk && p.holder.toLowerCase() === address.toLowerCase() && Number(p.expiry) > Date.now() / 1000 + 120
        if (fresh && p!.tokenId !== tokenId) {
          p = { ...p!, tokenId }
          keys.savePass(p)
          setPass(p)
        }
        if (!fresh) {
          const expiry = BigInt(Math.floor(Date.now() / 1000) + PASS_TTL)
          setStatus('Sign the seat pass in your wallet')
          const sig = await signTypedDataAsync({
            domain: { name: 'StarRaid SeatGate', version: '1', chainId: CHAIN_ID, verifyingContract: ADDR.seatGate },
            types: { Bind: [{ name: 'holder', type: 'address' }, { name: 'player', type: 'address' }, { name: 'expiry', type: 'uint64' }] },
            primaryType: 'Bind',
            message: { holder: address, player: acct.address, expiry },
          })
          p = { pk: keyPk, holder: address, tokenId, expiry: expiry.toString(), sig }
          keys.savePass(p)
          setPass(p)
        }
        const have = await balancesOf(acct.address)
        const wallet = await balancesOf(address)
        const f = await fees()
        const want = gasBudget(f.maxFeePerGas)
        const needUsdc = have.usdc < budget ? budget - have.usdc : 0n
        const needMon = have.mon < want / 2n ? want - have.mon : 0n
        // Check the wallet can actually pay before asking it to: a transfer of more than it holds is
        // mined as a failed tx (it still costs gas) and the key gets nothing.
        if (needUsdc > wallet.usdc) throw new Error(`Your wallet has ${fmtUnits(wallet.usdc, 6)} tUSDC, ${fmtUnits(needUsdc, 6)} needed. Mint test tUSDC or pick a smaller amount.`)
        if (needMon > 0n && wallet.mon < needMon + 21_000n * f.maxFeePerGas * 3n) throw new Error(`Your wallet needs about ${fmtUnits(needMon, 18, 2)} MON for the raid key's gas.`)
        if (needUsdc > 0n) {
          setStatus('Send tUSDC to your raid key')
          const h1 = await write({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'transfer', args: [acct.address, needUsdc], gas: GAS.approve })
          const r1 = await client.waitForTransactionReceipt({ hash: h1 })
          if (r1.status !== 'success') throw new Error('The tUSDC transfer to your raid key failed on chain. Nothing was moved.')
        }
        let fundedBlock = 0n
        if (needMon > 0n) {
          setStatus('Send a little MON for gas')
          const { sendTransaction } = await import('wagmi/actions')
          const { wagmiConfig } = await import('./wagmi')
          const h2 = await sendTransaction(wagmiConfig, { to: acct.address, value: needMon, gas: 21_000n })
          const r2 = await client.waitForTransactionReceipt({ hash: h2 })
          if (r2.status !== 'success') throw new Error('The MON transfer to your raid key failed on chain.')
          fundedBlock = r2.blockNumber
        }
        const al = (await pub.readContract({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'allowance', args: [acct.address, ADDR.router] })) as bigint
        if (al < budget * 1000n) {
          // One approval for the router, reused by every raid. The key only ever holds what the
          // holder sent it, so the allowance can never reach more than that.
          setStatus('Getting your raid key ready')
          if (fundedBlock > 0n) await waitSpendable(fundedBlock)
          const kw = keyWalletOf(keyPk)
          const h3 = await sendWhenFunded(() => kw.writeContract({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'approve', args: [ADDR.router, maxUint256], gas: GAS.approve, ...f }))
          if ((await pub.waitForTransactionReceipt({ hash: h3 })).status !== 'success') throw new Error('The raid key approval failed on chain.')
        } else if (fundedBlock > 0n) {
          await waitSpendable(fundedBlock)
        }
        nonce.current = null
        setStatus(null)
        await refresh()
        changed()
        notify.success('One-tap is ready! Every HIT is a single tap, in this raid and the next ones.')
        return true
      } catch (e) {
        setError(explainError(e))
        setStatus(null)
        return false
      }
    },
    [address, client, signTypedDataAsync, write, refresh, setError, setStatus],
  )

  /**
   * One hit. No wallet popup and no chain reads: the router allowance was set at setup, the gas
   * limit is fixed (rule 10) and fee/nonce are cached, so a burst of taps is a burst of sends only.
   *
   * A synchronous ledger of tUSDC and gas already committed by hits in flight stops a fast burst from
   * sending a hit the key can no longer pay for (that hit would be mined as a revert and burn gas).
   */
  const committed = useRef({ usdc: 0n, gas: 0n })
  const tap = useCallback(
    async (amount: bigint) => {
      if (!pass || !wallet || !account) return null
      setError(null)
      const cost = HIT_GAS * (feeRef.current?.maxFeePerGas ?? 130_000_000_000n)
      const c = committed.current
      if (balRef.current.usdc - c.usdc < amount) {
        setError(c.usdc > 0n ? 'Your raid key has no tUSDC left after the hits in flight. Top it up to keep hitting.' : 'Your raid key is out of tUSDC. Top it up (one popup) to keep hitting.')
        return null
      }
      if (balRef.current.mon - c.gas < cost) {
        setError('Your raid key is low on MON for gas. Top it up (one popup) and keep hitting.')
        return null
      }
      c.usdc += amount
      c.gas += cost
      const release = () => {
        c.usdc -= amount
        c.gas -= cost
      }
      try {
        if (nonce.current === null) nonce.current = await pub.getTransactionCount({ address: account.address, blockTag: 'pending' })
        const seat = { kind: 1, holder: pass.holder, tokenId: BigInt(pass.tokenId), humanId: zeroHash, expiry: BigInt(pass.expiry), sig: pass.sig }
        const args = [BigInt(raidId), amount, seat] as const
        const f = feeRef.current ?? (await fees())
        setInflight((n) => n + 1)
        const hash = await wallet.writeContract({ address: ADDR.router, abi: ROUTER_ABI, functionName: 'raid', args, gas: HIT_GAS, nonce: nonce.current++, ...f })
        void pub.waitForTransactionReceipt({ hash }).then(async (r) => {
          setInflight((n) => n - 1)
          if (r.status === 'success') setHits((h) => h + 1)
          else setError('That hit reverted on chain.')
          // Hand the amount back to the ledger only once the balance read reflects the spend.
          await refresh()
          release()
        }, release)
        return hash
      } catch (e) {
        release()
        nonce.current = null
        setInflight((n) => Math.max(0, n - 1))
        setError(explainError(e))
        return null
      }
    },
    [pass, wallet, account, raidId, refresh, setError],
  )

  /**
   * Fill the raid key's gas back up to the full budget (about 8 hits + claim), whatever it holds now.
   * One wallet popup, a plain MON transfer.
   */
  const fillGas = useCallback(async () => {
    if (!address || !client || !account) return false
    setError(null)
    try {
      const f = await fees()
      const want = gasBudget(f.maxFeePerGas)
      const have = await pub.getBalance({ address: account.address })
      if (have >= want) {
        notify.info('Your raid key already has a full tank of gas.')
        return true
      }
      const need = want - have
      const w = await pub.getBalance({ address })
      if (w < need + 21_000n * f.maxFeePerGas * 3n) throw new Error(`Your wallet needs about ${fmtUnits(need, 18, 2)} MON to fill the raid key's gas.`)
      setStatus('Send MON for gas to your raid key')
      const { sendTransaction } = await import('wagmi/actions')
      const { wagmiConfig } = await import('./wagmi')
      const h = await sendTransaction(wagmiConfig, { to: account.address, value: need, gas: 21_000n })
      const r = await client.waitForTransactionReceipt({ hash: h })
      if (r.status !== 'success') throw new Error('The MON transfer to your raid key failed on chain.')
      await waitSpendable(r.blockNumber)
      nonce.current = null
      setStatus(null)
      await refresh()
      changed()
      notify.success(`Gas topped up: +${fmtUnits(need, 18, 2)} MON on your raid key.`)
      return true
    } catch (e) {
      setStatus(null)
      setError(explainError(e))
      return false
    }
  }, [address, client, account, refresh, setError, setStatus])

  /**
   * Claim / exit from the raid key (the seat is bound to it). Monad bills limit x maxFee up front, so
   * if the key cannot cover that, the holder's wallet tops it up with exactly the gap. The tSTAR and
   * prize land on the key; they go back to the wallet with "Return to wallet".
   */
  const keyCall = useCallback(
    async (fn: 'claim' | 'exitEarly') => {
      if (!wallet || !account || !client) return false
      setError(null)
      try {
        const f = await fees()
        const need = (GAS.claim + 3n * GAS.approve + 21_000n) * f.maxFeePerGas
        const have = await pub.getBalance({ address: account.address })
        if (have < need) {
          setStatus('Topping up your raid key with a little MON for the claim')
          const { sendTransaction } = await import('wagmi/actions')
          const { wagmiConfig } = await import('./wagmi')
          const h0 = await sendTransaction(wagmiConfig, { to: account.address, value: need - have, gas: 21_000n })
          await waitSpendable((await client.waitForTransactionReceipt({ hash: h0 })).blockNumber)
        }
        setStatus(fn === 'claim' ? 'Opening the chest' : 'Exiting early')
        const hash = await sendWhenFunded(() => wallet.writeContract({ address: ADDR.router, abi: ROUTER_ABI, functionName: fn, args: [BigInt(raidId)], gas: GAS.claim, ...f }))
        const r = await pub.waitForTransactionReceipt({ hash })
        setStatus(null)
        nonce.current = null
        if (r.status !== 'success') setError('The claim reverted on chain.')
        await refresh()
        return r.status === 'success'
      } catch (e) {
        setStatus(null)
        setError(explainError(e))
        return false
      }
    },
    [wallet, account, client, raidId, refresh, setError, setStatus],
  )

  /**
   * `all`: send the key's tUSDC, tSTAR and MON to the wallet (one-tap then needs a top-up).
   * Otherwise only the tSTAR goes home; tUSDC (incl. a prize) and MON stay for the next raid.
   */
  const sweep = useCallback(
    async (all = true) => {
      if (!pk || !address) return false
      setError(null)
      try {
        setStatus(all ? 'Returning everything to your wallet' : 'Sending your tSTAR to your wallet')
        await sweepKey(pk, address, { starOnly: !all })
        nonce.current = null
        setStatus(null)
        await refresh()
        changed()
        notify.success(all ? 'Everything is back in your wallet.' : 'Your tSTAR is in your wallet. The raid key keeps its tUSDC and gas for the next raid.')
        return true
      } catch (e) {
        setStatus(null)
        setError(explainError(e))
        return false
      }
    },
    [pk, address, refresh, setError, setStatus],
  )

  // Keys from the old one-key-per-raid design may still hold funds: offer to send them back.
  const [stranded, setStranded] = useState<Hex[]>([])
  const findStranded = useCallback(async () => {
    if (!address) return setStranded([])
    const found: Hex[] = []
    for (const old of legacyKeys(address)) {
      if (old === pk) continue
      const b = await balancesOf(privateKeyToAccount(old).address).catch(() => null)
      if (!b) {
        found.push(old) // unknown right now (RPC busy): keep it, never forget a key that might hold funds
        continue
      }
      if (b.usdc > 0n || b.star > 0n || b.mon > 21_000n * 200_000_000_000n) found.push(old)
      else forgetLegacy(address, old)
    }
    setStranded(found)
  }, [address, pk])
  useEffect(() => void findStranded(), [findStranded])
  const recover = useCallback(async () => {
    if (!address) return false
    setError(null)
    try {
      setStatus('Returning funds from an old raid key')
      for (const old of stranded) {
        await sweepKey(old, address)
        forgetLegacy(address, old)
      }
      setStatus(null)
      notify.success('Funds returned to your wallet.')
      await findStranded()
      return true
    } catch (e) {
      setStatus(null)
      setError(explainError(e))
      return false
    }
  }, [address, stranded, findStranded, setError, setStatus])

  /** Drop the seat pass (the key and its funds stay; setup signs a new pass next time). */
  const forget = useCallback(() => {
    if (address) keys.dropPass(address)
    setPass(null)
  }, [address])

  /** Sign a fresh 7-day seat pass for the same key (nothing is sent). */
  const renew = useCallback(
    async (tokenId: string) => {
      if (!address) return false
      setError(null)
      try {
        const keyPk = keys.ensure(address)
        setPk(keyPk)
        const expiry = BigInt(Math.floor(Date.now() / 1000) + PASS_TTL)
        setStatus('Sign the new seat pass in your wallet')
        const sig = await signTypedDataAsync({
          domain: { name: 'StarRaid SeatGate', version: '1', chainId: CHAIN_ID, verifyingContract: ADDR.seatGate },
          types: { Bind: [{ name: 'holder', type: 'address' }, { name: 'player', type: 'address' }, { name: 'expiry', type: 'uint64' }] },
          primaryType: 'Bind',
          message: { holder: address, player: privateKeyToAccount(keyPk).address, expiry },
        })
        const p = { pk: keyPk, holder: address, tokenId, expiry: expiry.toString(), sig }
        keys.savePass(p)
        setPass(p)
        setStatus(null)
        notify.success('Seat pass renewed for 7 days.')
        return true
      } catch (e) {
        setStatus(null)
        setError(explainError(e))
        return false
      }
    },
    [address, signTypedDataAsync, setError, setStatus],
  )

  const minGas = HIT_GAS * (feeRef.current?.maxFeePerGas ?? 130_000_000_000n)
  /** Ready to hit with no popup: valid pass, router approved, tUSDC and gas for at least one hit. */
  const ready = passValid && allowance > 0n && usdc > 0n && mon >= minGas

  return {
    /** The seat pass when valid for the connected wallet (kept name for callers). */
    session: passValid ? pass : null,
    ready,
    passValid,
    hasKey: !!pk,
    allowance,
    minGas,
    refresh,
    renew,
    keyAddress: account?.address,
    usdc,
    star,
    mon,
    passExpiry: pass ? Number(pass.expiry) : null,
    arm,
    tap,
    sweep,
    keyCall,
    fillGas,
    gasFull: mon >= gasBudget(feeRef.current?.maxFeePerGas ?? 127_000_000_000n) * 95n / 100n,
    gasPct: Math.min(100, Number((mon * 100n) / (gasBudget(feeRef.current?.maxFeePerGas ?? 127_000_000_000n) || 1n))),
    forget,
    status,
    error,
    inflight,
    hits,
    stranded,
    recover,
  }
}
