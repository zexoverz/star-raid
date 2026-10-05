export const NO_SEAT = `0x${"0".repeat(64)}`;

export const lower = (a: string) => a.toLowerCase();
export const raidKey = (id: bigint) => id.toString();
export const seatId = (raidId: bigint, seatKey: string) => `${raidId}-${seatKey.toLowerCase()}`;
export const eventId = (e: { chainId: number; block: { number: number }; logIndex: number }) =>
  `${e.chainId}-${e.block.number}-${e.logIndex}`;
