#!/usr/bin/env bash
# Generate the hand-drawn icons for the "How it works" diagram with GPT image gen via Codex CLI.
# Needs `codex login` (ChatGPT). Output: video/public/doodle/<name>.png
set -u
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/doodle"
mkdir -p "$OUT"
STYLE="hand-drawn Excalidraw-style doodle icon, thick wobbly black marker outlines, a few flat pastel fills, plain white background, no text, no letters, centered, simple whiteboard sketch"

gen() {
  local name="$1" what="$2"
  if [ -f "$OUT/$name.png" ]; then echo "JCODE_PROGRESS {\"message\":\"$name cached\"}"; return; fi
  timeout 500 codex exec --skip-git-repo-check --sandbox workspace-write -C "$OUT" \
    "Use your image generation tool to create ONE image: $what. Style: $STYLE. Save it as $name.png in the current directory. Reply only with the saved path." \
    </dev/null >"$OUT/.$name.log" 2>&1
  if [ -f "$OUT/$name.png" ]; then echo "JCODE_PROGRESS {\"message\":\"$name ok\"}"; else echo "JCODE_PROGRESS {\"message\":\"$name FAIL\"}"; fi
}

gen raider "a smartphone with a big round orange tap button and a small star sparkle, a finger tapping it, pastel orange" &
gen router "a small machine box with one arrow going in and one arrow going out, and a price tag with a ceiling line above it, pastel purple" &
gen kuru "an order book ledger with stacked horizontal bars, green ones and pink ones, and a little brick wall on top, pastel blue" &
wait
gen gate "a ticket turnstile gate with a star-shaped ticket passing through it, pastel pink" &
gen pyth "two dice tumbling with small sparkles, randomness, pastel orange" &
gen settle "a balance scale with coins on one side and a small target flag on the other, plus a check mark, pastel lavender" &
wait
ls "$OUT"
