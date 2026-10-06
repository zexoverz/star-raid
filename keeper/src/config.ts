import { readFileSync } from "node:fs";
import { monad, monadTestnet } from "viem/chains";
import type { Address, Chain } from "viem";

export type Deployment = { vault: Address; router: Address; market: Address; baseToken: Address; quoteToken: Address; lilStars: Address; chainId: number };

export type Config = {
  chain: Chain;
  rpcUrl: string;
  deployment: Deployment;
  // markets where the wall is (nearly) the whole ask side: the trade-based guard means nothing there
  thinMarkets: Set<string>;
  pollMs: number;
  telegram?: { token: string; chatId: string };
};

export function loadConfig(env = process.env): Config {
  // DEPLOYMENT_JSON (the JSON itself) is for hosts that only get the keeper/ directory
  const deployment = (
    env.DEPLOYMENT_JSON
      ? JSON.parse(env.DEPLOYMENT_JSON)
      : JSON.parse(readFileSync(env.DEPLOYMENT ?? new URL("../../deployments/testnet.json", import.meta.url).pathname, "utf8"))
  ) as Deployment;
  const chain = deployment.chainId === 143 ? monad : monadTestnet;
  const thin = (env.THIN_MARKETS ?? (chain.id === 10143 ? deployment.market : "")).split(",").filter(Boolean);
  return {
    chain,
    rpcUrl: env.RPC_URL ?? chain.rpcUrls.default.http[0],
    deployment,
    thinMarkets: new Set(thin.map((a) => a.toLowerCase())),
    pollMs: Number(env.POLL_MS ?? 1000),
    telegram: env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID ? { token: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_CHAT_ID } : undefined,
  };
}
