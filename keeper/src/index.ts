import { createPublicClient, http, type Hex } from "viem";
import { loadConfig } from "./config.js";
import { ChainReader } from "./chain.js";
import { CastSigner, KeySigner, type Signer } from "./signer.js";
import { telegramAlerter } from "./alert.js";
import { Keeper } from "./keeper.js";

const cfg = loadConfig();
const client = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpcUrl) });

let signer: Signer;
if (process.env.PRIVATE_KEY) {
  signer = new KeySigner(process.env.PRIVATE_KEY as Hex, cfg.chain, cfg.rpcUrl, (hash) => client.waitForTransactionReceipt({ hash }));
} else {
  const account = process.env.KEEPER_ACCOUNT ?? "zexo-secondary";
  const address = (process.env.KEEPER_ADDRESS ?? "0x720633667161625FC1d7fd86DE6eC06d814a3492") as Hex;
  const pw = process.env.KEEPER_PASSWORD_FILE ?? `${process.env.HOME}/.config/dominion/testnet-keystore.pass`;
  signer = new CastSigner(address, account, pw, cfg.rpcUrl);
}

const keeper = new Keeper(new ChainReader(client as never, cfg.deployment.vault), signer, cfg.deployment.vault, cfg.thinMarkets, telegramAlerter(cfg.telegram));
console.log(`keeper ${signer.address} on chain ${cfg.chain.id}, vault ${cfg.deployment.vault}`);

const once = process.argv.includes("--once");
let stop = false;
process.on("SIGINT", () => (stop = true));
process.on("SIGTERM", () => (stop = true));
const until = process.env.UNTIL_SETTLED ? BigInt(process.env.UNTIL_SETTLED) : null;

while (!stop) {
  try {
    const { block, acted } = await keeper.tick();
    if (acted.length) console.log(`block ${block}: ${acted.map((a) => `${a.id}:${a.action}:${a.ok ? "ok" : "fail"}`).join(" ")}`);
    if (until !== null && acted.some((a) => a.id === until && a.action === "settle" && a.ok)) break;
  } catch (e) {
    console.error(`tick failed: ${(e as Error).message.split("\n")[0]}`);
  }
  if (once) break;
  await new Promise((r) => setTimeout(r, cfg.pollMs));
}
