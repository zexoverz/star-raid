import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createWalletClient, http, type Address, type Hex, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const run = promisify(execFile);

export type Tx = { to: Address; data: Hex; value?: bigint; gas: bigint };
export type Sent = { hash: Hex; ok: boolean; block: bigint };

export interface Signer {
  readonly address: Address;
  send(tx: Tx): Promise<Sent>;
}

function requireGas(tx: Tx) {
  // Rule 10: Monad bills the limit, so a send without one is a bug, not a default.
  if (typeof tx.gas !== "bigint" || tx.gas <= 0n) throw new Error("explicit gas limit required");
}

/// Local signer: a Foundry keystore unlocked by a password file, via `cast send`. The key never
/// leaves the keystore and is never read into this process.
export class CastSigner implements Signer {
  constructor(
    readonly address: Address,
    private account: string,
    private passwordFile: string,
    private rpcUrl: string,
    private castBin = `${process.env.HOME}/.foundry/bin/cast`,
  ) {}

  async send(tx: Tx): Promise<Sent> {
    requireGas(tx);
    const args = ["send", tx.to, tx.data, "--gas-limit", tx.gas.toString(), "--account", this.account,
      "--password-file", this.passwordFile, "--rpc-url", this.rpcUrl, "--json"];
    if (tx.value && tx.value > 0n) args.push("--value", tx.value.toString());
    const { stdout } = await run(this.castBin, args, { maxBuffer: 1 << 22 });
    const receipt = JSON.parse(stdout) as { transactionHash: Hex; status: string; blockNumber: string };
    return {
      hash: receipt.transactionHash,
      ok: receipt.status === "0x1" || receipt.status === "1",
      block: BigInt(receipt.blockNumber),
    };
  }
}

/// Hosted signer: PRIVATE_KEY from the environment (Railway secret). Never logged.
export class KeySigner implements Signer {
  readonly address: Address;
  private wallet;
  private publicWait: (hash: Hex) => Promise<{ status: string; blockNumber: bigint }>;

  constructor(
    privateKey: Hex,
    chain: Chain,
    rpcUrl: string,
    wait: (hash: Hex) => Promise<{ status: string; blockNumber: bigint }>,
    private fees?: () => Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }>,
  ) {
    const account = privateKeyToAccount(privateKey);
    this.address = account.address;
    this.wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
    this.publicWait = wait;
  }

  async send(tx: Tx): Promise<Sent> {
    requireGas(tx);
    const fee = this.fees ? await this.fees() : {};
    const hash = await this.wallet.sendTransaction({ to: tx.to, data: tx.data, value: tx.value, gas: tx.gas, ...fee });
    const r = await this.publicWait(hash);
    return { hash, ok: r.status === "success", block: r.blockNumber };
  }
}
