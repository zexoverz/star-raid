#!/usr/bin/env bash
# Scene art for the sung demo, GPT image gen via Codex CLI, with the real Lil Stars sprites attached as
# character references. Redrawn poses of Lil Stars are allowed for this video only (explicit OK from
# the human, recorded in docs/plan/decisions.md). Output: video/public/gen/song/<name>.png
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/gen/song"
REF="$OUT/.ref"
mkdir -p "$OUT" "$REF"
for c in bear bunny chog fox; do [ -f "$REF/$c.png" ] || magick "$ROOT/public/art/lilstars/$c.webp[0]" -background white -flatten "$REF/$c.png"; done
CAST="The four characters are the Lil Stars from the attached reference images and must look exactly like them: BEAR = girl with long brown hair in a red bear-ear hood, white dress, red shoes; BUNNY = white bunny with one blue eye, light blue tee, pink boots; CHOG = round navy-purple spiky hedgehog-like creature with cream face and pink cheeks, often hugging a yellow star; FOX = orange fox with black headphones and a white #23 basketball jersey, blue shorts."
STYLE="Bright glossy cartoon illustration, soft 3D shading like the references, vivid purple night palette with warm orange and gold accents, playful music-video energy, clean shapes, no text, no letters, no numbers, no watermark"

gen() {
  local name="$1" ratio="$2" what="$3"
  if [ -f "$OUT/$name.png" ]; then echo "JCODE_PROGRESS {\"message\":\"$name cached\"}"; return; fi
  timeout 600 codex exec --skip-git-repo-check --sandbox workspace-write -C "$OUT" \
    -i "$REF/bear.png" -i "$REF/bunny.png" -i "$REF/chog.png" -i "$REF/fox.png" \
    "Use your image generation tool to create ONE $ratio image: $what. $CAST $STYLE. Save it as $name.png in the current directory. Reply only with the saved path." \
    </dev/null >"$OUT/.$name.log" 2>&1
  if [ -f "$OUT/$name.png" ]; then echo "JCODE_PROGRESS {\"message\":\"$name ok\"}"; else echo "JCODE_PROGRESS {\"message\":\"$name FAIL\"}"; fi
}
W="landscape 16:9"
S="square, single character on a plain flat pure white background, full body, nothing else in frame"

gen sing_bear "$S" "BEAR alone singing passionately into a handheld microphone, eyes closed, one arm raised" &
gen sing_bunny "$S" "BUNNY alone singing into a handheld microphone, winking, pointing at the viewer" &
gen sing_chog "$S" "CHOG alone singing into a microphone held in one paw, the yellow star in the other paw raised high" &
gen sing_fox "$S" "FOX alone rapping into a microphone, headphones on, one fist pumped" &
wait
gen s00_stage "$W" "all four Lil Stars performing on a concert stage as a band under spotlights, BEAR on lead vocals, FOX on keytar, BUNNY on drums, CHOG on bass, confetti and stars" &
gen s01_lobby "$W" "BUNNY swinging open big glowing arcade doors to a cozy neon lobby full of tiny raid posters and a big countdown screen shape, the others peeking in excited" &
gen s02_wall "$W" "a friendly sponsor character in a top hat stacking a giant wall of shiny golden coin-bricks, a big price tag hanging on it, CHOG watching amazed" &
gen s03_prize "$W" "a glowing treasure chest of blue coins sitting on top of a tall coin-brick wall, FOX on the ground pointing up at it with sparkling eyes" &
wait
gen s04_clock "$W" "BEAR holding a giant ticking alarm clock, sweat drop, the others getting ready in running poses behind her, motion lines" &
gen s05_seat "$W" "a row of star-shaped theater seats, BUNNY happily sitting in one holding a glowing star ticket, the other Lil Stars taking the next seats" &
gen s06_bots "$W" "four Lil Stars standing proudly in their star seats while grumpy little grey robots are locked outside a velvet rope, one robot sadly holding an empty seat sign shape" &
gen s07_tap "$W" "BEAR tapping a giant glowing orange button on a huge smartphone with one finger, sparks flying, very satisfying" &
wait
gen s08_hit "$W" "all four Lil Stars punching and kicking a huge glowing brick wall together, big comic impact bursts, cracks spreading" &
gen s09_buy "$W" "CHOG throwing gold coins into a giant glowing ledger machine with green and pink stacked bars, each coin turning into a little shopping bag, FOX cheering" &
gen s10_cap "$W" "FOX standing under a glowing laser ceiling line, coins bouncing off the line and raining back into his open backpack, thumbs up" &
gen s11_rocket "$W" "all four Lil Stars riding a big purple rocket through a starry sky at high speed, hair and ears blowing, speed lines" &
wait
gen s12_curtain "$W" "a heavy purple theater curtain closing, BUNNY peeking out from the gap with a finger on her lips, question marks floating" &
gen s13_dice "$W" "CHOG rolling two giant glowing purple dice across a cosmic table, sparkles, the others watching nervously" &
gen s14_count "$W" "BEAR as a referee with a whistle and a clipboard checking a long line of glowing hit marks on a wall, green check marks on most, a few greyed out ones after a red finish line" &
gen s15_break "$W" "the giant brick wall exploding into gold coins and confetti, all four Lil Stars jumping through the hole in triumph" &
wait
gen s16_crown "$W" "all four Lil Stars wearing small golden crowns, sharing a big golden trophy, coins and confetti, victory podium" &
gen s17_onewall "$W" "the four Lil Stars standing back to back in a hero pose on top of a broken wall, a single huge star shining behind them" &
wait
ls "$OUT"
