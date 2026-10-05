import { readFileSync } from "node:fs";
import { getAddress, type Address } from "viem";

export interface Config {
  chain: "testnet" | "mainnet";
  rpcWs: string;
  rpcHttp: string;
  vault: Address;
  router: Address;
  gate: Address;
  startBlock: bigint; // first block to read Raided and SeatBound logs from (the deploy block)
  port: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const chain = env.CHAIN === "mainnet" ? "mainnet" : "testnet";
  const host = chain === "mainnet" ? "rpc.monad.xyz" : "testnet-rpc.monad.xyz";
  let vault = env.VAULT;
  let router = env.ROUTER;
  let gate = env.SEAT_GATE;
  let start = env.START_BLOCK;
  if (env.DEPLOYMENT) {
    const d = JSON.parse(readFileSync(env.DEPLOYMENT, "utf8")) as { vault?: string; router?: string; seatGate?: string; block?: number };
    vault ||= d.vault;
    router ||= d.router;
    gate ||= d.seatGate;
    start ||= d.block?.toString();
  }
  if (!vault || !router || !gate || !start) {
    throw new Error("set VAULT, ROUTER, SEAT_GATE and START_BLOCK, or DEPLOYMENT=<deploy json>");
  }
  return {
    chain,
    rpcWs: env.RPC_WS || `wss://${host}`,
    rpcHttp: env.RPC_HTTP || `https://${host}`,
    vault: getAddress(vault),
    router: getAddress(router),
    gate: getAddress(gate),
    startBlock: BigInt(start),
    port: Number(env.PORT || 8787),
  };
}
