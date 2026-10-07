# Star Raid demo video (Remotion)

A ~37 s 1080p demo cut built from the app's own design: same tokens (`src/style.css` mirrors
`app/src/index.css`), same fonts (Gorditas, Gluten, Outfit), same art (`public/art` links to
`app/public/art`), same sound kit (`scripts/sfx.mjs` renders `app/src/lib/sfx.ts` to WAV).

```
pnpm install
pnpm dev                 # Remotion Studio, scrub every scene
pnpm render              # out/star-raid-demo.mp4
pnpm snapshot [ids…]     # refresh src/data/raid-<id>.json from the live service
pnpm sfx                 # rebuild public/audio/sfx/*.wav
```

## Cut

| # | Scene | Frames | What it shows |
|---|---|---|---|
| 1 | `Hook` | 120 | hero street, wordmark, "One Star. One seat. One wall." |
| 2 | `Sponsor` | 150 | the wall and the terms of raid #26 |
| 3 | `Seats` | 140 | seats #5 and #6 count, the no-seat buy of raid #3 does not |
| 4 | `Raid` | 290 | raid #26's 58 real buys replayed by block (sped up, labelled) |
| 5 | `Draw` | 200 | Pyth Entropy end block 68,876,949 inside the danger zone |
| 6 | `Victory` | 160 | results page numbers: hits, seats, wall share, counted |
| 7 | `Cta` | 150 | why it is fair, the site, credits |

Retime in `src/Main.tsx` (`SCENES`). Each scene is also its own composition under *Scenes* in
the Studio.

## Rules the video follows

- **Every number is the chain's** (AGENTS rule 13). Scenes read `src/data.ts`, which digests the
  finalized frames of real settled testnet raids. No price, no PnL. The replay is labelled
  "sped up".
- **Lil Stars collection art is unaltered** (rule 17); seat avatars in `public/lilstars/` are the
  official images for those token ids, resized. Credits are in the closing scene.
- Crew poses are the D35 event art the app already ships.

## Adding GPT-generated assets

Every visual goes through one map, `SLOTS` in `src/assets.ts`. To swap one:

1. Generate the image (prompts below), save it to `public/gen/<name>.webp` (or png).
2. Point the slot at it: `heroBg: 'gen/hero_v2.webp'`.
3. `pnpm dev` and check the scene.

Music: put an mp3 in `public/audio/` and set `music: 'audio/theme.mp3'`. It plays under the
whole cut at 35% volume, below the sound effects.

### Style anchor (put first in every prompt)

> Bright, glossy 2D game illustration in the Lil Stars style: chunky rounded shapes, thick dark
> purple outlines, soft cel shading, warm sunset palette of grape purple (#2d2250, #7a6eb2),
> ember orange (#ff8c42, #ffb84d) and candy pink (#e826b1), gold accents, sparkles and lanterns.
> Cozy and playful, mobile-game key art quality. No text, no logos, no watermarks.

For crew characters, attach the official art from `app/public/art/lilstars/` (fox, chog, bunny,
bear) as reference and add: *"keep the character exactly on-model; outfit: purple cape with a gold
star clasp, orange scarf, pink headband"*. Never redraw a collection token (rule 17).

### Prompt sheet

| Slot | Size | Prompt (after the style anchor) |
|---|---|---|
| `heroBg` | 1920x1080 | A Lil Stars city street at sunset on raid night, a giant purple brick fortress wall with angry glowing eyes on the right, string lanterns, the four crew members facing it on the left, empty sky top-center for a logo. |
| `arenaBg` | 1920x1080 | A round festival arena stage at dusk seen from the audience, lanterns and pink banners, spotlights, empty center floor for a boss, gentle vignette. |
| `stageBg` | 1920x1080 | A theater stage with heavy magenta curtains half open, a single warm spotlight on the empty floor, dark purple house, dust in the light. |
| `lobbyBg` | 1920x1080 | A cozy night plaza with a small curtained stage, crescent moon and planet neon signs, shop awnings, soft purple fog. |
| `wall` | 1024x1024, transparent | A cute angry boss made of purple and gold bricks, glowing orange eyes, two pink banners on spikes, front view, isolated. |
| `wallKo` | 1024x1024, transparent | The same brick boss collapsed into a rubble pile with a small white surrender flag and dizzy X eyes, isolated. |
| `dice` | 512x512, transparent | A glowing translucent purple cube with constellation lines and gold corners, magic randomness, isolated. |
| `burst` | 1024x1024, transparent | A radial victory burst of golden rays, stars and confetti, centered, isolated. |
| new `gen/sponsor_flag` | 512x512, transparent | A small sponsor pennant flag with a star emblem, orange and pink, isolated. |

Keep backgrounds free of text and leave clear space where the scene puts titles (top third) and
meters (bottom fifth).
