import {
  createPublicClient,
  decodeFunctionData,
  encodeFunctionData,
  getAddress,
  http,
  type Address,
  type Hex,
} from 'viem';
import { maxUint256 } from '../blockchain/index.js';
import { getNetwork } from '../config/networks.js';
import { getRpcUrl } from '../config/rpc.js';
import { createWalletBridge } from '../fixtures/wallet-rpc.js';
import type { SignatureRequest } from '../fixtures/wallet.fixture.js';

const erc20Actions = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const poolActions = [
  {
    type: 'function',
    name: 'supply',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
      { name: 'referralCode', type: 'uint16' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'supplyWithPermit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
      { name: 'referralCode', type: 'uint16' },
      { name: 'deadline', type: 'uint256' },
      { name: 'permitV', type: 'uint8' },
      { name: 'permitR', type: 'bytes32' },
      { name: 'permitS', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'borrow',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interestRateMode', type: 'uint256' },
      { name: 'referralCode', type: 'uint16' },
      { name: 'onBehalfOf', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'repay',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interestRateMode', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'repayWithPermit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interestRateMode', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'permitV', type: 'uint8' },
      { name: 'permitR', type: 'bytes32' },
      { name: 'permitS', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export type PoolActionName = (typeof poolActions)[number]['name'];

export type PoolAction = {
  name: PoolActionName;
  asset: Address;
  amount: bigint;
  onBehalfOf: Address;
  interestRateMode?: bigint;
};

export async function revokeAllowance(owner: string, token: Address, spender: Address): Promise<void> {
  const allowance = await readAllowance(owner, token, spender);
  if (allowance === 0n) return;
  await sendApprove(owner, token, spender, 0n);
}

export async function ensureAllowance(
  owner: string,
  token: Address,
  spender: Address,
  minimum: bigint,
): Promise<void> {
  const allowance = await readAllowance(owner, token, spender);
  if (allowance >= minimum) return;
  if (allowance > 0n) await sendApprove(owner, token, spender, 0n);
  await sendApprove(owner, token, spender, maxUint256);
}

/** Set the pool allowance to an exact amount. A non-zero allowance is cleared first. */
export async function setAllowance(
  owner: string,
  token: Address,
  spender: Address,
  amount: bigint,
): Promise<void> {
  const allowance = await readAllowance(owner, token, spender);
  if (allowance === amount) return;
  if (allowance > 0n) await sendApprove(owner, token, spender, 0n);
  if (amount > 0n) await sendApprove(owner, token, spender, amount);
}

const variableRate = 2n;

/** Supply `amount` of `token` from the wallet into the pool. */
export async function supply(owner: string, token: Address, amount: bigint): Promise<void> {
  const { network } = baseSepolia();
  await ensureAllowance(owner, token, network.pool, amount);
  await sendTransaction(owner, network.pool, encodeFunctionData({
    abi: poolActions,
    functionName: 'supply',
    args: [token, amount, getAddress(owner), 0],
  }));
}

/** Withdraw supplied `token` back to the wallet. */
export async function withdrawSupply(owner: string, token: Address, amount: bigint): Promise<void> {
  const { network } = baseSepolia();
  await sendTransaction(owner, network.pool, encodeFunctionData({
    abi: poolActions,
    functionName: 'withdraw',
    args: [token, amount, getAddress(owner)],
  }));
}

/** Borrow `token` at a variable rate. Borrowing does not spend an allowance. */
export async function borrowVariable(owner: string, token: Address, amount: bigint): Promise<void> {
  const { network } = baseSepolia();
  await sendTransaction(owner, network.pool, encodeFunctionData({
    abi: poolActions,
    functionName: 'borrow',
    args: [token, amount, variableRate, 0, getAddress(owner)],
  }));
}

/** Repay variable debt directly, so a test can restore the borrow it opened. */
export async function repayVariableDebt(owner: string, token: Address, amount: bigint): Promise<void> {
  const { network } = baseSepolia();
  await ensureAllowance(owner, token, network.pool, amount);
  await sendTransaction(owner, network.pool, encodeFunctionData({
    abi: poolActions,
    functionName: 'repay',
    args: [token, amount, variableRate, getAddress(owner)],
  }));
}

export function readApproval(request: SignatureRequest): { spender: Address; amount: bigint } {
  if (request.type === 'typedData') {
    if (!request.primaryType.toLowerCase().includes('permit')) {
      throw new Error(`Expected a permit signature, received ${request.primaryType}.`);
    }
    return {
      spender: getAddress(String(request.message.spender)),
      amount: BigInt(String(request.message.value)),
    };
  }
  if (request.type !== 'transaction') {
    throw new Error(`Expected an approval, received a ${request.type} signature.`);
  }
  const decoded = decodeFunctionData({ abi: erc20Actions, data: request.data });
  if (decoded.functionName !== 'approve') {
    throw new Error(`Expected approve, received ${decoded.functionName}.`);
  }
  return {
    spender: getAddress(decoded.args[0]),
    amount: decoded.args[1],
  };
}

export function readPoolAction(request: SignatureRequest): PoolAction {
  if (request.type !== 'transaction') {
    throw new Error(`Expected a pool transaction, received a ${request.type} signature.`);
  }
  const decoded = decodeFunctionData({ abi: poolActions, data: request.data });
  const asset = getAddress(String(decoded.args[0]));
  const amount = BigInt(decoded.args[1]);
  if (decoded.functionName === 'withdraw') {
    return { name: decoded.functionName, asset, amount, onBehalfOf: getAddress(String(decoded.args[2])) };
  }
  if (decoded.functionName === 'borrow') {
    return {
      name: decoded.functionName,
      asset,
      amount,
      interestRateMode: BigInt(decoded.args[2]),
      onBehalfOf: getAddress(String(decoded.args[4])),
    };
  }
  if (decoded.functionName === 'repay' || decoded.functionName === 'repayWithPermit') {
    return {
      name: decoded.functionName,
      asset,
      amount,
      interestRateMode: BigInt(decoded.args[2]),
      onBehalfOf: getAddress(String(decoded.args[3])),
    };
  }
  return {
    name: decoded.functionName,
    asset,
    amount,
    onBehalfOf: getAddress(String(decoded.args[2])),
  };
}

async function readAllowance(owner: string, token: Address, spender: Address): Promise<bigint> {
  const { client } = baseSepolia();
  return client.readContract({
    address: token,
    abi: erc20Actions,
    functionName: 'allowance',
    args: [getAddress(owner), spender],
  });
}

async function sendApprove(owner: string, token: Address, spender: Address, amount: bigint): Promise<void> {
  await sendTransaction(owner, token, encodeFunctionData({
    abi: erc20Actions,
    functionName: 'approve',
    args: [spender, amount],
  }));
}

async function sendTransaction(owner: string, to: Address, data: Hex): Promise<void> {
  const { client } = baseSepolia();
  const bridge = createWalletBridge({ address: owner, privateKeyEnv: 'WALLET1_PRIVATE_KEY' });
  const hash = await bridge.execute({
    method: 'eth_sendTransaction',
    params: [{ from: owner, to, data }],
  });
  await client.waitForTransactionReceipt({ hash });
}

function baseSepolia() {
  const network = getNetwork('baseSepolia');
  const client = createPublicClient({ chain: network.chain, transport: http(getRpcUrl('baseSepolia')) });
  return { network, client };
}
