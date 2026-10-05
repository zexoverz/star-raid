import { readFileSync } from "node:fs";
import { getAddress, type Address } from "viem";

export interface Config {
  chain: "testnet" | "mainnet";
  rpcWs: string;
  rpcHttp: string;
  vault: Address;
  router: Address;
  port: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const chain = env.CHAIN === "mainnet" ? "mainnet" : "testnet";
  const host = chain === "mainnet" ? "rpc.monad.xyz" : "testnet-rpc.monad.xyz";
  let vault = env.VAULT;
  let router = env.ROUTER;
  if (env.DEPLOYMENT) {
    const d = JSON.parse(readFileSync(env.DEPLOYMENT, "utf8")) as { vault?: string; router?: string };
    vault ||= d.vault;
    router ||= d.router;
  }
  if (!vault || !router) throw new Error("set VAULT and ROUTER, or DEPLOYMENT=<json with vault and router>");
  return {
    chain,
    rpcWs: env.RPC_WS || `wss://${host}`,
    rpcHttp: env.RPC_HTTP || `https://${host}`,
    vault: getAddress(vault),
    router: getAddress(router),
    port: Number(env.PORT || 8787),
  };
}
