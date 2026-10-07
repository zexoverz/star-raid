import { staticFile } from 'remotion'

/**
 * Asset slots. Every visual the video uses goes through here, so a GPT-generated replacement is a
 * one-line change: drop the file in `public/gen/` and point the slot at `gen/<file>`.
 * Defaults reuse the app's own art (`public/art` is a symlink to `app/public/art`).
 * See `ASSETS.md` for the prompt to use for each slot.
 */
export const SLOTS = {
  // backgrounds (16:9, 1920x1080 or larger)
  heroBg: 'art/hero_scene.webp',
  arenaBg: 'art/raid_bg.webp',
  stageBg: 'art/spotlight_stage.webp',
  lobbyBg: 'art/lobby_bg.webp',
  shareBg: 'art/share_bg.webp',
  brick: 'art/brick_wall.svg',

  // brand
  wordmark: 'art/wordmark.svg',
  wordmarkH: 'art/wordmark-h.svg',

  // props
  wall: 'art/wall_boss.webp',
  wallHurt: 'art/wall_boss_hurt.webp',
  wallKo: 'art/wall_boss_ko.webp',
  flag: 'art/flag_sponsor.webp',
  trophy: 'art/trophy.webp',
  burst: 'art/victory_burst.webp',
  spark: 'art/hit_spark.webp',
  dice: 'art/dice_block.webp',
  orb: 'art/orb.webp',
  chestClosed: 'art/chest_closed.webp',
  chestOpen: 'art/chest_open.webp',
  lock: 'art/lock.webp',
  seatTicket: 'art/seat_ticket.webp',
  shield: 'art/shield.webp',
  hourglass: 'art/hourglass.webp',
  coin: 'art/coin.webp',
  bot: 'art/bot.webp',
  medalGold: 'art/medal_gold.webp',
  usdc: 'tokens/usdc.svg',

  // optional soundtrack: drop an mp3 in public/audio and set e.g. 'audio/theme.mp3'
  music: null as string | null,
} as const

export type Slot = keyof typeof SLOTS
export const src = (slot: Slot) => staticFile(SLOTS[slot] as string)
export const file = (path: string) => staticFile(path)

/** Lil Stars crew event poses (D35), same files the app uses. */
export type Who = 'fox' | 'chog' | 'bunny' | 'bear'
export type Pose = 'attack' | 'cheer' | 'sad' | 'think' | 'watch' | 'wait'
const POSES: Record<Who, Partial<Record<Pose, string>>> = {
  fox: { attack: 'fox_attack', cheer: 'fox_cheer', think: 'fox_think', wait: 'fox_think', watch: 'fox_think', sad: 'fox_think' },
  chog: { attack: 'chog_attack', cheer: 'chog_cheer', wait: 'chog_wait', think: 'chog_wait', watch: 'chog_wait', sad: 'chog_wait' },
  bunny: { attack: 'bunny_attack', cheer: 'bunny_cheer', watch: 'bunny_watch', think: 'bunny_cheer', wait: 'bunny_watch', sad: 'bunny_watch' },
  bear: { attack: 'bear_attack', cheer: 'bear_cheer', sad: 'bear_sad', think: 'bear_attack', wait: 'bear_attack', watch: 'bear_sad' },
}
export const CREW: Record<Who, { name: string; color: string }> = {
  fox: { name: 'Foxstar', color: '#F7C873' },
  chog: { name: 'Chogstar', color: '#A3E3C1' },
  bunny: { name: 'Bunnystar', color: '#F7B2D9' },
  bear: { name: 'Bearstar', color: '#B6D6F7' },
}
export const pose = (who: Who, p: Pose) => staticFile(`art/crew/${POSES[who][p]}.webp`)

/** Unaltered Lil Stars collection art for the seat token ids in the snapshotted raids (rule 17). */
export const star = (tokenId: string) => staticFile(`lilstars/${tokenId}.webp`)
