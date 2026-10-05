// The keeper's state machine. Pure: given a raid read at a finalized block, what to do next.

export const Status = { None: 0, Posted: 1, Open: 2, Closing: 3, Closed: 4, Settled: 5, Aborted: 6 } as const;

export const OPEN_EARLY = 10n;
export const OPEN_GRACE = 30n;
export const ENTROPY_TIMEOUT = 200n;
// Open a few blocks before w0 so buys find the wall at w0, but inside the vault's OPEN_EARLY window.
export const OPEN_LEAD = 8n;

export type RaidState = {
  id: bigint;
  status: number;
  w0: bigint;
  w1: bigint;
  requestBlock: bigint;
  wallRecovered: boolean;
};

export type Action = "open" | "expire" | "close" | "closeWithoutEntropy" | "settle" | "recoverWall";

export type Decision = { action: Action } | { wait: string } | null;

export function decide(r: RaidState, finalized: bigint, guardOk: () => boolean): Decision {
  switch (r.status) {
    case Status.Posted:
      if (finalized > r.w0 + OPEN_GRACE) return { action: "expire" };
      if (finalized + OPEN_LEAD < r.w0) return null;
      return guardOk() ? { action: "open" } : { wait: "start guard refused" };
    case Status.Open:
      return finalized > r.w1 ? { action: "close" } : null;
    case Status.Closing:
      return finalized > r.requestBlock + ENTROPY_TIMEOUT ? { action: "closeWithoutEntropy" } : null;
    case Status.Closed:
      return { action: "settle" };
    case Status.Settled:
      return r.wallRecovered ? null : { action: "recoverWall" };
    default:
      return null;
  }
}
