#!/usr/bin/env bash
# Illustrations for the pitch "problem" section, generated with GPT image gen via Codex CLI.
# Needs `codex login`. Output: video/public/gen/problem/<name>.png
# No Lil Stars characters here (their art is never imitated, AGENTS rule 17): generic cute creatures only.
set -u
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/gen/problem"
mkdir -p "$OUT"
STYLE="cute polished 3D cartoon game illustration, soft rounded shapes, warm pastel palette with purple, cream, orange and pink, soft studio lighting, clean simple background, mobile game key art style, no text, no letters, no logos, no watermark, landscape 3:2"

gen() {
  local name="$1" what="$2"
  if [ -f "$OUT/$name.png" ]; then echo "JCODE_PROGRESS {\"message\":\"$name cached\"}"; return; fi
  timeout 600 codex exec --skip-git-repo-check --sandbox workspace-write -C "$OUT" \
    "Use your image generation tool to create ONE landscape image (3:2): $what. Style: $STYLE. Save it as $name.png in the current directory. Reply only with the saved path." \
    </dev/null >"$OUT/.$name.log" 2>&1
  if [ -f "$OUT/$name.png" ]; then echo "JCODE_PROGRESS {\"message\":\"$name ok\"}"; else echo "JCODE_PROGRESS {\"message\":\"$name FAIL\"}"; fi
}

gen bots "a swarm of small identical grey robots with glowing eyes greedily scooping up a big pile of shiny gold reward coins and gift boxes, one robot hugging a trophy, mischievous" &
gen sniper "a sneaky cartoon cat burglar in a black mask hiding behind a giant stopwatch whose hand is at the last second, about to snatch a glowing prize star, suspenseful" &
gen sponsor "a confused friendly shopkeeper holding a magnifying glass looking at a crowd of cardboard cutout people and masks, cannot tell which are real, question marks floating" &
wait
gen trading "a cute small creature overwhelmed in front of a wall of complicated red and green trading candlestick charts and screens, sweating, dizzy swirls" &
gen together "a group of happy diverse cute round creatures holding phones and cheering together, confetti, a big friendly glowing play button in the sky, joyful co-op game moment" &
wait
ls "$OUT"
