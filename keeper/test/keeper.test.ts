import { describe, expect, it } from "vitest";
import { Keeper } from "../src/keeper.js";
import type { Signer, Tx } from "../src/signer.js";

const VAULT = "0x00000000000000000000000000000000000000aa" as const;
const MARKET = "0x00000000000000000000000000000000000000bb" as const;

function reader(status: number, guardCalls: { n: number }) {
  return {
    finalizedBlock: async () => 1000n,
    raids: async () => [{ id: 1n, status, w0: 1000n, w1: 1200n, requestBlock: 0n, wallRecovered: false, market: MARKET }],
    entropyFee: async () => 3n,
    guardInput: async () => {
      guardCalls.n++;
      return { mids: [100n, 200n], tradePrices: [], lastTradeBlock: null, head: 1000n };
    },
  };
}

class FakeSigner implements Signer {
  address = VAULT;
  sent: Tx[] = [];
  constructor(private fail = false) {}
  async send(tx: Tx) {
    this.sent.push(tx);
    if (this.fail) throw new Error("boom");
    return { hash: "0x01" as const, ok: true, block: 1005n };
  }
}

describe("keeper", () => {
  it("does not open a liquid market while the guard refuses", async () => {
    const g = { n: 0 };
    const s = new FakeSigner();
    const k = new Keeper(reader(1, g) as never, s, VAULT, new Set(), async () => {}, () => {});
    await k.tick();
    expect(g.n).toBe(1);
    expect(s.sent).toHaveLength(0);
  });
  it("skips the trade guard on thin markets and opens", async () => {
    const g = { n: 0 };
    const s = new FakeSigner();
    const k = new Keeper(reader(1, g) as never, s, VAULT, new Set([MARKET]), async () => {}, () => {});
    const { acted } = await k.tick();
    expect(g.n).toBe(0);
    expect(acted).toEqual([{ id: 1n, action: "open", ok: true }]);
  });
  it("does not resend a step until finality reaches its receipt", async () => {
    const s = new FakeSigner();
    const r = reader(1, { n: 0 });
    const k = new Keeper(r as never, s, VAULT, new Set([MARKET]), async () => {}, () => {});
    await k.tick(); // sends open, receipt at 1005; finalized is still 1000 and still says Posted
    await k.tick();
    expect(s.sent).toHaveLength(1);
    (r as { finalizedBlock: () => Promise<bigint> }).finalizedBlock = async () => 1005n;
    await k.tick();
    expect(s.sent).toHaveLength(2);
  });
  it("backs off a failing step instead of retrying every tick", async () => {
    let t = 0;
    const s = new FakeSigner(true);
    const k = new Keeper(reader(4, { n: 0 }) as never, s, VAULT, new Set(), async () => {}, () => {}, () => t);
    await k.tick(); // fails, next try after 2 s
    await k.tick();
    expect(s.sent).toHaveLength(1);
    t = 2_000;
    await k.tick(); // fails again, next try after 4 s
    expect(s.sent).toHaveLength(2);
    t = 5_000;
    await k.tick();
    expect(s.sent).toHaveLength(2);
    t = 6_000;
    await k.tick();
    expect(s.sent).toHaveLength(3);
  });
  it("pays the Entropy fee on close", async () => {
    const s = new FakeSigner();
    const r = { ...reader(2, { n: 0 }), finalizedBlock: async () => 1201n };
    await new Keeper(r as never, s, VAULT, new Set(), async () => {}, () => {}).tick();
    expect(s.sent[0].value).toBe(3n);
  });
  it("alerts once when a step fails twice", async () => {
    const alerts: string[] = [];
    let t = 0;
    const k = new Keeper(reader(4, { n: 0 }) as never, new FakeSigner(true), VAULT, new Set(), async (x) => {
      alerts.push(x);
    }, () => {}, () => t);
    await k.tick();
    expect(alerts).toHaveLength(0);
    t += 60_000;
    await k.tick();
    expect(alerts).toHaveLength(1);
    t += 60_000;
    await k.tick();
    expect(alerts).toHaveLength(1);
  });
});
