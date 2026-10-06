import meta from './stars-meta.json'

/**
 * Lil Stars art is the Lil Stars team's work. We show it as-is (resized only, never altered).
 *
 * On testnet the seat registry is a mock collection with no art, so a mock token id is shown with a
 * real Lil Star from a bundled preview set, chosen by id. The UI labels these "preview art".
 * On mainnet the token id maps to its own art on IPFS.
 */
const META = meta as Record<string, { character: string; rarity: string }>
const PREVIEW_IDS = Object.keys(META)
const IPFS_IMG = 'https://gateway.pinata.cloud/ipfs/bafybeidmahvi2mlfn2gevjkhb4v2q4ourxon3yylqgakaesq6vpnooon6q'

export const IS_TESTNET = true

export interface StarArt {
  src: string
  full: string
  artId: string
  character: string
  rarity: string
  legendary: boolean
  preview: boolean
}

export function starArt(tokenId: string | null | undefined): StarArt | null {
  if (tokenId === null || tokenId === undefined) return null
  const artId = IS_TESTNET ? PREVIEW_IDS[Number(BigInt(tokenId) % BigInt(PREVIEW_IDS.length))] : tokenId
  const m = META[artId] ?? { character: 'Star', rarity: 'Common' }
  return {
    src: META[artId] ? `/stars/${artId}.webp` : `${IPFS_IMG}/${artId}.png`,
    full: `${IPFS_IMG}/${artId}.png`,
    artId,
    character: m.character,
    rarity: m.rarity,
    legendary: m.rarity === 'Legendary',
    preview: IS_TESTNET,
  }
}

export const STAR_NAMES: Record<string, string> = { Chogstar: 'Chogstar', Bunny: 'Bunnystar', Fox: 'Foxstar', Bear: 'Bearstar' }

/** Official mascot art from lilstars.xyz, for decoration. */
export const MASCOTS = [
  { name: 'Chogstar', src: '/art/lilstars/Chogstar.webp', color: '#A3E3C1' },
  { name: 'Bunnystar', src: '/art/lilstars/LilBunny.webp', color: '#F7B2D9' },
  { name: 'Foxstar', src: '/art/lilstars/LilFox.webp', color: '#F7C873' },
  { name: 'Bearstar', src: '/art/lilstars/LilMouse.webp', color: '#B6D6F7' },
]

export const PREVIEW_GALLERY = PREVIEW_IDS
