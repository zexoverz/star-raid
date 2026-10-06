import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPublicClient, createWalletClient, http, zeroHash, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { monadTestnet } from 'viem/chains'
import { useConnection, useSignTypedData, useWriteContract, usePublicClient } from 'wagmi'
import { ADDR, CHAIN_ID, RPC_URL } from './config'
import { ERC20_ABI, GAS, ROUTER_ABI, explainError, raidGasLimit } from './contracts'
import { notify } from './toast'

/**
 * One-tap raiding.
 *
 * Arming: the browser makes a throwaway raid key that lives only in this tab's memory (sessionStorage,
 * never sent anywhere). The Star holder signs one EIP-712 `Bind{holder, player: raidKey, expiry}` so
 * the raid key can play the holder's seat (SeatGate kind 1 with sig). The holder then funds the raid
 * key with exactly the tUSDC they chose to commit plus a little MON for gas.
 *
 * Tapping: each tap is one `router.raid` sent by the raid key with an explicit gas limit, no wallet
 * popup. The key approves the router for exactly its funded tUSDC once (scope: router + allowance).
 *
 * Sweep: leftover tUSDC and MON go back to the holder. The seat (and the bought tSTAR in escrow) is
 * bound to the raid key for this raid, so claims for a one-tap seat are sent from the same key; the
 * sweep after claim returns everything to the holder.
 */
const BIND_TTL = 60 * 60 // seconds

export interface Session {
  pk: Hex
  address: Hex
  holder: Hex
  tokenId: string
  raidId: string
  expiry: string
  sig: Hex
}

const store = {
  key: (raidId: string) => `sr-session-${raidId}`,
  load(raidId: string): Session | null {
    try {
      const s = sessionStorage.getItem(this.key(raidId))
      return s ? (JSON.parse(s) as Session) : null
    } catch {
      return null
    }
  },
  save(s: Session) {
    sessionStorage.setItem(this.key(s.raidId), JSON.stringify(s))
  },
  clear(raidId: string) {
    sessionStorage.removeItem(this.key(raidId))
  },
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
  const base = (await pub.getBlock()).baseFeePerGas ?? 100_000_000_000n
  const tip = 2_000_000_000n
  return { maxFeePerGas: (base * 5n) / 4n + tip, maxPriorityFeePerGas: tip }
}
/** A hit's gas limit (rule 10): measured testnet estimate for a seated hit is ~823-865k, x1.5 padded. */
const HIT_GAS = raidGasLimit(1, 865_000n)
/** MON to send the key: enough for ~8 hits at a 1.25x base fee plus the approve and the sweep. */
const KEY_HITS = 8n

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

/**
 * A key created by arm() is kept here before any funds move, so a failed arm (or a closed tab) resumes
 * the same key instead of stranding its funds. localStorage on purpose: it can hold funds.
 */
const pending = {
  key: (raidId: string, holder: string) => `starraid.pending.${raidId}.${holder.toLowerCase()}`,
  load: (raidId: string, holder: string) => localStorage.getItem(pending.key(raidId, holder)) as Hex | null,
  save: (raidId: string, holder: string, pk: Hex) => localStorage.setItem(pending.key(raidId, holder), pk),
  clear: (raidId: string, holder: string) => localStorage.removeItem(pending.key(raidId, holder)),
  all(holder: string) {
    const out: { raidId: string; pk: Hex }[] = []
    const suffix = `.${holder.toLowerCase()}`
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('starraid.pending.') && k.endsWith(suffix)) out.push({ raidId: k.slice(17, -suffix.length), pk: localStorage.getItem(k) as Hex })
    }
    return out
  },
}

/** Send every tUSDC, tSTAR and MON on a raid key to `to`. */
async function sweepKey(pk: Hex, to: Hex) {
  const acct = privateKeyToAccount(pk)
  const wallet = createWalletClient({ account: acct, chain: monadTestnet, transport: http(RPC_URL, { retryCount: 4, retryDelay: 400 }) })
  const f = await fees()
  for (const token of [ADDR.quote, ADDR.base]) {
    const bal = (await pub.readContract({ address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [acct.address] })) as bigint
    if (bal > 0n) {
      const h = await sendWhenFunded(() => wallet.writeContract({ address: token, abi: ERC20_ABI, functionName: 'transfer', args: [to, bal], gas: GAS.approve, ...f }))
      await pub.waitForTransactionReceipt({ hash: h })
    }
  }
  const fee = 21_000n * f.maxFeePerGas
  const mon = await pub.getBalance({ address: acct.address })
  if (mon > fee) {
    const h = await sendWhenFunded(() => wallet.sendTransaction({ to, value: mon - fee, gas: 21_000n, ...f }))
    await pub.waitForTransactionReceipt({ hash: h })
  }
}

export function useOneTap(raidId: string) {
  const { address } = useConnection()
  const [session, setSession] = useState<Session | null>(() => store.load(raidId))
  const [usdc, setUsdc] = useState<bigint>(0n)
  const [mon, setMon] = useState<bigint>(0n)
  const [status, setStatusRaw] = useState<string | null>(null)
  const [error, setErrorRaw] = useState<string | null>(null)
  // Errors pop a Lil Stars toast; long steps show a "working on it" toast that the next step replaces.
  const setError = useCallback((m: string | null) => {
    setErrorRaw(m)
    if (m) notify.error(m, { id: `onetap-err-${raidId}` })
  }, [raidId])
  const setStatus = useCallback((m: string | null) => {
    setStatusRaw(m)
    if (m) notify.loading(m, { id: `onetap-status-${raidId}` })
    else notify.dismiss(`onetap-status-${raidId}`)
  }, [raidId])
  const [inflight, setInflight] = useState(0)
  const [hits, setHits] = useState(0)
  const nonce = useRef<number | null>(null)
  const { signTypedDataAsync } = useSignTypedData()
  const { mutateAsync: write } = useWriteContract()
  const client = usePublicClient()

  const account = useMemo(() => (session ? privateKeyToAccount(session.pk) : null), [session])
  const wallet = useMemo(() => (account ? createWalletClient({ account, chain: monadTestnet, transport: http(RPC_URL, { retryCount: 4, retryDelay: 400 }) }) : null), [account])
  const valid = !!session && !!address && session.holder.toLowerCase() === address.toLowerCase() && Number(session.expiry) > Date.now() / 1000

  const refresh = useCallback(async () => {
    if (!account) return
    const [u, m] = await Promise.all([
      pub.readContract({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }) as Promise<bigint>,
      pub.getBalance({ address: account.address }),
    ])
    setUsdc(u)
    setMon(m)
  }, [account])

  useEffect(() => {
    void refresh()
    const i = setInterval(refresh, 8000)
    return () => clearInterval(i)
  }, [refresh])

  // Hits read nothing from the chain: fee and nonce are prepared once and refreshed in the background.
  const feeRef = useRef<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } | null>(null)
  useEffect(() => {
    if (!account) return
    const load = () => void fees().then((f) => (feeRef.current = f)).catch(() => {})
    load()
    const i = setInterval(load, 15_000)
    return () => clearInterval(i)
  }, [account])

  /** One signature + two funding txs from the holder's wallet. */
  const arm = useCallback(
    async (tokenId: string, budget: bigint) => {
      if (!address || !client) return false
      setError(null)
      try {
        // Resume a key from an earlier arm that did not finish, so its funds are never stranded.
        const pk = pending.load(raidId, address) ?? generatePrivateKey()
        pending.save(raidId, address, pk)
        const acct = privateKeyToAccount(pk)
        const expiry = BigInt(Math.floor(Date.now() / 1000) + BIND_TTL)
        setStatus('Sign the seat pass in your wallet')
        const sig = await signTypedDataAsync({
          domain: { name: 'StarRaid SeatGate', version: '1', chainId: CHAIN_ID, verifyingContract: ADDR.seatGate },
          types: { Bind: [{ name: 'holder', type: 'address' }, { name: 'player', type: 'address' }, { name: 'expiry', type: 'uint64' }] },
          primaryType: 'Bind',
          message: { holder: address, player: acct.address, expiry },
        })
        const [haveUsdc, haveMon] = await Promise.all([
          pub.readContract({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'balanceOf', args: [acct.address] }) as Promise<bigint>,
          pub.getBalance({ address: acct.address }),
        ])
        if (haveUsdc < budget) {
          setStatus('Send tUSDC to your raid key')
          const h1 = await write({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'transfer', args: [acct.address, budget - haveUsdc], gas: GAS.approve })
          await client.waitForTransactionReceipt({ hash: h1 })
        }
        const { sendTransaction } = await import('wagmi/actions')
        const { wagmiConfig } = await import('./wagmi')
        const f = await fees()
        const gasMon = (HIT_GAS * KEY_HITS + GAS.approve + 3n * GAS.approve + 21_000n) * f.maxFeePerGas
        let fundedBlock = 0n
        if (haveMon < gasMon / 2n) {
          setStatus('Send a little MON for gas')
          const h2 = await sendTransaction(wagmiConfig, { to: acct.address, value: gasMon - haveMon, gas: 21_000n })
          fundedBlock = (await client.waitForTransactionReceipt({ hash: h2 })).blockNumber
        }
        // Approve the router once, for exactly the budget, from the key. Taps then send only raid().
        setStatus('Getting your raid key ready')
        if (fundedBlock > 0n) await waitSpendable(fundedBlock)
        const keyWallet = createWalletClient({ account: acct, chain: monadTestnet, transport: http(RPC_URL, { retryCount: 4, retryDelay: 400 }) })
        const h3 = await sendWhenFunded(() => keyWallet.writeContract({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'approve', args: [ADDR.router, budget], gas: GAS.approve, ...f }))
        await pub.waitForTransactionReceipt({ hash: h3 })
        const s: Session = { pk, address: acct.address, holder: address, tokenId, raidId, expiry: expiry.toString(), sig }
        store.save(s)
        pending.clear(raidId, address)
        setSession(s)
        nonce.current = null
        setStatus(null)
        notify.success('One-tap armed! Every HIT is now a single tap.')
        return true
      } catch (e) {
        setError(explainError(e))
        setStatus(null)
        return false
      }
    },
    [address, client, raidId, signTypedDataAsync, write],
  )

  /**
   * One hit. No wallet popup and no chain reads: the router allowance was set at arm time, the gas
   * limit is fixed (rule 10) and fee/nonce are cached, so a burst of taps is a burst of sends only.
   */
  const tap = useCallback(
    async (amount: bigint) => {
      if (!session || !wallet || !account) return null
      setError(null)
      const cost = HIT_GAS * (feeRef.current?.maxFeePerGas ?? 130_000_000_000n)
      if (mon < cost * BigInt(inflight + 1)) {
        setError('Your raid key is low on MON for gas. Wait for the hits in flight, or return leftovers and arm again.')
        return null
      }
      try {
        if (nonce.current === null) nonce.current = await pub.getTransactionCount({ address: account.address, blockTag: 'pending' })
        const seat = { kind: 1, holder: session.holder, tokenId: BigInt(session.tokenId), humanId: zeroHash, expiry: BigInt(session.expiry), sig: session.sig }
        const args = [BigInt(raidId), amount, seat] as const
        const f = feeRef.current ?? (await fees())
        setInflight((n) => n + 1)
        const hash = await wallet.writeContract({ address: ADDR.router, abi: ROUTER_ABI, functionName: 'raid', args, gas: HIT_GAS, nonce: nonce.current++, ...f })
        void pub.waitForTransactionReceipt({ hash }).then((r) => {
          setInflight((n) => n - 1)
          if (r.status === 'success') setHits((h) => h + 1)
          else setError('That hit reverted on chain.')
          void refresh()
        })
        return hash
      } catch (e) {
        nonce.current = null
        setInflight((n) => Math.max(0, n - 1))
        setError(explainError(e))
        return null
      }
    },
    [session, wallet, account, raidId, refresh, mon, inflight],
  )

  /**
   * Claim / exit from the raid key (the seat is bound to it). Monad bills limit x maxFee up front, so
   * if the key cannot cover that after its hits, the holder's wallet tops it up with exactly the gap.
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
        if (r.status !== 'success') setError('The claim reverted on chain.')
        return r.status === 'success'
      } catch (e) {
        setStatus(null)
        setError(explainError(e))
        return false
      }
    },
    [wallet, account, client, raidId],
  )

  /** Return every tUSDC, tSTAR and MON on the raid key to the holder. */
  const sweep = useCallback(async () => {
    if (!wallet || !account || !session) return false
    setError(null)
    try {
      setStatus('Returning leftovers to your wallet')
      await sweepKey(session.pk, session.holder)
      setStatus(null)
      await refresh()
      return true
    } catch (e) {
      setStatus(null)
      setError(explainError(e))
      return false
    }
  }, [wallet, account, session, refresh])

  // Keys from an arm that never finished (any raid) still hold funds: offer to send them back.
  const [stranded, setStranded] = useState<{ raidId: string; pk: Hex }[]>([])
  const findStranded = useCallback(async () => {
    if (!address) return setStranded([])
    const found: { raidId: string; pk: Hex }[] = []
    for (const { raidId: r, pk } of pending.all(address)) {
      if (r === raidId && !session) continue // this raid's arm can still resume it
      const a = privateKeyToAccount(pk).address
      const [u, m] = await Promise.all([
        pub.readContract({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'balanceOf', args: [a] }) as Promise<bigint>,
        pub.getBalance({ address: a }),
      ])
      if (u > 0n || m > 21_000n * 200_000_000_000n) found.push({ raidId: r, pk })
      else pending.clear(r, address)
    }
    setStranded(found)
  }, [address, raidId, session])
  useEffect(() => void findStranded(), [findStranded])
  const recover = useCallback(async () => {
    if (!address) return false
    setError(null)
    try {
      setStatus('Returning funds from an unfinished raid key')
      for (const s of stranded) {
        await sweepKey(s.pk, address)
        pending.clear(s.raidId, address)
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
  }, [address, stranded, findStranded])

  const forget = useCallback(() => {
    store.clear(raidId)
    setSession(null)
  }, [raidId])

  return { session: valid ? session : null, keyAddress: account?.address, usdc, mon, arm, tap, sweep, keyCall, forget, status, error, inflight, hits, stranded, recover }
}
