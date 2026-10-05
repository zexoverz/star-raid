import { indexer, type Raid } from "envio";
import { raidKey, lower } from "../ids.js";

// Each raid's Kuru market is indexed from the moment it is posted, so wall fills are never missed.
indexer.contractRegister({ contract: "RaidVault", event: "Posted" }, async ({ event, context }) => {
  context.chain.KuruOrderBook.add(event.params.market);
});

indexer.onEvent({ contract: "RaidVault", event: "Posted" }, async ({ event, context }) => {
  const t = event.params.terms;
  context.Raid.set({
    id: raidKey(event.params.raidId),
    sponsor: lower(event.params.sponsor),
    market: lower(event.params.market),
    prizeToken: lower(t.prizeToken),
    wallSize: t.wallSize,
    bounty: t.bounty,
    target: t.target,
    seatCap: t.seatCap,
    w0: t.w0,
    w1: t.w1,
    hold: t.hold,
    status: "Posted",
    capPrice: undefined,
    wallId: undefined,
    maker: undefined,
    endBlock: undefined,
    won: undefined,
    countedProvisional: 0n,
    countedTotal: undefined,
    prizePot: undefined,
    wallRecovered: false,
    seatIds: [],
    wallSold: undefined,
    abortReason: undefined,
    seatBuys: 0,
    nonSeatBuys: 0,
    seats: 0,
    wallFilled: 0n,
    postedAt: event.block.timestamp,
    settledAt: undefined,
  });
});

async function update(context: { Raid: { getOrThrow: (id: string) => Promise<Raid>; set: (r: Raid) => void } }, id: bigint, patch: Partial<Raid>) {
  const raid = await context.Raid.getOrThrow(raidKey(id));
  context.Raid.set({ ...raid, ...patch });
}

indexer.onEvent({ contract: "RaidVault", event: "Opened" }, async ({ event, context }) => {
  const maker = lower(event.params.maker);
  context.Maker.set({ id: maker, raid: raidKey(event.params.raidId) });
  await update(context, event.params.raidId, {
    status: "Open",
    capPrice: event.params.capPrice,
    wallId: event.params.wallId,
    maker,
  });
});

indexer.onEvent({ contract: "RaidVault", event: "Aborted" }, async ({ event, context }) => {
  await update(context, event.params.raidId, { status: "Aborted", abortReason: Number(event.params.reason) });
});

indexer.onEvent({ contract: "RaidVault", event: "CloseRequested" }, async ({ event, context }) => {
  await update(context, event.params.raidId, { status: "Closing" });
});

// E is known: recount every seat from its own buys at or before E, then add the final figure to the
// players' lifetime totals. Before this, seat and leaderboard numbers are provisional.
indexer.onEvent({ contract: "RaidVault", event: "EndDrawn" }, async ({ event, context }) => {
  const raid = await context.Raid.getOrThrow(raidKey(event.params.raidId));
  const e = event.params.endBlock;
  for (const seatId of raid.seatIds) {
    const seat = await context.Seat.getOrThrow(seatId);
    let atEnd = 0n;
    seat.buyBlocks.forEach((b, i) => {
      if (b <= e) atEnd += seat.buyCounted[i] ?? 0n;
    });
    context.Seat.set({ ...seat, countedAtEnd: atEnd });

    const prId = `${raid.id}-${seat.player}`;
    const pr = await context.PlayerRaid.get(prId);
    if (pr) context.PlayerRaid.set({ ...pr, countedAtEnd: (pr.countedAtEnd ?? 0n) + atEnd });
    const player = await context.Player.get(seat.player);
    if (player) context.Player.set({ ...player, counted: player.counted + atEnd });
  }
  context.Raid.set({ ...raid, status: "Closed", endBlock: e });
});

indexer.onEvent({ contract: "RaidVault", event: "Settled" }, async ({ event, context }) => {
  await update(context, event.params.raidId, {
    status: "Settled",
    won: event.params.won,
    countedTotal: event.params.countedTotal,
    wallSold: event.params.wallSold,
    settledAt: event.block.timestamp,
  });
});

indexer.onEvent({ contract: "RaidVault", event: "WallRecovered" }, async ({ event, context }) => {
  await update(context, event.params.raidId, { wallRecovered: true });
});

indexer.onEvent({ contract: "RaidVault", event: "RolloverCredited" }, async ({ event, context }) => {
  const id = `${lower(event.params.sponsor)}-${lower(event.params.token)}`;
  const prev = await context.Rollover.get(id);
  context.Rollover.set({
    id,
    sponsor: lower(event.params.sponsor),
    token: lower(event.params.token),
    credited: (prev?.credited ?? 0n) + event.params.amount,
  });
});
