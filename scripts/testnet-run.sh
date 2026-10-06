#!/usr/bin/env bash
# One full testnet raid: deploy and verify on Sourcify, then the keeper drives post, open, raider buys,
# close with a real Pyth Entropy request, the callback, settle and claim, while live/ records the stream.
# Testnet only. Needs about 3 MON in zexo-main and 0.6 MON in zexo-secondary at ~100 gwei.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
F=~/.foundry/bin
RPC=${MONAD_TESTNET_RPC:-https://testnet-rpc.monad.xyz}
PW=~/.config/dominion/testnet-keystore.pass
MAIN=0x9ebdC8ACc879a8284Ae5B3CecfbD280ec307aFA3
SECOND=0x720633667161625FC1d7fd86DE6eC06d814a3492
OUT=$ROOT/deployments/testnet.json
LOGS=${LOGS:-$ROOT/.testnet-run}
mkdir -p "$LOGS" "$ROOT/deployments"

[ "$($F/cast chain-id --rpc-url "$RPC")" = 10143 ] || { echo "not Monad testnet"; exit 1; }
need() { local b; b=$($F/cast balance "$1" --rpc-url "$RPC"); [ "$(echo "$b >= $2" | bc)" = 1 ] || { echo "$1 has $($F/cast from-wei "$b") MON, needs $($F/cast from-wei "$2")"; exit 1; }; }
# a deploy costs ~1.6 MON on top of the raid itself (sponsor txs plus funding the throwaway raiders)
if [ -f "$OUT" ]; then need $MAIN ${NEED_MAIN:-900000000000000000}; else need $MAIN 3000000000000000000; fi
need $SECOND ${NEED_SECOND:-600000000000000000}

if [ ! -f "$OUT" ]; then
  cd "$ROOT/contracts"
  $F/forge script script/DeployTestnet.s.sol --rpc-url "$RPC" --broadcast --slow \
    --account zexo-main --password-file "$PW" --sender $MAIN \
    --verify --verifier sourcify --chain 10143 | tee "$LOGS/deploy.log"
  grep -oE '\{"baseToken[^}]*\}' "$LOGS/deploy.log" | head -1 | python3 -m json.tool > "$OUT"
fi
echo "deployment: $OUT"

cd "$ROOT/live"
DEPLOYMENT="$OUT" RPC_HTTP="$RPC" PORT=8791 pnpm -s tsx src/index.ts > "$LOGS/live.log" 2>&1 &
LIVE=$!
trap 'kill $LIVE 2>/dev/null || true' EXIT
until curl -s localhost:8791/health > /dev/null; do sleep 1; done
NEXT=$(( $($F/cast call "$(python3 -c "import json;print(json.load(open('$OUT'))['vault'])")" "raidCount()(uint256)" --rpc-url "$RPC") + 1 ))
curl -sN "localhost:8791/raids/$NEXT/stream" > "$LOGS/stream-$NEXT.txt" &

cd "$ROOT/keeper"
DEPLOYMENT="$OUT" RPC_URL="$RPC" RAIDERS=${RAIDERS:-3} RAIDER_MON=${RAIDER_MON:-0.2} pnpm -s tsx src/e2e.ts | tee "$LOGS/e2e-$NEXT.log"
sleep 3
curl -s "localhost:8791/raids/$NEXT" > "$LOGS/frames-$NEXT.json"
python3 "$ROOT/scripts/raid-numbers.py" "$LOGS/frames-$NEXT.json"
