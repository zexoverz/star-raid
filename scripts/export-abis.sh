#!/usr/bin/env bash
# Writes the ABIs the app needs to deployments/abi/, so the frontend never needs Foundry.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT/contracts" && ~/.foundry/bin/forge build > /dev/null
mkdir -p "$ROOT/deployments/abi"
for c in RaidVault:RaidVault RaidRouter:RaidRouter SeatGate:SeatGate MockERC20:MockERC20 MockStars:MockStars; do
  file=${c%%:*}; name=${c##*:}
  python3 -c "import json,sys;print(json.dumps(json.load(open(sys.argv[1]))['abi'],indent=2))" "out/$file.sol/$name.json" > "$ROOT/deployments/abi/$name.json"
done
ls "$ROOT/deployments/abi"
