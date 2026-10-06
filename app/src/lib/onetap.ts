import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPublicClient, createWalletClient, http, parseEther, zeroHash, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { monadTestnet } from 'viem/chains'
import { useConnection, useSignTypedData, useWriteContract, usePublicClient } from 'wagmi'
import { ADDR, CHAIN_ID, RPC_URL } from './config'
import { ERC20_ABI, GAS, ROUTER_ABI, explainError, raidGasLimit } from './contracts'

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
const GAS_MON = parseEther('0.6') // ~ (1.2M gas x 102 gwei) x 4 hits, testnet MON
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

const pub = createPublicClient({ chain: monadTestnet, transport: http(RPC_URL) })

export function useOneTap(raidId: string) {
  const { address } = useConnection()
  const [session, setSession] = useState<Session | null>(() => store.load(raidId))
  const [usdc, setUsdc] = useState<bigint>(0n)
  const [mon, setMon] = useState<bigint>(0n)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inflight, setInflight] = useState(0)
  const [hits, setHits] = useState(0)
  const nonce = useRef<number | null>(null)
  const { signTypedDataAsync } = useSignTypedData()
  const { mutateAsync: write } = useWriteContract()
  const client = usePublicClient()

  const account = useMemo(() => (session ? privateKeyToAccount(session.pk) : null), [session])
  const wallet = useMemo(() => (account ? createWalletClient({ account, chain: monadTestnet, transport: http(RPC_URL) }) : null), [account])
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
    const i = setInterval(refresh, 4000)
    return () => clearInterval(i)
  }, [refresh])

  /** One signature + two funding txs from the holder's wallet. */
  const arm = useCallback(
    async (tokenId: string, budget: bigint) => {
      if (!address || !client) return false
      setError(null)
      try {
        const pk = generatePrivateKey()
        const acct = privateKeyToAccount(pk)
        const expiry = BigInt(Math.floor(Date.now() / 1000) + BIND_TTL)
        setStatus('Sign the seat pass in your wallet')
        const sig = await signTypedDataAsync({
          domain: { name: 'StarRaid SeatGate', version: '1', chainId: CHAIN_ID, verifyingContract: ADDR.seatGate },
          types: { Bind: [{ name: 'holder', type: 'address' }, { name: 'player', type: 'address' }, { name: 'expiry', type: 'uint64' }] },
          primaryType: 'Bind',
          message: { holder: address, player: acct.address, expiry },
        })
        setStatus('Send tUSDC to your raid key')
        const h1 = await write({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'transfer', args: [acct.address, budget], gas: GAS.approve })
        await client.waitForTransactionReceipt({ hash: h1 })
        setStatus('Send a little MON for gas')
        const { sendTransaction } = await import('wagmi/actions')
        const { wagmiConfig } = await import('./wagmi')
        const h2 = await sendTransaction(wagmiConfig, { to: acct.address, value: GAS_MON, gas: 21_000n })
        await client.waitForTransactionReceipt({ hash: h2 })
        const s: Session = { pk, address: acct.address, holder: address, tokenId, raidId, expiry: expiry.toString(), sig }
        store.save(s)
        setSession(s)
        nonce.current = null
        setStatus(null)
        return true
      } catch (e) {
        setError(explainError(e))
        setStatus(null)
        return false
      }
    },
    [address, client, raidId, signTypedDataAsync, write],
  )

  /** One hit. No wallet popup. Nonces are tracked locally so taps can be fired back to back. */
  const tap = useCallback(
    async (amount: bigint) => {
      if (!session || !wallet || !account) return null
      setError(null)
      try {
        if (nonce.current === null) nonce.current = await pub.getTransactionCount({ address: account.address, blockTag: 'pending' })
        const allowance = (await pub.readContract({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'allowance', args: [account.address, ADDR.router] })) as bigint
        if (allowance < amount) {
          // Scope: the router, for exactly what the key holds. A leaked key cannot spend more.
          const bal = (await pub.readContract({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] })) as bigint
          await wallet.writeContract({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'approve', args: [ADDR.router, bal], gas: GAS.approve, nonce: nonce.current++ })
        }
        const seat = { kind: 1, holder: session.holder, tokenId: BigInt(session.tokenId), humanId: zeroHash, expiry: BigInt(session.expiry), sig: session.sig }
        const args = [BigInt(raidId), amount, seat] as const
        let estimate: bigint | undefined
        try {
          estimate = await pub.estimateContractGas({ address: ADDR.router, abi: ROUTER_ABI, functionName: 'raid', args, account })
        } catch (e) {
          // the first hit after an approve in the same burst can't be estimated yet; use the floor
          if (!/allowance|ERC20InsufficientAllowance/i.test(String(e))) throw e
        }
        setInflight((n) => n + 1)
        const hash = await wallet.writeContract({ address: ADDR.router, abi: ROUTER_ABI, functionName: 'raid', args, gas: raidGasLimit(1, estimate), nonce: nonce.current++ })
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
    [session, wallet, account, raidId, refresh],
  )

  /** Claim / exit from the raid key (the seat is bound to it). */
  const keyCall = useCallback(
    async (fn: 'claim' | 'exitEarly') => {
      if (!wallet) return false
      try {
        const hash = await wallet.writeContract({ address: ADDR.router, abi: ROUTER_ABI, functionName: fn, args: [BigInt(raidId)], gas: GAS.claim })
        const r = await pub.waitForTransactionReceipt({ hash })
        return r.status === 'success'
      } catch (e) {
        setError(explainError(e))
        return false
      }
    },
    [wallet, raidId],
  )

  /** Return every tUSDC, tSTAR and MON on the raid key to the holder. */
  const sweep = useCallback(async () => {
    if (!wallet || !account || !session) return false
    setError(null)
    try {
      setStatus('Returning leftovers to your wallet')
      for (const token of [ADDR.quote, ADDR.base]) {
        const bal = (await pub.readContract({ address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] })) as bigint
        if (bal > 0n) {
          const h = await wallet.writeContract({ address: token, abi: ERC20_ABI, functionName: 'transfer', args: [session.holder, bal], gas: GAS.approve })
          await pub.waitForTransactionReceipt({ hash: h })
        }
      }
      const gasPrice = await pub.getGasPrice()
      const fee = 21_000n * gasPrice * 2n
      const mon = await pub.getBalance({ address: account.address })
      if (mon > fee) {
        const h = await wallet.sendTransaction({ to: session.holder, value: mon - fee, gas: 21_000n, maxFeePerGas: gasPrice * 2n, maxPriorityFeePerGas: gasPrice / 50n })
        await pub.waitForTransactionReceipt({ hash: h })
      }
      setStatus(null)
      await refresh()
      return true
    } catch (e) {
      setStatus(null)
      setError(explainError(e))
      return false
    }
  }, [wallet, account, session, refresh])

  const forget = useCallback(() => {
    store.clear(raidId)
    setSession(null)
  }, [raidId])

  return { session: valid ? session : null, keyAddress: account?.address, usdc, mon, arm, tap, sweep, keyCall, forget, status, error, inflight, hits }
}
