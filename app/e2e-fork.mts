// Run: anvil --fork-url https://testnet-rpc.monad.xyz --chain-id 10143 --port 8645, then `pnpm e2e:fork`.
// End-to-end acceptance on an anvil fork of Monad testnet (real RaidVault/Router/SeatGate/Kuru book).
// Exercises the exact calls the app makes: MockStars.mint, tUSDC mint/transfer, EIP-712 Bind,
// one-tap raid key approve + router.raid with raidGasLimit, a no-seat buy, a too-small buy,
// claim before hold (HoldNotOver), exitEarly, claim, and the sweep back to the holder.
import { createPublicClient, createTestClient, createWalletClient, http, parseEther, zeroHash, encodeFunctionData, decodeErrorResult, type Hex, type Abi } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import dep from '../deployments/testnet.json' with { type: 'json' }
import routerAbi from '../deployments/abi/RaidRouter.json' with { type: 'json' }
import vaultAbi from '../deployments/abi/RaidVault.json' with { type: 'json' }
import gateAbi from '../deployments/abi/SeatGate.json' with { type: 'json' }
import erc20Abi from '../deployments/abi/MockERC20.json' with { type: 'json' }
import starsAbi from '../deployments/abi/MockStars.json' with { type: 'json' }
// raidGasLimit is taken verbatim from src/lib/contracts.ts (that module imports JSON without attributes).
import { readFileSync } from 'node:fs'
const src = readFileSync(new URL('./src/lib/contracts.ts', import.meta.url), 'utf8')
const body = src.slice(src.indexOf('export const RAID_GAS_CEILING'))
const raidGasLimit = new Function(`${body.replace(/export /g, '').replace(/: (number|bigint)/g, '').replace(/\): bigint/, ')').replace(/estimate\?/, 'estimate')}; return raidGasLimit`)() as (n: number, e?: bigint) => bigint

const RPC = 'http://127.0.0.1:8645'
const chain = { id: 10143, name: 'fork', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } } as const
const pub = createPublicClient({ chain, transport: http(RPC) })
const test = createTestClient({ chain, mode: 'anvil', transport: http(RPC) })
const A = { vault: dep.vault as Hex, router: dep.router as Hex, gate: dep.seatGate as Hex, stars: dep.lilStars as Hex, usdc: dep.quoteToken as Hex, star: dep.baseToken as Hex, market: dep.market as Hex }
const results: [string, boolean, string][] = []
const check = (name: string, ok: boolean, detail = '') => { results.push([name, ok, detail]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`) }
const ABIS = [...(routerAbi as Abi), ...(gateAbi as Abi), ...(vaultAbi as Abi)] as Abi
const errName = (e: unknown) => {
  const r = (e as any)?.walk?.((x: any) => x?.name === 'ContractFunctionRevertedError') as any
  if (r?.data?.errorName) return r.data.errorName as string
  const raw = r?.raw ?? (e as any)?.walk?.((x: any) => typeof x?.data === 'string')?.data
  if (raw) try { return decodeErrorResult({ abi: ABIS, data: raw }).errorName } catch {}
  return String((e as any)?.shortMessage ?? e).slice(0, 120)
}
const sim = (functionName: string, args: unknown[], account: any) => pub.simulateContract({ address: A.router, abi: ABIS, functionName, args, account })
const mine = (n: number) => test.mine({ blocks: n })
async function send(from: Hex | ReturnType<typeof privateKeyToAccount>, to: Hex, data: Hex, gas: bigint, value = 0n) {
  const account = typeof from === 'string' ? from : from
  const w = createWalletClient({ chain, transport: http(RPC), account: account as any })
  const hash = await w.sendTransaction({ to, data, gas, value, account: account as any, chain })
  await mine(1)
  const r = await pub.waitForTransactionReceipt({ hash })
  return r
}
const read = (address: Hex, abi: unknown, functionName: string, args: unknown[] = []) => pub.readContract({ address, abi: abi as Abi, functionName, args }) as Promise<any>
const enc = (abi: unknown, functionName: string, args: unknown[]) => encodeFunctionData({ abi: abi as Abi, functionName, args } as never)

// ---- setup: keeper (impersonated), a holder wallet, a no-seat wallet
await test.setAutomine(false)
const keeper = (await read(A.vault, vaultAbi, 'keeper')) as Hex
await test.impersonateAccount({ address: keeper })
await test.setBalance({ address: keeper, value: parseEther('100') })
const holder = privateKeyToAccount(generatePrivateKey())
const bot = privateKeyToAccount(generatePrivateKey())
for (const a of [holder.address, bot.address]) await test.setBalance({ address: a, value: parseEther('10') })

// ---- testnet has a stale wall from raid #5 (settled but still resting one tick cheaper); recoverWall is
// permissionless and is what the keeper should have done. Without it every new raid counts 0.
for (let id = 1n; id <= 5n; id++) {
  try { const r = await send(keeper, A.vault, enc(vaultAbi, 'recoverWall', [id]), 450_000n); if (r.status === 'success') check(`stale wall of raid #${id} recovered`, true) } catch {}
}

// ---- post + open a raid exactly like keeper/src/demo.ts
let head = await pub.getBlockNumber()
const w0 = head + 20n
const terms = { market: A.market, prizeToken: A.usdc, wallSize: 100_000n * 10n ** 10n, bounty: 50_000_000n, target: 500_000_000n, seatCap: 600_000_000n, w0, w1: w0 + 60n, hold: 60, capBps: 0, anchorMode: 0, anchorParam: 2_600_000n }
for (const [to, data, gas] of [
  [A.star, enc(erc20Abi, 'mint', [keeper, 100_000n * 10n ** 18n]), 120_000n],
  [A.usdc, enc(erc20Abi, 'mint', [keeper, 50_000_000n]), 120_000n],
  [A.star, enc(erc20Abi, 'approve', [A.vault, 100_000n * 10n ** 18n]), 80_000n],
  [A.usdc, enc(erc20Abi, 'approve', [A.vault, 50_000_000n]), 80_000n],
  [A.vault, enc(vaultAbi, 'post', [terms, []]), 600_000n],
] as [Hex, Hex, bigint][]) { const r = await send(keeper, to, data, gas); if (r.status !== 'success') throw new Error('post step reverted') }
const raidId = (await read(A.vault, vaultAbi, 'raidCount')) as bigint
check('keeper posts a raid on the real vault', raidId > 5n, `raid #${raidId}`)
head = await pub.getBlockNumber()
await mine(Number(w0 - head - 5n))
const ro = await send(keeper, A.vault, enc(vaultAbi, 'open', [raidId]), 900_000n)
check('keeper opens it (wall placed on Kuru)', ro.status === 'success')
head = await pub.getBlockNumber(); if (head < w0) await mine(Number(w0 - head))

// ---- starter kit (app: useActions.getTestKit)
const nextId = (await read(A.stars, starsAbi, 'nextId')) as bigint
await send(holder, A.stars, enc(starsAbi, 'mint', [holder.address]), 120_000n)
await send(holder, A.usdc, enc(erc20Abi, 'mint', [holder.address, 600_000_000n]), 120_000n)
check('starter kit: holder owns the minted Star', ((await read(A.stars, starsAbi, 'ownerOf', [nextId])) as string).toLowerCase() === holder.address.toLowerCase(), `Star #${nextId}`)

// ---- arm one-tap (app: lib/onetap.ts arm): Bind signature + fund raid key
const key = privateKeyToAccount(generatePrivateKey())
const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600)
const sig = await holder.signTypedData({ domain: { name: 'StarRaid SeatGate', version: '1', chainId: 10143, verifyingContract: A.gate }, types: { Bind: [{ name: 'holder', type: 'address' }, { name: 'player', type: 'address' }, { name: 'expiry', type: 'uint64' }] }, primaryType: 'Bind', message: { holder: holder.address, player: key.address, expiry } })
await send(holder, A.usdc, enc(erc20Abi, 'transfer', [key.address, 560_000_000n]), 80_000n)
{ const w = createWalletClient({ chain, transport: http(RPC), account: holder }); const h = await w.sendTransaction({ to: key.address, value: parseEther('1.4'), gas: 21_000n }); await mine(1); await pub.waitForTransactionReceipt({ hash: h }) }
check('arm: raid key funded with 560 tUSDC + 1.4 MON', ((await read(A.usdc, erc20Abi, 'balanceOf', [key.address])) as bigint) === 560_000_000n)

// ---- taps (app: onetap.tap): router approved once at arm time, then a BURST of raid() sends with the
// fixed HIT_GAS limit, consecutive nonces, and no reads in between (what the app now does).
const seat = { kind: 1, holder: holder.address, tokenId: nextId, humanId: zeroHash, expiry, sig }
await send(key, A.usdc, enc(erc20Abi, 'approve', [A.router, 560_000_000n]), 80_000n)
const before = (await read(A.usdc, erc20Abi, 'balanceOf', [key.address])) as bigint
const HIT_GAS = raidGasLimit(1, 865_000n)
check('hit gas limit is fixed and explicit (rule 10)', HIT_GAS === 1_297_500n && HIT_GAS <= 2_000_000n, String(HIT_GAS))
const kw = createWalletClient({ chain, transport: http(RPC), account: key })
let n0 = await pub.getTransactionCount({ address: key.address, blockTag: 'pending' })
const hashes: Hex[] = []
for (const amt of [5_000_000n, 5_000_000n, 3_000_000n, 497_000_000n]) hashes.push(await kw.sendTransaction({ to: A.router, data: enc(routerAbi, 'raid', [raidId, amt, seat]), gas: HIT_GAS, nonce: n0++, maxFeePerGas: 127_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n }))
await mine(1)
const rcpts = await Promise.all(hashes.map((hash) => pub.waitForTransactionReceipt({ hash })))
const taps = rcpts.filter((r) => r.status === 'success').length
check('a burst of 4 taps in one block all land', taps === 4, `gas used ${rcpts.map((r) => r.gasUsed).join(', ')} under limit ${HIT_GAS}`)
check('every hit used less gas than the limit', rcpts.every((r) => r.gasUsed < HIT_GAS))
const after = (await read(A.usdc, erc20Abi, 'balanceOf', [key.address])) as bigint
check('hits spent tUSDC from the raid key only', after < before && after >= 0n, `${Number(before - after) / 1e6} tUSDC spent`)
const seatKey = (await read(A.gate, gateAbi, 'playerSeat', [raidId, key.address])) as Hex
check('seat bound to the raid key via Bind (kind 1)', seatKey !== zeroHash)
const counted = (await read(A.router, routerAbi, 'countedOf', [raidId, seatKey])) as bigint
check('seat counted equals hits (wall is the only ask)', counted > 0n, `${Number(counted) / 1e6} tUSDC counted`)

// ---- edge cases the app explains
try { await sim('raid', [raidId, 1_000_000n, seat], key); check('SizeTooSmall surfaces for 1 tUSDC', false) } catch (e) { check('SizeTooSmall surfaces for 1 tUSDC', errName(e) === 'SizeTooSmall', errName(e)) }
const noSeat = { kind: 0, holder: '0x0000000000000000000000000000000000000000', tokenId: 0n, humanId: zeroHash, expiry: 0n, sig: '0x' }
await send(bot, A.usdc, enc(erc20Abi, 'mint', [bot.address, 10_000_000n]), 120_000n)
await send(bot, A.usdc, enc(erc20Abi, 'approve', [A.router, 5_000_000n]), 80_000n)
const rb = await send(bot, A.router, enc(routerAbi, 'raid', [raidId, 5_000_000n, noSeat]), 900_000n)
check('no-seat buy goes through and counts for nothing', rb.status === 'success' && ((await read(A.router, routerAbi, 'nonSeatBuys', [raidId])) as bigint) === 1n)
try { await sim('raid', [raidId, 5_000_000n, seat], keeper); check('sponsor/keeper cannot raid (Excluded or TokenUsed)', false) } catch (e) { const n = errName(e); check('sponsor/keeper cannot raid', ['Excluded', 'SeatTaken', 'BadBind', 'NotStarOwner'].includes(n), n) }

// ---- close: past w1, request entropy; on a fork no callback, so use the timeout path
head = await pub.getBlockNumber(); await mine(Number(terms.w1 - head + 1n))
try { await sim('raid', [raidId, 5_000_000n, seat], key); check('hit after window refused', false) } catch (e) { check('hit after window refused (OutsideWindow)', errName(e) === 'OutsideWindow', errName(e)) }
const fee = (await pub.readContract({ address: (await read(A.vault, vaultAbi, 'entropy')) as Hex, abi: [{ type: 'function', name: 'getFeeV2', inputs: [], outputs: [{ type: 'uint128' }], stateMutability: 'view' }], functionName: 'getFeeV2' })) as bigint
const rc = await send(keeper, A.vault, enc(vaultAbi, 'close', [raidId]), 500_000n, fee)
check('close requests Pyth Entropy', rc.status === 'success', `fee ${Number(fee) / 1e18} MON`)
await mine(201)
const rcw = await send(keeper, A.vault, enc(vaultAbi, 'closeWithoutEntropy', [raidId]), 100_000n)
check('closeWithoutEntropy after timeout (fork has no Pyth callback)', rcw.status === 'success')
try { await sim('claim', [raidId], key); check('claim before settle refused', false) } catch (e) { check('claim before settle refused (NotSettled)', errName(e) === 'NotSettled', errName(e)) }
const rs = await send(keeper, A.vault, enc(vaultAbi, 'settle', [raidId]), 700_000n)
check('settle', rs.status === 'success')
const view = (await read(A.vault, vaultAbi, 'raidView', [raidId])) as any
check('raid won (counted >= 500 tUSDC target)', view.won === true, `won=${view.won}`)

// ---- claim path (app: LootPanel via raid key) + sweep (onetap.sweep)
try { await sim('claim', [raidId], key); check('claim during hold refused', false) } catch (e) { check('claim during hold refused (HoldNotOver -> app offers exit early)', errName(e) === 'HoldNotOver', errName(e)) }
const prize = (await read(A.router, routerAbi, 'prizeOf', [raidId, seatKey])) as bigint
check('prize share readable for the seat', prize > 0n, `${Number(prize) / 1e6} tUSDC`)
await test.increaseTime({ seconds: 61 }); await mine(1)
const usdcBefore = (await read(A.usdc, erc20Abi, 'balanceOf', [key.address])) as bigint
const rcl = await send(key, A.router, enc(routerAbi, 'claim', [raidId]), 400_000n)
const usdcAfter = (await read(A.usdc, erc20Abi, 'balanceOf', [key.address])) as bigint
const tstar = (await read(A.star, erc20Abi, 'balanceOf', [key.address])) as bigint
check('claim from raid key after hold pays tSTAR + prize', rcl.status === 'success' && tstar > 0n && usdcAfter - usdcBefore === prize, `+${Number(prize) / 1e6} tUSDC, ${Number(tstar) / 1e18} tSTAR`)
try { await sim('claim', [raidId], key); check('double claim refused', false) } catch (e) { check('double claim refused (AlreadyDone)', errName(e) === 'AlreadyDone', errName(e)) }
const hU0 = (await read(A.usdc, erc20Abi, 'balanceOf', [holder.address])) as bigint
for (const t of [A.usdc, A.star]) { const b = (await read(t, erc20Abi, 'balanceOf', [key.address])) as bigint; if (b > 0n) await send(key, t, enc(erc20Abi, 'transfer', [holder.address, b]), 80_000n) }
const gp = await pub.getGasPrice(); const mon = await pub.getBalance({ address: key.address }); const fee2 = 21_000n * gp * 2n
if (mon > fee2) { const w = createWalletClient({ chain, transport: http(RPC), account: key }); const h = await w.sendTransaction({ to: holder.address, value: mon - fee2, gas: 21_000n, maxFeePerGas: gp * 2n, maxPriorityFeePerGas: gp / 50n }); await mine(1); await pub.waitForTransactionReceipt({ hash: h }) }
const keyLeft = { u: (await read(A.usdc, erc20Abi, 'balanceOf', [key.address])) as bigint, s: (await read(A.star, erc20Abi, 'balanceOf', [key.address])) as bigint }
check('sweep returns all tUSDC and tSTAR to the holder', keyLeft.u === 0n && keyLeft.s === 0n && ((await read(A.usdc, erc20Abi, 'balanceOf', [holder.address])) as bigint) > hU0)

const fails = results.filter((r) => !r[1])
console.log(`\n${results.length - fails.length}/${results.length} passed`)
process.exit(fails.length ? 1 : 0)
