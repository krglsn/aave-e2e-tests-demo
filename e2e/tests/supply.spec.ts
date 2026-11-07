import { createPublicClient, decodeFunctionData, encodeFunctionData, getAddress, http, type Address } from 'viem';
import { compareDisplayedAmount, netWorth, toRaw } from '../blockchain/index.js';
import { erc20Abi } from '../blockchain/erc20.js';
import { getNetwork } from '../config/networks.js';
import { getRpcUrl } from '../config/rpc.js';
import { expect, test } from '../fixtures/index.js';
import { createWalletBridge } from '../fixtures/wallet-rpc.js';
import type { SignatureRequest } from '../fixtures/wallet.fixture.js';

const supplyActions = [
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
] as const;

const suppliedWithin = 90_000;

test.describe('Supply flow', { tag: '@Supply flow' }, () => {
  test('supply USDC', {
    annotation: { type: 'Test Id', description: 'SF-001' },
  }, async ({ wallet1, connectedWalletPage, dashboardPage, blockchain, wallet }) => {
    test.setTimeout(240_000);
    const network = getNetwork('baseSepolia');
    const usdc = network.tokens.USDC.address;
    const amount = toRaw('10', (await blockchain.token('USDC').details()).decimals);

    const beforeAccount = await blockchain.aaveUser(wallet1.address);
    const beforeSupplied = (await blockchain.aaveReserve(wallet1.address, 'USDC')).supplied.raw;
    const beforeBalance = (await blockchain.token('USDC').balanceOf(wallet1.address)).raw;
    await clearAllowance(wallet1.address, usdc, network.pool, amount);

    await dashboardPage.open();
    await expect(connectedWalletPage.accountButton(wallet1.address)).toBeVisible();
    const netWorthBefore = await dashboardPage.netWorthValue.innerText();
    const collateralBefore = await dashboardPage.collateralValue.innerText();

    await dashboardPage.openAssetSupply('USDC');
    await expect(dashboardPage.modalHeading('Supply USDC')).toBeVisible();
    await dashboardPage.enterSupplyAmount('10');

    await dashboardPage.submitSupplyAction('USDC', 'Approve');
    await expect(dashboardPage.signatureProgress).toBeVisible();
    expectApproval(await wallet.signatureRequest(), network.pool, amount);
    await wallet.sign();

    await expect(dashboardPage.supplyAction('USDC', 'Supply')).toBeEnabled({ timeout: suppliedWithin });
    await dashboardPage.submitSupplyAction('USDC', 'Supply');
    await expect(dashboardPage.signatureProgress).toBeVisible();
    expectSupply(await wallet.signatureRequest(), usdc, amount, getAddress(wallet1.address));
    await wallet.sign();

    await expect(dashboardPage.supplyModal).toContainText(/supplied/i, { timeout: suppliedWithin });
    await dashboardPage.finishSupply();

    const afterAccount = await blockchain.aaveUser(wallet1.address);
    const suppliedNow = (await blockchain.aaveReserve(wallet1.address, 'USDC')).supplied.raw;
    const balanceNow = (await blockchain.token('USDC').balanceOf(wallet1.address)).raw;
    const suppliedIncrease = suppliedNow - beforeSupplied;
    expect(suppliedIncrease).toBeGreaterThanOrEqual(amount - 1n);
    expect(suppliedIncrease).toBeLessThanOrEqual(amount);
    expect(beforeBalance - balanceNow).toBe(amount);
    expect(afterAccount.totalCollateral.raw).toBeGreaterThan(beforeAccount.totalCollateral.raw);
    expect(netWorth(afterAccount).raw).toBeGreaterThan(netWorth(beforeAccount).raw);

    const decimals = (await blockchain.token('USDC').details()).decimals;
    await expect(dashboardPage.suppliedAssetRow('USDC').getByTestId('nativeAmount')).toBeVisible();
    const suppliedComparison = compareDisplayedAmount(
      firstLine(await dashboardPage.suppliedAssetRow('USDC').getByTestId('nativeAmount').innerText()),
      suppliedNow,
      decimals,
    );
    expect(suppliedComparison.difference).toBeLessThanOrEqual(suppliedComparison.tolerance);
    const balanceComparison = compareDisplayedAmount(
      firstLine(await dashboardPage.supplyAssetRow('USDC').getByTestId('nativeAmount').innerText()),
      balanceNow,
      decimals,
    );
    expect(balanceComparison.difference).toBeLessThanOrEqual(balanceComparison.tolerance);

    const worth = netWorth(afterAccount);
    const worthComparison = compareDisplayedAmount(
      await dashboardPage.netWorthValue.innerText(),
      worth.raw,
      worth.decimals,
    );
    expect(worthComparison.difference).toBeLessThanOrEqual(worthComparison.tolerance);
    expect(await dashboardPage.netWorthValue.innerText()).not.toBe(netWorthBefore);

    const collateralComparison = compareDisplayedAmount(
      await dashboardPage.collateralValue.innerText(),
      afterAccount.totalCollateral.raw,
      afterAccount.totalCollateral.decimals,
    );
    expect(collateralComparison.difference).toBeLessThanOrEqual(collateralComparison.tolerance);
    expect(await dashboardPage.collateralValue.innerText()).not.toBe(collateralBefore);
  });
});

function firstLine(value: string): string {
  return value.split('\n')[0] ?? value;
}

async function clearAllowance(owner: string, token: Address, spender: Address, amount: bigint): Promise<void> {
  const network = getNetwork('baseSepolia');
  const client = createPublicClient({ chain: network.chain, transport: http(getRpcUrl('baseSepolia')) });
  const allowance = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [getAddress(owner), spender],
  });
  if (allowance < amount) return;

  const bridge = createWalletBridge({ address: owner, privateKeyEnv: 'WALLET1_PRIVATE_KEY' });
  const hash = await bridge.execute({
    method: 'eth_sendTransaction',
    params: [{
      from: owner,
      to: token,
      data: encodeFunctionData({ abi: supplyActions, functionName: 'approve', args: [spender, 0n] }),
    }],
  });
  await client.waitForTransactionReceipt({ hash });
}

function expectApproval(request: SignatureRequest, spender: Address, amount: bigint): void {
  if (request.type === 'typedData') {
    expect(request.primaryType.toLowerCase()).toContain('permit');
    expect(getAddress(String(request.message.spender))).toBe(spender);
    expect(BigInt(String(request.message.value))).toBeGreaterThanOrEqual(amount);
    return;
  }
  expect(request.type).toBe('transaction');
  if (request.type !== 'transaction') return;
  const decoded = decodeFunctionData({ abi: supplyActions, data: request.data });
  expect(decoded.functionName).toBe('approve');
  expect(getAddress(String(decoded.args[0]))).toBe(spender);
  expect(decoded.args[1]).toBeGreaterThanOrEqual(amount);
}

function expectSupply(request: SignatureRequest, asset: Address, amount: bigint, onBehalfOf: Address): void {
  expect(request.type).toBe('transaction');
  if (request.type !== 'transaction') return;
  const decoded = decodeFunctionData({ abi: supplyActions, data: request.data });
  expect(decoded.functionName === 'supply' || decoded.functionName === 'supplyWithPermit').toBe(true);
  expect(getAddress(String(decoded.args[0]))).toBe(asset);
  expect(decoded.args[1]).toBe(amount);
  expect(getAddress(String(decoded.args[2]))).toBe(onBehalfOf);
}
