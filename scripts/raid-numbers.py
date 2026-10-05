"""Publishable numbers of one raid from its last finalized frame: counted buys, wall share and buys
refused from counting. Never a price, never a PnL (AGENTS.md rule 13)."""
import json, sys

f = json.load(open(sys.argv[1]))["finalized"]
q = 10 ** f["terms"]["quoteDecimals"]
counted_buys = sum(1 for b in f["buys"] if b["seatKey"] and b["afterEnd"] is False and int(b["countedAdded"]) > 0)
spent = int(f["totals"]["quoteSpent"])
wall = int(f["totals"]["wallFillQuote"])
print(json.dumps({
    "raid": f["raidId"],
    "status": f["status"],
    "won": f["won"],
    "endBlock": f["endBlock"],
    "seats": len(f["seats"]),
    "countedBuys": counted_buys,
    "buysAfterEnd": sum(1 for b in f["buys"] if b["afterEnd"]),
    "nonSeatBuys": int(f["nonSeatBuys"]),
    "countedQuote": int(f["counted"]) / q,
    "targetQuote": int(f["terms"]["target"]) / q,
    "wallShareOfSpend": round(wall / spent, 4) if spent else None,
    "wallSoldOfWall": round(int(f["wallSold"]) / int(f["terms"]["wallSize"]), 4),
}, indent=2))
