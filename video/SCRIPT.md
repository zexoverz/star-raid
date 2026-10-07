# Star Raid: technical demo video script (3:00)

End-to-end walkthrough of the real app on Monad testnet, from a sponsor posting a raid to a raider
claiming the prize. The trailer (`StarRaidDemo`) is the 37 s teaser; this is the explainer.

- **Length:** 3:00 at about 145 words per minute, so roughly 430 words of voiceover.
- **Format:** screen recordings of the real app, wrapped in Remotion with the app's design: section cards,
  callouts, zooms, captions, and the crew as narrators.
- **Rule 13:** every number on screen is what the chain shows in the recorded raid. No price, no PnL. If
  a take shows a different number, the script follows the take, not the other way round.
- **Voice:** first person plural, plain words, no jargon without a one-line explanation.

## Cast of screens (what we record)

| Clip | Route | Wallet | What happens on screen |
|---|---|---|---|
| C1 | `/` lobby | none | hero, featured raid, recent raids, raid board |
| C2 | `/sponsor` | sponsor wallet | fill terms, preview, post (5 txs), raid appears |
| C3 | `/raid/:id` join panel + guide | raider A (fresh) | connect, 3-step guide, mint Star + 50 tUSDC |
| C4 | `/key` | raider A | pick Star, budget, confirm sheet, sign seat pass, fund key |
| C5 | `/raid/:id` live | raiders A + B + one no-seat wallet | window opens, HIT taps, combo, wall bar, feed, danger zone |
| C6 | `/raid/:id` draw | any | curtain, end block, hits judged one by one, tally |
| C7 | `/raid/:id` results | raider A | VICTORY, podium, loot chest, hold countdown, claim |
| C8 | `/r/:raid/:seat` | raider A | share card |
| C9 | explorer | none | one `raid` tx and the `Settled` event on Monad testnet explorer |

## Script

### 0:00 to 0:12 · Cold open (trailer cut)
**Screen:** 10 s of the trailer: wall boss, crew lunging, COMBO, VICTORY.
**On screen:** wordmark, "One Star. One seat. One wall."
**VO:**
> This is Star Raid. A sponsor puts up a wall of their token, and verified Lil Stars holders buy it
> out together, live, on Kuru's on-chain order book on Monad.

### 0:12 to 0:30 · The problem
**Screen:** motion card: one big buyer vs a crowd of bots vs real people, then the lobby (C1).
**On screen:** three chips: "Bots farm launch rewards", "Snipers wait for the last second",
"Sponsors can't tell who's real".
**VO:**
> Token launches and community buys have three problems. Bots farm the rewards. Snipers wait for
> the last second. And the sponsor never knows whether a real community showed up. Star Raid turns
> that into a short co-op game with rules the chain enforces.

### 0:30 to 0:55 · Sponsor posts a raid (C2)
**Screen:** `/sponsor`. Fill Wall, Cap price, Prize, Target, Seat cap, window. Show the preview,
then post. Zoom on the tx steps ticking.
**Callouts:** "Wall: rests on Kuru at the cap", "Prize: tUSDC, only for seats", "Target: counted
wall buys", "Locked: the wall can't be pulled during the raid".
**Guide:** Bearstar, "You set the price. The crew does the rest!" (app copy)
**VO:**
> A sponsor opens the console and picks the terms: how much token goes on the wall, the price cap,
> a USDC prize and a target. When the raid opens, the vault places the wall on Kuru's order book at
> the cap. From then until the end, the wall can't be pulled. If the raid misses its target, the
> prize doesn't go back to the sponsor's pocket. It rolls into their next raid.

### 0:55 to 1:25 · A raider gets ready, once (C3, C4)
**Screen:** connect wallet, the 3-step guide pops up. Mint a test Star + 50 tUSDC. Go to `/key`,
pick the Star, set a budget, read the confirm sheet, sign the seat pass, fund the key.
**Callouts:** "1 Lil Star = 1 seat per raid", "Seat pass: one signature, 7 days", "Raid key lives in
this browser, holds only your budget".
**Guide:** Foxstar, "Set up one-tap now. You only do it once, then every raid is tap-to-hit."
**VO:**
> Raiders need one thing: a Lil Star. One Star is one seat per raid. That's the whole bot defence.
> A wallet without a seat can still buy, but it counts for nothing. Setup happens once. You sign a
> seat pass for your Star and fund a small raid key in your browser with the budget you choose. The
> key only ever holds that budget, and you can send it back to your wallet any time. After setup,
> every raid is one tap. No wallet popups mid-raid.

### 1:25 to 2:05 · The raid (C5), the centrepiece
**Screen:** countdown, the window opens. Split view: raider A tapping HIT on desktop, raider B on
mobile (FloatingHit). The boss bar drops, the target bar fills, hit sparks with Star avatars, COMBO,
the no-seat wallet's buy shows "no seat · +0". The timeline enters the danger zone.
**Callouts (timed to the action):**
- on the first HIT: "Each HIT = one Kuru buy capped at the wall price"
- on a combo: "Several hits in one block: Monad's fast blocks"
- on the no-seat buy: "Went through. Counted for nothing."
- on the danger zone: "The end block will be drawn somewhere in here"
**VO:**
> The window opens and the party hits the wall. Every HIT is a real buy on Kuru, limited to the cap
> price. Cheaper asks on the book fill first, and any leftover order is cancelled and refunded in the
> same transaction. We count what each seat actually bought, from the account's balance change
> around our own call, not from logs. Each seat has a cap, so one whale can't carry the raid. Now
> we're in the danger zone. The raid can end on any block from here.

### 2:05 to 2:30 · The draw (C6)
**Screen:** the curtain falls, the dice block, the end block lands. Each hit is checked: counted or
too late. The tally fills to the target.
**Callouts:** "End block from Pyth Entropy, drawn after the window", "Hits after it: not counted".
**Guide:** Bunnystar, "Pyth is drawing the end block. Fingers crossed!" (app copy)
**VO:**
> When the window closes, nobody knows where it really ended, not even us. Pyth Entropy draws the end
> block from the danger zone. Hits before it count. Hits after it still get their tokens, but earn
> no prize. So there's no point sniping the last second.

### 2:30 to 2:50 · Victory, claim, share (C7, C8, C9)
**Screen:** VICTORY banner with the results numbers, podium, loot chest with the hold countdown, then
Claim. Cut to the share card, then 2 s on the explorer showing the `Settled` event.
**Callouts:** "Prize split by what each seat counted", "Claim after the hold, or exit early and
forfeit the prize", "Every number here is read from the chain".
**VO:**
> The seats hit the target, so the wall broke. The prize splits across the seats by what each one
> counted. After a short hold, you open your chest: your tokens plus your share of the prize. Then
> share your card.

### 2:50 to 3:00 · Close
**Screen:** CTA card from the trailer: four fairness pills, wordmark, site URL, credits.
**VO:**
> Price-capped buys on Kuru, a fair end from Pyth, a prize only for real Stars. That's Star Raid.
> Grab a seat for the next raid.

## Production plan

1. **Approve this script** (wording, length, order).
2. **Record the clips**: one rehearsed testnet raid with raiders A and B and one no-seat wallet. Use
   OBS at 1920x1080, browser at 100% zoom, extensions hidden. Record a 390x844 mobile view for raider B.
   Save to `video/public/rec/C1.mp4` and so on.
3. **Snapshot that raid** (`pnpm snapshot <id>`) so the overlays use the same numbers as the clips.
4. **Voiceover**: record it, or generate a TTS track, saved to `video/public/audio/vo.mp3`.
5. **Build `StarRaidExplainer`** in Remotion: section cards, clip slots with zoom and pan keyframes,
   callouts and captions timed to the VO.
6. **Render and review**, then cut the 2-minute pitch version from the same parts.
