import { indexer } from "envio";
import { raidKey, seatId, lower } from "../ids.js";

const ZERO = "0x0000000000000000000000000000000000000000";

indexer.onEvent({ contract: "SeatGate", event: "SeatBound" }, async ({ event, context }) => {
  const p = event.params;
  const holder = lower(p.holder);
  context.Seat.set({
    id: seatId(p.raidId, p.seatKey),
    raid: raidKey(p.raidId),
    seatKey: p.seatKey.toLowerCase(),
    kind: Number(p.kind),
    holder: holder === ZERO ? undefined : holder,
    tokenId: p.tokenId,
    player: lower(p.player),
    buys: 0,
    counted: 0n,
    countedAtEnd: undefined,
    buyBlocks: [],
    buyCounted: [],
    baseBought: 0n,
    claimed: false,
    exitedEarly: false,
    prize: 0n,
  });
  const raid = await context.Raid.get(raidKey(p.raidId));
  if (raid) context.Raid.set({ ...raid, seats: raid.seats + 1 });
});
