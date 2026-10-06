// Testnet rehearsal of one whole raid, driven end to end:
//   sponsor (zexo-main) mints test tokens and posts; the keeper (zexo-secondary) opens at w0, closes
//   after w1 with a real Entropy request, settles on the callback; the raider (zexo-secondary, which
//   holds a test Star) buys during the window and claims after the hold.
import { createPublicClient, createWalletClient, http, encodeFunctionData, parseAbi, parseEther, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { loadConfig } from "./config.js";
import { ChainReader } from "./chain.js";
import { CastSigner } from "./signer.js";
import { telegramAlerter } from "./alert.js";
import { Keeper } from "./keeper.js";
import { vaultAbi, erc20Abi } from "./abi.js";
import { GAS, raidGasLimit } from "./gas.js";
import { Status } from "./decide.js";

const cfg = loadConfig();
if (cfg.chain.id !== 10143) throw new Error("testnet only");
const d = cfg.deployment;
const client = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpcUrl) });
const pw = `${process.env.HOME}/.config/dominion/testnet-keystore.pass`;
const sponsor = new CastSigner("0x9ebdC8ACc879a8284Ae5B3CecfbD280ec307aFA3", "zexo-main", pw, cfg.rpcUrl);
const keeperSigner = new CastSigner("0x720633667161625FC1d7fd86DE6eC06d814a3492", "zexo-secondary", pw, cfg.rpcUrl);
const raider = keeperSigner;

const routerAbi = parseAbi([
  "struct Seat { uint8 kind; address holder; uint256 tokenId; bytes32 humanId; uint64 expiry; bytes sig; }",
  "function raid(uint256 raidId, uint128 quoteIn, Seat seat) payable",
  "function claim(uint256 raidId)",
  "function countedTotalAt(uint256 raidId, uint64 endBlock) view returns (uint256)",
]);
const starsAbi = parseAbi(["function mint(address to) returns (uint256)", "function nextId() view returns (uint256)"]);

const WALL = 100_000n * 10n ** 10n; // 100k tSTAR in size units
const WALL_WEI = 100_000n * 10n ** 18n;
const BOUNTY = 50_000_000n; // 50 tUSDC
const TARGET = 500_000_000n; // 500 tUSDC of wall fill
const BUY = 600_000_000n; // the raider buys 600 tUSDC
const PRICE = 2_600_000n; // 0.026 tUSDC, Kuru price units at 1e8
const WINDOW = 120n;
const HOLD = 60;

async function send(s: CastSigner, to: Address, data: Hex, gas: bigint, label: string) {
  const r = await s.send({ to, data, gas });
  if (!r.ok) throw new Error(`${label} reverted ${r.hash}`);
  console.log(`${label} ${r.hash}`);
}

const call = (abi: any, fn: string, args: unknown[]) => encodeFunctionData({ abi, functionName: fn, args } as never);

// 1. sponsor mints and approves (it posts once every raider is ready, so setup never eats the window)
await send(sponsor, d.baseToken, call(erc20Abi, "mint", [sponsor.address, WALL_WEI]), GAS.mint, "mint tSTAR");
await send(sponsor, d.quoteToken, call(erc20Abi, "mint", [sponsor.address, BOUNTY]), GAS.mint, "mint tUSDC bounty");
await send(sponsor, d.baseToken, call(erc20Abi, "approve", [d.vault, WALL_WEI]), GAS.approve, "approve tSTAR");
await send(sponsor, d.quoteToken, call(erc20Abi, "approve", [d.vault, BOUNTY]), GAS.approve, "approve tUSDC");

// 2. raider gets a Star and USDC
const tokenId = await client.readContract({ address: d.lilStars, abi: starsAbi, functionName: "nextId" });
await send(raider, d.lilStars, call(starsAbi, "mint", [raider.address]), GAS.mint, `mint Star #${tokenId}`);
await send(raider, d.quoteToken, call(erc20Abi, "mint", [raider.address, BUY]), GAS.mint, "mint tUSDC");
await send(raider, d.quoteToken, call(erc20Abi, "approve", [d.router, BUY]), GAS.approve, "approve router");

// 2b. throwaway raiders (testnet only): fresh keys funded with a little MON from the sponsor wallet.
// All but the last get a Star; the last has none, so its buy goes through uncounted.
const EXTRA = Number(process.env.RAIDERS ?? 3);
const EXTRA_BUY = 150_000_000n; // 150 tUSDC each
const extras = Array.from({ length: EXTRA }, (_, i) => {
  const account = privateKeyToAccount(generatePrivateKey());
  return { account, seat: i < EXTRA - 1, wallet: createWalletClient({ account, chain: cfg.chain, transport: http(cfg.rpcUrl) }) };
});
async function extraSend(x: (typeof extras)[number], to: Address, data: Hex, gas: bigint, label: string) {
  let hash: Hex | undefined;
  for (let i = 0; !hash; i++) {
    try {
      hash = await x.wallet.sendTransaction({ to, data, gas });
    } catch (e) {
      // same node lag as above: retry a few times on a balance the node has not caught up with
      if (i === 5 || !String((e as Error).message).includes("insufficient balance")) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  const r = await client.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${label} reverted ${hash}`);
  console.log(`${label} ${hash}`);
}
const extraTokens: bigint[] = [];
for (const x of extras) {
  const fund = await sponsor.send({ to: x.account.address, data: "0x", value: parseEther(process.env.RAIDER_MON ?? "0.5"), gas: 21_000n });
  if (!fund.ok) throw new Error("fund raider");
  // The public RPC is several nodes; the next call can land on one that has not seen the funding yet.
  for (let i = 0; (await client.getBalance({ address: x.account.address, blockTag: "latest" })) === 0n; i++) {
    if (i === 60) throw new Error(`funding of ${x.account.address} never became visible`);
    await new Promise((r) => setTimeout(r, 500));
  }
  await new Promise((r) => setTimeout(r, 1500));
  let tok = 0n;
  if (x.seat) {
    tok = await client.readContract({ address: d.lilStars, abi: starsAbi, functionName: "nextId" });
    await extraSend(x, d.lilStars, call(starsAbi, "mint", [x.account.address]), GAS.mint, `mint Star #${tok}`);
  }
  extraTokens.push(tok);
  await extraSend(x, d.quoteToken, call(erc20Abi, "mint", [x.account.address, EXTRA_BUY]), GAS.mint, "mint tUSDC");
  await extraSend(x, d.quoteToken, call(erc20Abi, "approve", [d.router, EXTRA_BUY]), GAS.approve, "approve router");
}
let extrasBought = 0;

// Leftover MON in the throwaway raiders goes back to the sponsor wallet, also when something fails.
async function sweepExtras() {
  for (const x of extras) {
    try {
      const bal = await client.getBalance({ address: x.account.address });
      const fee = (await client.getGasPrice()) * 2n * 21_000n;
      if (bal <= fee) continue;
      const hash = await x.wallet.sendTransaction({ to: sponsor.address, value: bal - fee, gas: 21_000n, maxFeePerGas: fee / 21_000n, maxPriorityFeePerGas: fee / 42_000n });
      await client.waitForTransactionReceipt({ hash });
      console.log(`swept ${bal - fee} wei back from ${x.account.address}`);
    } catch (e) {
      console.error(`sweep of ${x.account.address} failed: ${(e as Error).message.split("\n")[0]}`);
    }
  }
}
let failed: unknown;
let raidId = 0n;
let claimed = false;
try {

// 2c. post now that every raider is ready
const head = await client.getBlockNumber();
const w0 = head + 40n;
const terms = { market: d.market, prizeToken: d.quoteToken, wallSize: WALL, bounty: BOUNTY, target: TARGET, seatCap: BUY,
  w0, w1: w0 + WINDOW, hold: HOLD, capBps: 0, anchorMode: 0, anchorParam: PRICE };
await send(sponsor, d.vault, call(vaultAbi, "post", [terms, []]), GAS.post, `post w0=${w0}`);
raidId = await client.readContract({ address: d.vault, abi: vaultAbi, functionName: "raidCount" });
console.log(`raid ${raidId} posted`);

// 3. keeper loop; the raider buys once the raid is open and the window has started
const keeper = new Keeper(new ChainReader(client as never, d.vault), keeperSigner, d.vault, cfg.thinMarkets, telegramAlerter(cfg.telegram));
let bought = false;
for (;;) {
  const { acted } = await keeper.tick();
  for (const a of acted) console.log(`keeper raid ${a.id}: ${a.action} ${a.ok ? "ok" : "FAILED"}`);
  const v = await client.readContract({ address: d.vault, abi: vaultAbi, functionName: "raidView", args: [raidId] });
  const latest = await client.getBlockNumber();
  if (!bought && v.status === Status.Open && latest >= v.w0) {
    const seat = { kind: 1, holder: raider.address, tokenId, humanId: `0x${"0".repeat(64)}` as Hex, expiry: 0n, sig: "0x" as Hex };
    const data = call(routerAbi, "raid", [raidId, BUY, seat]);
    const estimate = await client.estimateGas({ account: raider.address, to: d.router, data });
    await send(raider, d.router, data, raidGasLimit(1, estimate), `raid buy (estimate ${estimate})`);
    bought = true;
  }
  // the throwaway raiders buy one per block after the main raider
  if (bought && extrasBought < extras.length && v.status === Status.Open && latest <= v.w1) {
    const x = extras[extrasBought];
    const seat = x.seat
      ? { kind: 1, holder: x.account.address, tokenId: extraTokens[extrasBought], humanId: `0x${"0".repeat(64)}` as Hex, expiry: 0n, sig: "0x" as Hex }
      : { kind: 0, holder: "0x0000000000000000000000000000000000000000" as Address, tokenId: 0n, humanId: `0x${"0".repeat(64)}` as Hex, expiry: 0n, sig: "0x" as Hex };
    const data = call(routerAbi, "raid", [raidId, EXTRA_BUY, seat]);
    const estimate = await client.estimateGas({ account: x.account.address, to: d.router, data });
    await extraSend(x, d.router, data, raidGasLimit(1, estimate), x.seat ? "raid buy (seat)" : "raid buy (no seat)");
    extrasBought++;
  }
  if (v.status === Status.Aborted) throw new Error("raid aborted");
  if (v.status === Status.Settled) {
    console.log(`settled: won=${v.won} endBlock=${v.endBlock}`);
    const wait = Number(v.settledAt) + HOLD + 2 - Math.floor(Date.now() / 1000);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait * 1000));
    await send(raider, d.router, call(routerAbi, "claim", [raidId]), 300_000n, "claim");
    claimed = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 1000));
}
} catch (e) {
  failed = e;
}
await sweepExtras();
if (failed) throw failed;
const r = await client.readContract({ address: d.vault, abi: vaultAbi, functionName: "raid", args: [raidId] });
console.log(JSON.stringify({ raidId: String(raidId), won: r.won, endBlock: String(r.endBlock), countedTotal: String(r.countedTotal), wallRecovered: r.wallRecovered, claimed }));
