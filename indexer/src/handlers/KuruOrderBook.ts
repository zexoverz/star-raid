import { indexer } from "envio";
import { eventId, lower } from "../ids.js";

// Display only: which part of each raid's wall sold, and to whom. Raider attribution and counting
// never use these logs (AGENTS.md rule 6); they come from Raided.
indexer.onEvent({ contract: "KuruOrderBook", event: "Trade" }, async ({ event, context }) => {
  const maker = await context.Maker.get(lower(event.params.makerAddress));
  if (!maker) return; // not one of our walls
  context.WallFill.set({
    id: eventId(event),
    raid: maker.raid,
    maker: maker.id,
    orderId: event.params.orderId,
    filledSize: event.params.filledSize,
    price: event.params.price,
    taker: lower(event.params.takerAddress),
    txOrigin: lower(event.params.txOrigin),
    blockNumber: BigInt(event.block.number),
  });
  const raid = await context.Raid.get(maker.raid);
  if (raid) context.Raid.set({ ...raid, wallFilled: raid.wallFilled + event.params.filledSize });
});
