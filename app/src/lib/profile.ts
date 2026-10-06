import { useQuery } from '@tanstack/react-query'
import makeBlockie from 'ethereum-blockies-base64'
import { createPublicClient, fallback, http, type Address } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'
import { short } from './format'

/**
 * Player profile: ENS name and avatar from Ethereum mainnet when the address has a primary name,
 * otherwise a blockie and the short address. Display only, never used for anything that decides
 * money. Lookups are cached for the session and kept in localStorage for a day, so a party of 20
 * seats resolves once, not on every frame.
 */
const ens = createPublicClient({
  chain: mainnet,
  transport: fallback([http(import.meta.env.VITE_ENS_RPC_URL || 'https://ethereum-rpc.publicnode.com', { batch: true }), http('https://eth.drpc.org')]),
  batch: { multicall: true },
})

export interface Profile {
  name: string | null
  avatar: string | null
}

const TTL = 24 * 60 * 60 * 1000
const key = (a: string) => `ens:${a.toLowerCase()}`

function cached(a: string): Profile | undefined {
  try {
    const raw = localStorage.getItem(key(a))
    if (!raw) return undefined
    const { at, p } = JSON.parse(raw) as { at: number; p: Profile }
    return Date.now() - at < TTL ? p : undefined
  } catch {
    return undefined
  }
}

export async function lookupProfile(a: Address): Promise<Profile> {
  const name = await ens.getEnsName({ address: a }).catch(() => null)
  let avatar: string | null = null
  if (name) avatar = await ens.getEnsAvatar({ name: normalize(name) }).catch(() => null)
  const p = { name, avatar }
  try {
    localStorage.setItem(key(a), JSON.stringify({ at: Date.now(), p }))
  } catch {}
  return p
}

export function useProfile(address?: string | null) {
  const a = address?.toLowerCase() as Address | undefined
  const q = useQuery({
    queryKey: ['ens', a],
    queryFn: () => lookupProfile(a!),
    enabled: !!a,
    initialData: a ? cached(a) : undefined,
    staleTime: TTL,
    gcTime: TTL,
    retry: 1,
  })
  const blockie = a ? blockieOf(a) : null
  return {
    name: q.data?.name ?? null,
    label: q.data?.name ?? (a ? short(a) : ''),
    avatar: q.data?.avatar ?? null,
    blockie,
  }
}

const blockies = new Map<string, string>()
export function blockieOf(a: string) {
  let b = blockies.get(a)
  if (!b) blockies.set(a, (b = makeBlockie(a)))
  return b
}
