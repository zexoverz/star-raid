import { indexer } from "envio";
import { NO_SEAT, raidKey, seatId, eventId, lower } from "../ids.js";

// Counted numbers come from the router's own Raided event (countedAdded), never from Trade logs
// (AGENTS.md rule 6).
indexer.onEvent({ contract: "RaidRouter", event: "Raided" }, async ({ event, context }) => {
  const p = event.params;
  const rid = raidKey(p.raidId);
  const player = lower(p.player);
  const hasSeat = p.seatKey.toLowerCase() !== NO_SEAT;

  context.Buy.set({
    id: eventId(event),
    raid: rid,
    player,
    seatKey: p.seatKey.toLowerCase(),
    hasSeat,
    blockNumber: p.blockNumber,
    baseOut: p.baseOut,
    quoteSpent: p.quoteSpent,
    wallFillQuote: p.wallFillQuote,
    countedAdded: p.countedAdded,
    timestamp: event.block.timestamp,
  });

  const raid = await context.Raid.getOrThrow(rid);
  let seatIds = raid.seatIds;
  if (hasSeat) {
    const sid = seatId(p.raidId, p.seatKey);
    const seat = await context.Seat.getOrThrow(sid); // SeatBound is emitted earlier in the same tx
    if (seat.buys === 0) seatIds = [...seatIds, sid];
    context.Seat.set({
      ...seat,
      buys: seat.buys + 1,
      counted: seat.counted + p.countedAdded,
      buyBlocks: [...seat.buyBlocks, p.blockNumber],
      buyCounted: [...seat.buyCounted, p.countedAdded],
      baseBought: seat.baseBought + p.baseOut,
    });
  }
  context.Raid.set({
    ...raid,
    seatIds,
    seatBuys: raid.seatBuys + (hasSeat ? 1 : 0),
    nonSeatBuys: raid.nonSeatBuys + (hasSeat ? 0 : 1),
    countedProvisional: raid.countedProvisional + p.countedAdded,
  });

  const prId = `${rid}-${player}`;
  const pr = await context.PlayerRaid.get(prId);
  context.PlayerRaid.set({
    id: prId,
    raid: rid,
    player,
    counted: (pr?.counted ?? 0n) + p.countedAdded,
    countedAtEnd: pr?.countedAtEnd,
    buys: (pr?.buys ?? 0) + 1,
  });

  const pl = await context.Player.get(player);
  context.Player.set({
    id: player,
    counted: pl?.counted ?? 0n, // lifetime counted grows only when a raid's E is drawn
    raidsJoined: (pl?.raidsJoined ?? 0) + (pr ? 0 : 1),
    buys: (pl?.buys ?? 0) + 1,
    seatBuys: (pl?.seatBuys ?? 0) + (hasSeat ? 1 : 0),
  });
});

indexer.onEvent({ contract: "RaidRouter", event: "PrizeFunded" }, async ({ event, context }) => {
  const raid = await context.Raid.getOrThrow(raidKey(event.params.raidId));
  context.Raid.set({ ...raid, prizePot: event.params.amount });
});

indexer.onEvent({ contract: "RaidRouter", event: "Claimed" }, async ({ event, context }) => {
  const seat = await context.Seat.getOrThrow(seatId(event.params.raidId, event.params.seatKey));
  context.Seat.set({ ...seat, claimed: true, prize: event.params.prize });
});

indexer.onEvent({ contract: "RaidRouter", event: "ExitedEarly" }, async ({ event, context }) => {
  const seat = await context.Seat.getOrThrow(seatId(event.params.raidId, event.params.seatKey));
  context.Seat.set({ ...seat, exitedEarly: true, prize: 0n });
});
