import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { type Hex, zeroHash } from 'viem'
import { usePublicClient, useReadContract, useReadContracts, useConnection, useWriteContract } from 'wagmi'
import { ADDR } from './config'
import { ERC20_ABI, GAS, ROUTER_ABI, GATE_ABI, STARS_ABI, explainError, raidGasLimit } from './contracts'
import { notify } from './toast'

/** The connected wallet's seat in a raid, its escrow and prize share (all read from chain). */
export function usePlayerSeat(raidId: string, player?: Hex) {
  const conn = useConnection()
  const address = player ?? conn.address
  const id = BigInt(raidId)
  const seatKey = useReadContract({
    address: ADDR.seatGate,
    abi: GATE_ABI,
    functionName: 'playerSeat',
    args: [id, address!],
    query: { enabled: !!address, refetchInterval: 4000 },
  })
  const key = seatKey.data as Hex | undefined
  const hasSeat = !!key && key !== zeroHash
  const reads = useReadContracts({
    contracts: [
      { address: ADDR.router, abi: ROUTER_ABI, functionName: 'seatOf', args: [id, key ?? zeroHash] },
      { address: ADDR.router, abi: ROUTER_ABI, functionName: 'prizeOf', args: [id, key ?? zeroHash] },
    ],
    query: { enabled: hasSeat, refetchInterval: 4000 },
  })
  const seat = reads.data?.[0]?.result as readonly [Hex, bigint, bigint, boolean] | undefined
  const prize = reads.data?.[1]?.result as bigint | undefined
  return {
    address,
    seatKey: hasSeat ? key : undefined,
    escrowBase: seat?.[1],
    done: seat?.[3],
    prize,
    refetch: () => {
      void seatKey.refetch()
      void reads.refetch()
    },
  }
}

/** Wallet balances and Stars owned (test collection: scan ids below nextId, small on testnet). */
export function useWalletKit() {
  const { address } = useConnection()
  const reads = useReadContracts({
    contracts: [
      { address: ADDR.quote, abi: ERC20_ABI, functionName: 'balanceOf', args: [address!] },
      { address: ADDR.quote, abi: ERC20_ABI, functionName: 'allowance', args: [address!, ADDR.router] },
      { address: ADDR.lilStars, abi: STARS_ABI, functionName: 'balanceOf', args: [address!] },
      { address: ADDR.lilStars, abi: STARS_ABI, functionName: 'nextId', args: [] },
      { address: ADDR.base, abi: ERC20_ABI, functionName: 'balanceOf', args: [address!] },
    ],
    query: { enabled: !!address, refetchInterval: 6000 },
  })
  const usdc = reads.data?.[0]?.result as bigint | undefined
  const allowance = reads.data?.[1]?.result as bigint | undefined
  const starCount = reads.data?.[2]?.result as bigint | undefined
  const nextId = (reads.data?.[3]?.result as bigint | undefined) ?? 0n
  /** tSTAR in the wallet: where claimed raid loot lands. */
  const star = reads.data?.[4]?.result as bigint | undefined
  const scanFrom = nextId > 200n ? nextId - 200n : 0n
  const ids = Array.from({ length: Number(nextId - scanFrom) }, (_, i) => scanFrom + BigInt(i))
  const owners = useReadContracts({
    contracts: ids.map((i) => ({ address: ADDR.lilStars, abi: STARS_ABI, functionName: 'ownerOf', args: [i] }) as const),
    query: { enabled: !!address && !!starCount && starCount > 0n, refetchInterval: 15000 },
  })
  const myStars = ids.filter((_, i) => (owners.data?.[i]?.result as string | undefined)?.toLowerCase() === address?.toLowerCase()).map(String)
  return {
    address,
    usdc,
    star,
    allowance,
    myStars,
    loading: reads.isLoading,
    refetch: () => {
      void reads.refetch()
      void owners.refetch()
    },
  }
}

type Step = { label: string; state: 'todo' | 'doing' | 'done' | 'error' }

/** Runs a short list of wallet transactions and reports progress like a quest log. */
export function useTxRunner() {
  const client = usePublicClient()
  const { mutateAsync } = useWriteContract()
  const qc = useQueryClient()
  const [steps, setSteps] = useState<Step[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = useCallback(
    async (jobs: { label: string; send: () => Promise<Hex> }[]) => {
      setError(null)
      setBusy(true)
      setSteps(jobs.map((j) => ({ label: j.label, state: 'todo' })))
      try {
        for (let i = 0; i < jobs.length; i++) {
          setSteps((s) => s.map((x, k) => (k === i ? { ...x, state: 'doing' } : x)))
          const hash = await jobs[i].send()
          const r = await client!.waitForTransactionReceipt({ hash })
          if (r.status !== 'success') throw new Error('The transaction reverted on chain.')
          setSteps((s) => s.map((x, k) => (k === i ? { ...x, state: 'done' } : x)))
        }
        await qc.invalidateQueries()
        return true
      } catch (e) {
        setSteps((s) => s.map((x) => (x.state === 'doing' ? { ...x, state: 'error' } : x)))
        const m = explainError(e)
        setError(m)
        notify.error(m)
        return false
      } finally {
        setBusy(false)
      }
    },
    [client, qc],
  )

  return { run, steps, error, busy, reset: () => (setSteps([]), setError(null)), write: mutateAsync, client }
}

export function useActions() {
  const tx = useTxRunner()
  const { address } = useConnection()

  /** Testnet setup: anyone can mint a test Star and test USDC. */
  const getTestKit = (needStar: boolean, needUsdc: boolean) =>
    tx.run([
      ...(needStar ? [{ label: 'Mint a test Lil Star', send: () => tx.write({ address: ADDR.lilStars, abi: STARS_ABI, functionName: 'mint', args: [address!], gas: GAS.mint }) }] : []),
      ...(needUsdc ? [{ label: 'Mint 50 test USDC', send: () => tx.write({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'mint', args: [address!, 50_000_000n], gas: GAS.mint }) }] : []),
    ])

  /** Approve exactly the chosen amount (never more), then raid with an explicit gas limit. */
  const raid = async (raidId: string, quoteIn: bigint, tokenId: string | null, allowance: bigint) => {
    const seat = tokenId
      ? { kind: 1, holder: address!, tokenId: BigInt(tokenId), humanId: zeroHash, expiry: 0n, sig: '0x' as Hex }
      : { kind: 0, holder: '0x0000000000000000000000000000000000000000' as Hex, tokenId: 0n, humanId: zeroHash, expiry: 0n, sig: '0x' as Hex }
    const args = [BigInt(raidId), quoteIn, seat] as const
    return tx.run([
      ...(allowance < quoteIn
        ? [{ label: `Approve exactly this amount`, send: () => tx.write({ address: ADDR.quote, abi: ERC20_ABI, functionName: 'approve', args: [ADDR.router, quoteIn], gas: GAS.approve }) }]
        : []),
      {
        label: 'Hit the wall',
        send: async () => {
          let estimate: bigint | undefined
          try {
            estimate = await tx.client!.estimateContractGas({ address: ADDR.router, abi: ROUTER_ABI, functionName: 'raid', args, account: address! })
          } catch (e) {
            // A revert here is the contract refusing: surface its reason instead of sending.
            throw e
          }
          return tx.write({ address: ADDR.router, abi: ROUTER_ABI, functionName: 'raid', args, gas: raidGasLimit(0, estimate) })
        },
      },
    ])
  }

  const claim = (raidId: string) => tx.run([{ label: 'Open the chest', send: () => tx.write({ address: ADDR.router, abi: ROUTER_ABI, functionName: 'claim', args: [BigInt(raidId)], gas: GAS.claim }) }])
  const exitEarly = (raidId: string) => tx.run([{ label: 'Exit early', send: () => tx.write({ address: ADDR.router, abi: ROUTER_ABI, functionName: 'exitEarly', args: [BigInt(raidId)], gas: GAS.exitEarly }) }])

  return { ...tx, getTestKit, raid, claim, exitEarly }
}
