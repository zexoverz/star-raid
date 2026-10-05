import { createPublicClient, http, webSocket, type PublicClient } from "viem";
import { monad, monadTestnet } from "viem/chains";
import { loadConfig } from "./config.js";
import { Hub } from "./hub.js";
import { Pump } from "./pump.js";
import { MulticallReader } from "./reader.js";
import { EventStore } from "./events.js";
import { startServer } from "./server.js";

const HTTP_POLL_MS = 400;
const FINALIZED_POLL_MS = 500;

const cfg = loadConfig();
const chain = cfg.chain === "mainnet" ? monad : monadTestnet;
const log = (m: string) => console.log(new Date().toISOString(), m);

// One HTTP client for reads; the WebSocket only carries heads.
const httpClient = createPublicClient({ chain, transport: http(cfg.rpcHttp) }) as PublicClient;
const hub = new Hub();
const events = new EventStore(httpClient, cfg.router, cfg.gate, cfg.vault, cfg.startBlock);
const pump = new Pump(new MulticallReader(httpClient, cfg.vault, cfg.router), events, hub, log);

let headSource = "ws";
let pollTimer: NodeJS.Timeout | undefined;

function pollHeads() {
  if (pollTimer) return;
  headSource = "http";
  log("head source: http polling");
  pollTimer = setInterval(async () => {
    try {
      pump.onHead(await httpClient.getBlockNumber({ cacheTime: 0 }));
    } catch (e) {
      log(`head poll failed: ${(e as Error).message.split("\n")[0]}`);
    }
  }, HTTP_POLL_MS);
}

try {
  const wsClient = createPublicClient({ chain, transport: webSocket(cfg.rpcWs) });
  wsClient.watchBlockNumber({
    emitOnBegin: true,
    onBlockNumber: (n) => pump.onHead(n),
    onError: (e) => {
      log(`ws heads failed: ${e.message.split("\n")[0]}`);
      pollHeads();
    },
  });
} catch (e) {
  log(`ws unavailable: ${(e as Error).message}`);
  pollHeads();
}

// Rule 12: money reads are finalized. Finalized frames firm up what the proposed ones showed.
setInterval(async () => {
  try {
    const b = await httpClient.getBlock({ blockTag: "finalized" });
    pump.onFinalized(b.number);
  } catch (e) {
    log(`finalized poll failed: ${(e as Error).message.split("\n")[0]}`);
  }
}, FINALIZED_POLL_MS);

startServer(hub, cfg.port, () => ({
  ok: true,
  chain: cfg.chain,
  headSource,
  proposed: pump.lastProposed.toString(),
  finalized: pump.lastFinalized.toString(),
  readErrors: pump.errors,
}));
log(`live on :${cfg.port} (${cfg.chain}, vault ${cfg.vault})`);
