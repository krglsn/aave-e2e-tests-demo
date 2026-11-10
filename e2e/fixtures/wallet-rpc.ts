import {
  createPublicClient,
  createWalletClient,
  getAddress,
  hexToBigInt,
  http,
  isAddress,
  isHex,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getNetwork } from '../config/networks.js';
import { getRpcUrl } from '../config/rpc.js';

type RpcRequest = {
  method: string;
  params: unknown[];
};

type WalletBridgeOptions = {
  address: string;
  privateKeyEnv: string;
};

/**
 * Read calls are forwarded to Base Sepolia.
 * Signing uses the private key in Node and, for eth_sendTransaction, broadcasts the transaction.
 * The key never goes into the browser.
 */
export function createWalletBridge({ address, privateKeyEnv }: WalletBridgeOptions) {
  const network = getNetwork('baseSepolia');
  let request: ((args: { method: string; params?: unknown[] }) => Promise<unknown>) | undefined;

  const rpc = () => {
    if (!request) {
      const transport = http(getRpcUrl('baseSepolia'))({ chain: network.chain });
      request = (args) => transport.request(args as never);
    }
    return request;
  };

  return {
    request(method: string, params: unknown[]): Promise<unknown> {
      return rpc()({ method, params });
    },

    async execute(requestParams: RpcRequest): Promise<Hex> {
      const account = accountFromEnv(privateKeyEnv, address);
      const wallet = createWalletClient({ account, chain: network.chain, transport: http(getRpcUrl('baseSepolia')) });

      if (requestParams.method === 'eth_sendTransaction') {
        const transaction = transactionFor(account.address, requestParams.params);
        const publicClient = createPublicClient({ chain: network.chain, transport: http(getRpcUrl('baseSepolia')) });
        const pendingNonce = await publicClient.getTransactionCount({
          address: account.address,
          blockTag: 'pending',
        });
        if (transaction.nonce === undefined || transaction.nonce < pendingNonce) transaction.nonce = pendingNonce;
        return wallet.sendTransaction(transaction);
      }
      if (requestParams.method === 'personal_sign' || requestParams.method === 'eth_sign') {
        return wallet.signMessage({ message: messageFor(requestParams.params) });
      }
      return wallet.signTypedData(typedDataFor(requestParams.params) as never);
    },
  };
}

function accountFromEnv(privateKeyEnv: string, walletAddress: string) {
  const account = privateKeyToAccount(readPrivateKey(privateKeyEnv));
  const expected = getAddress(walletAddress);
  if (account.address !== expected) {
    throw new Error(
      `${privateKeyEnv} controls ${account.address}, while the connected wallet is ${expected}.`,
    );
  }
  return account;
}

function readPrivateKey(name: string): Hex {
  const raw = process.env[name]?.trim();
  if (!raw) {
    throw new Error(`${name} must be set to the private key of the connected test wallet.`);
  }
  const key = raw.startsWith('0x') ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(`${name} must be a 32-byte hex private key.`);
  }
  return key as Hex;
}

function transactionFor(account: Address, params: unknown[]) {
  const tx = (params[0] ?? {}) as {
    from?: string;
    to?: string;
    data?: string;
    value?: string;
    gas?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    nonce?: string;
  };
  if (!tx.from || !isAddress(tx.from) || getAddress(tx.from) !== account) {
    throw new Error(`Transaction sender ${tx.from ?? 'unknown'} does not match the signing key ${account}.`);
  }
  if (!tx.to || !isAddress(tx.to)) throw new Error('Transaction request is missing the contract address.');

  const fee = feeFields(tx);
  return {
    to: getAddress(tx.to),
    data: isHex(tx.data) ? tx.data : '0x',
    value: quantity(tx.value) ?? 0n,
    gas: quantity(tx.gas),
    nonce: tx.nonce ? Number(hexToBigInt(tx.nonce as Hex)) : undefined,
    ...fee,
  };
}

function feeFields(tx: { gasPrice?: string; maxFeePerGas?: string; maxPriorityFeePerGas?: string }) {
  const maxFeePerGas = quantity(tx.maxFeePerGas);
  const maxPriorityFeePerGas = quantity(tx.maxPriorityFeePerGas);
  if (maxFeePerGas !== undefined || maxPriorityFeePerGas !== undefined) {
    return { maxFeePerGas, maxPriorityFeePerGas };
  }
  const gasPrice = quantity(tx.gasPrice);
  return gasPrice === undefined ? {} : { gasPrice };
}

function quantity(value: string | undefined): bigint | undefined {
  return value && isHex(value) ? hexToBigInt(value) : undefined;
}

function messageFor(params: unknown[]): { raw: Hex } | string {
  const raw = params.find((param): param is string => typeof param === 'string' && !isAddress(param));
  if (typeof raw !== 'string') throw new Error('Message signature request is missing the message.');
  return isHex(raw) ? { raw } : raw;
}

function typedDataFor(params: unknown[]) {
  const address = params.find((param): param is Address => typeof param === 'string' && isAddress(param));
  const raw = params.find((param) => param !== address);
  const data = typeof raw === 'string' ? JSON.parse(raw) as Record<string, unknown> : raw as Record<string, unknown>;
  if (!data?.domain || !data.types || typeof data.primaryType !== 'string' || !data.message) {
    throw new Error('Typed data signature request does not contain domain, types, and message.');
  }
  const types = { ...(data.types as Record<string, unknown>) };
  delete types.EIP712Domain;
  return {
    domain: data.domain as never,
    types: types as never,
    primaryType: data.primaryType,
    message: data.message as never,
  };
}
