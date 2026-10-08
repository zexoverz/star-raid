# Star Raid: pitch video script (~3:00)

Modelled on the structure of "PIPS by PIVY" (Kwek Labs): founder on camera for the story, app on a
phone for the demo, sticker-style slides with the founder in a corner circle, roadmap, end card.
Only **zexoverz** is on camera. English. Built in **5 days** for Monad Metropolis 2026, Track 01.

- **Lines in quotes are what you say.** Say them in your own words if that feels more natural, keep
  the meaning. One clip per section, so a stumble only costs that one clip.
- **Rule 13 still applies:** only numbers the chain shows. The only stats used are real raid #26
  (58 hits, 580 counted vs a 500 target) and Monad's block time.
- **Face layouts:** `FULL` = you fill the frame. `CORNER` = slide or app fills the frame, you in a
  circle bottom right. `NONE` = no face.

## Sections

| # | Time | Section | Face | On screen |
|---|---|---|---|---|
| 1 | 0:00 | Hook | FULL | you holding the phone with Star Raid open |
| 2 | 0:08 | Logo sting | NONE | wordmark lands, crew bounces, music hits |
| 3 | 0:14 | Problem | FULL then CORNER | three sticker cards: bots, snipers, fake crowds |
| 4 | 0:34 | Built in 5 days | FULL | big "5 DAYS" stamp |
| 5 | 0:40 | Meet Star Raid | CORNER | phone mockup, one-line value, Lil Stars crew |
| 6 | 0:52 | Demo | NONE | phone recordings: lobby, sponsor, seat, HIT dock, combo, draw, victory |
| 7 | 1:40 | How it works | CORNER | three cards: Kuru cap, Pyth end block, one Star one seat; raid #26 numbers |
| 8 | 2:10 | Why Monad, Kuru, Pyth | FULL | keywords pop: "ON-CHAIN ORDER BOOK", "FAST BLOCKS", "FAIR END" |
| 9 | 2:35 | Roadmap | CORNER | What's next 01 / 02 / 03 |
| 10 | 2:52 | Close | FULL, then end card | "Grab a seat.", starraid.xyz |

## Lines

**1. Hook (FULL, ~8 s).** Hold the phone up, raid screen visible.
> "What if a token launch felt like a boss fight, and only real people could win it?"

**3. Problem (FULL ~8 s, then CORNER ~12 s).**
> "Community buys are broken. Bots farm the rewards. Snipers wait for the very last second.
> And the sponsor never knows if a real community even showed up."
> "Not everyone can trade. But anyone can play a game with their friends."

**4. Built in 5 days (FULL, ~6 s).**
> "So we spent five days building Star Raid for Monad Metropolis."

**5. Meet Star Raid (CORNER, ~12 s).**
> "Star Raid is a co-op raid game on a real on-chain order book. A sponsor puts up a wall of their
> token. Lil Stars holders take their seats, and break it together, live."

**6. Demo (NONE, voice over the recording, ~48 s).** Read slowly; the edit follows your voice.
> "This is the lobby. The next raid, live, right here on your phone.
> A sponsor sets the wall, the price cap and a USDC prize, and posts it in a few taps.
> Your Lil Star is your seat. One Star, one seat. That's the whole bot defence.
> Set up once, and every raid after that is one tap. No wallet popups.
> When the window opens, everyone hits the wall. Every hit is a real buy.
> Then the end block is drawn, every hit is checked, and if the seats hit the target, the wall breaks."

**7. How it works (CORNER, ~30 s).**
> "Under the hood, every hit is a buy on Kuru's order book on Monad, capped at the wall price.
> Cheaper asks fill first, and anything left over is cancelled and refunded in the same transaction.
> The end of the raid is drawn by Pyth Entropy after the window closes, so nobody can snipe the last block.
> And only seats count. A wallet without a Lil Star can still buy, but it earns nothing.
> On testnet, raid twenty-six broke its wall: fifty-eight hits, five hundred eighty counted against a five hundred target."

**8. Why Monad, Kuru, Pyth (FULL, ~25 s).**
> "We built it on Monad because a raid only feels like a game when blocks are fast.
> Kuru gives us a real on-chain order book, so the wall is real liquidity, not a mock.
> And Pyth Entropy gives us a fair end that nobody, not even us, can know in advance."

**9. Roadmap (CORNER, ~17 s).**
> "Right now Star Raid is live on Monad testnet. Next, we go to mainnet.
> Then passkey sign-in, so anyone can join without installing a wallet.
> And more walls: any sponsor token, starting with liquid staking tokens.
> We think this is something the Monad community would love to play."

**10. Close (FULL, ~8 s).**
> "This is Star Raid. One Star. One seat. One wall. Grab a seat at starraid dot x y z."

Roadmap source: `docs/plan/` (mainnet after testnet, Mera passkey account E5 P1, LST markets SPEC §16).

## Recording guide (phone is fine)

- **Landscape, 1080p or 4K, 30 fps**, phone on a stand at eye level, about an arm's length away.
- **Light in front of you** (a window or a lamp behind the phone), not behind you.
- **Quiet room**, phone mic is OK; an earphone mic close to the mouth is better.
- **Leave space**: head and shoulders, a bit of room above the head. The edit crops to a circle for
  the CORNER sections, so stay roughly centred.
- **One file per section**, named by number: `01-hook.mp4`, `03-problem.mp4`, `04-days.mp4`,
  `05-meet.mp4`, `06-demo.mp4` (voice only is fine), `07-how.mp4`, `08-why.mp4`, `09-roadmap.mp4`,
  `10-close.mp4`. Pause one second before and after each line.
- Wear something plain, or a Star Raid / Lil Stars shirt if you have one.
- Drop the files in `video/public/face/`. The video fits each section to the length of your clip,
  and subtitles are made from your voice.
