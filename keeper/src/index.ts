import { createPublicClient, http, type Hex } from "viem";
import { loadConfig } from "./config.js";
import { CastSigner, KeySigner, type Signer } from "./signer.js";
import { telegramAlerter } from "./alert.js";
import { Keeper } from "./keeper.js";
import { ChainReader } from "./chain.js";
import { shouldPostDemo, onDemandBlocker, demoTxs, postDemo } from "./demo.js";
import { startDemoServer } from "./http.js";
import type { RaidState } from "./decide.js";

const cfg = loadConfig();
const client = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpcUrl) });

let signer: Signer;
if (process.env.PRIVATE_KEY) {
  // Monad bills the gas limit and a sender must cover limit x maxFee, so cap the fee near the base fee
  // instead of the default 2x: a small keeper balance then goes much further.
  const fees = async () => {
    const base = (await client.getBlock()).baseFeePerGas ?? 100_000_000_000n;
    const tip = 2_000_000_000n;
    return { maxFeePerGas: (base * 5n) / 4n + tip, maxPriorityFeePerGas: tip };
  };
  signer = new KeySigner(process.env.PRIVATE_KEY as Hex, cfg.chain, cfg.rpcUrl, (hash) => client.waitForTransactionReceipt({ hash }), fees);
} else {
  const account = process.env.KEEPER_ACCOUNT ?? "zexo-secondary";
  const address = (process.env.KEEPER_ADDRESS ?? "0x720633667161625FC1d7fd86DE6eC06d814a3492") as Hex;
  const pw = process.env.KEEPER_PASSWORD_FILE ?? `${process.env.HOME}/.config/dominion/testnet-keystore.pass`;
  signer = new CastSigner(address, account, pw, cfg.rpcUrl);
}

const reader = new ChainReader(client as never, cfg.deployment.vault);
const keeper = new Keeper(reader, signer, cfg.deployment.vault, cfg.thinMarkets, telegramAlerter(cfg.telegram));
const demoEveryMs = Number(process.env.DEMO_EVERY_MIN ?? 0) * 60_000;
if (demoEveryMs > 0 && cfg.chain.id !== 10143) throw new Error("demo raids are testnet only");
// The schedule counts from start-up: a restart used to post a raid at once, so every deploy cost one.
let lastDemo = Date.now();
console.log(`keeper ${signer.address} on chain ${cfg.chain.id}, vault ${cfg.deployment.vault}`);

// On-demand raids (testnet only): the app asks, the loop below posts.
let demoRequested = false;
let lastRaids: RaidState[] | null = null;
let balance = 0n;
if (process.env.PORT && cfg.chain.id === 10143) {
  startDemoServer(Number(process.env.PORT), {
    blocker: () => (demoRequested ? "a raid is already on its way" : lastRaids === null ? "the keeper is starting up" : onDemandBlocker(lastRaids, Date.now(), lastDemo, balance)),
    request: () => (demoRequested = true),
    keeperMon: () => (Number(balance / 10n ** 14n) / 1e4).toFixed(2),
  });
  console.log(`on-demand raids on :${process.env.PORT}`);
}

const once = process.argv.includes("--once");
let stop = false;
process.on("SIGINT", () => (stop = true));
process.on("SIGTERM", () => (stop = true));
const until = process.env.UNTIL_SETTLED ? BigInt(process.env.UNTIL_SETTLED) : null;

while (!stop) {
  try {
    const { block, acted } = await keeper.tick();
    if (acted.length) console.log(`block ${block}: ${acted.map((a) => `${a.id}:${a.action}:${a.ok ? "ok" : "fail"}`).join(" ")}`);
    lastRaids = await reader.raids(block);
    balance = await client.getBalance({ address: signer.address });
    const scheduled = demoEveryMs > 0 && shouldPostDemo(lastRaids, Date.now(), lastDemo, demoEveryMs);
    if (demoRequested || scheduled) {
      const why = demoRequested ? "requested" : "scheduled";
      demoRequested = false;
      lastDemo = Date.now();
      await postDemo(signer, demoTxs(cfg.deployment, signer.address, await client.getBlockNumber()));
      console.log(`posted a demo raid (${why})`);
    }
    if (until !== null && acted.some((a) => a.id === until && a.action === "settle" && a.ok)) break;
  } catch (e) {
    console.error(`tick failed: ${(e as Error).message.split("\n")[0]}`);
  }
  if (once) break;
  await new Promise((r) => setTimeout(r, cfg.pollMs));
}
