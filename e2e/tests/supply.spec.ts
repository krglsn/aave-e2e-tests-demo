import { getAddress } from 'viem';
import { compareDisplayedAmount, netWorth, toRaw, type UserAccountData } from '../blockchain/index.js';
import type { ChainClient } from '../blockchain/index.js';
import { getNetwork } from '../config/networks.js';
import { expect, test } from '../fixtures/index.js';
import type { MockWallet } from '../fixtures/wallet.fixture.js';
import { readApproval, readPoolAction } from '../helpers/protocol.js';
import type { DashboardPage } from '../pages/dashboard.page.js';
import type { UnauthorisedAavePage } from '../pages/unauthorised-aave.page.js';

const settledWithin = 90_000;

test.describe('Supply flow', { tag: '@Supply flow' }, () => {
  test('supply 10 USDC (permit EIP-712)', {
    annotation: { type: 'Test Id', description: 'SF-001' },
  }, async ({ preconditionBuilder, wallet1Client, connectedWalletPage, dashboardPage, blockchainClient, wallet }) => {
    test.setTimeout(240_000);
    await preconditionBuilder({ USDC: { supply: '0', approval: 'none' } });
    const prepared = await prepareSupply(wallet1Client.address, 'USDC', blockchainClient);
    const shown = await openSupply(connectedWalletPage, dashboardPage, wallet1Client.address, 'USDC');

    await dashboardPage.submitSupplyAction('USDC', 'Approve');
    await expect(dashboardPage.signatureProgress).toBeVisible();
    expectApprovalAtLeast(await wallet.signatureRequest(), prepared.pool, prepared.amount);
    await wallet.sign();

    await supplyAndSign(dashboardPage, wallet, 'USDC', prepared.asset, prepared.amount, wallet1Client.address);
    await expectSupplied({
      dashboardPage,
      blockchain: blockchainClient,
      wallet: wallet1Client.address,
      symbol: 'USDC',
      ...prepared,
      ...shown,
    });
  });

  test('supply USDC and reject approve', {
    annotation: { type: 'Test Id', description: 'SF-002' },
  }, async ({ preconditionBuilder, wallet1Client, connectedWalletPage, dashboardPage, blockchainClient, wallet }) => {
    test.setTimeout(240_000);
    await preconditionBuilder({ USDC: { supply: '0', approval: 'none' } });
    const prepared = await prepareSupply(wallet1Client.address, 'USDC', blockchainClient);
    const shown = await openSupply(connectedWalletPage, dashboardPage, wallet1Client.address, 'USDC');

    await dashboardPage.submitSupplyAction('USDC', 'Approve');
    await expect(dashboardPage.signatureProgress).toBeVisible();
    expectApprovalAtLeast(await wallet.signatureRequest(), prepared.pool, prepared.amount);
    await wallet.reject();

    await expect(dashboardPage.transactionCancelled).toBeVisible();
    await expectUnchanged(dashboardPage, blockchainClient, wallet1Client.address, 'USDC', prepared, shown);
  });

  test('supply USDC and reject supply', {
    annotation: { type: 'Test Id', description: 'SF-003' },
  }, async ({ preconditionBuilder, wallet1Client, connectedWalletPage, dashboardPage, blockchainClient, wallet }) => {
    test.setTimeout(240_000);
    await preconditionBuilder({ USDC: { supply: '0', approval: 'none' } });
    const prepared = await prepareSupply(wallet1Client.address, 'USDC', blockchainClient);
    const shown = await openSupply(connectedWalletPage, dashboardPage, wallet1Client.address, 'USDC');

    await dashboardPage.submitSupplyAction('USDC', 'Approve');
    await expect(dashboardPage.signatureProgress).toBeVisible();
    expectApprovalAtLeast(await wallet.signatureRequest(), prepared.pool, prepared.amount);
    await wallet.sign();

    await expect(dashboardPage.supplyAction('USDC', 'Supply')).toBeEnabled({ timeout: settledWithin });
    await dashboardPage.submitSupplyAction('USDC', 'Supply');
    await expect(dashboardPage.signatureProgress).toBeVisible();
    expectSupply(await wallet.signatureRequest(), prepared.asset, prepared.amount, wallet1Client.address);
    await wallet.reject();

    await expect(dashboardPage.transactionCancelled).toBeVisible();
    await expectUnchanged(dashboardPage, blockchainClient, wallet1Client.address, 'USDC', prepared, shown);

    await dashboardPage.openAssetSupply('USDC');
    await expect(dashboardPage.modalHeading('Supply USDC')).toBeVisible();
    await dashboardPage.enterSupplyAmount('10');
    await expect.poll(async () =>
      (await dashboardPage.approvalButton.isVisible()) || (await dashboardPage.supplyAction('USDC', 'Supply').isVisible()),
    ).toBe(true);
    if (await dashboardPage.approvalButton.isVisible()) {
      await dashboardPage.submitSupplyAction('USDC', 'Approve');
      await expect(dashboardPage.signatureProgress).toBeVisible();
      expectApprovalAtLeast(await wallet.signatureRequest(), prepared.pool, prepared.amount);
      await wallet.sign();
    }
    await supplyAndSign(dashboardPage, wallet, 'USDC', prepared.asset, prepared.amount, wallet1Client.address);
    await expectSupplied({
      dashboardPage,
      blockchain: blockchainClient,
      wallet: wallet1Client.address,
      symbol: 'USDC',
      ...prepared,
      ...shown,
    });
  });

  test('supply 10 USDT', {
    annotation: { type: 'Test Id', description: 'SF-004' },
  }, async ({ preconditionBuilder, wallet1Client, connectedWalletPage, dashboardPage, blockchainClient, wallet }) => {
    test.setTimeout(240_000);
    await preconditionBuilder({ USDT: { supply: '100', approval: '100' } });
    const prepared = await prepareSupply(wallet1Client.address, 'USDT', blockchainClient);
    const shown = await openSupply(connectedWalletPage, dashboardPage, wallet1Client.address, 'USDT');

    await expect(dashboardPage.approvalButton).toBeHidden();
    await expect(dashboardPage.supplyAction('USDT', 'Supply')).toBeEnabled();
    await supplyAndSign(dashboardPage, wallet, 'USDT', prepared.asset, prepared.amount, wallet1Client.address);
    await expectSupplied({
      dashboardPage,
      blockchain: blockchainClient,
      wallet: wallet1Client.address,
      symbol: 'USDT',
      ...prepared,
      ...shown,
    });
  });
});

type PreparedSupply = {
  asset: `0x${string}`;
  pool: `0x${string}`;
  amount: bigint;
  decimals: number;
  beforeSupplied: bigint;
  beforeBalance: bigint;
  beforeAccount: UserAccountData;
};

type ShownPosition = {
  netWorthBefore: string;
  collateralBefore: string;
};

async function prepareSupply(
  walletAddress: string,
  symbol: 'USDC' | 'USDT',
  blockchain: ChainClient,
): Promise<PreparedSupply> {
  const network = getNetwork('baseSepolia');
  const asset = network.tokens[symbol].address;
  const amount = toRaw('10', (await blockchain.token(symbol).details()).decimals);
  const beforeAccount = await blockchain.aaveUser(walletAddress);
  const beforeSupplied = (await blockchain.aaveReserve(walletAddress, symbol)).supplied.raw;
  const beforeBalance = (await blockchain.token(symbol).balanceOf(walletAddress)).raw;
  return {
    asset,
    pool: network.pool,
    amount,
    decimals: (await blockchain.token(symbol).details()).decimals,
    beforeSupplied,
    beforeBalance,
    beforeAccount,
  };
}

async function openSupply(
  connectedWalletPage: UnauthorisedAavePage,
  dashboardPage: DashboardPage,
  walletAddress: string,
  symbol: string,
): Promise<ShownPosition> {
  await dashboardPage.open();
  await expect(connectedWalletPage.accountButton(walletAddress)).toBeVisible();
  const netWorthBefore = await dashboardPage.netWorthValue.innerText();
  const collateralBefore = await dashboardPage.collateralValue.innerText();
  await dashboardPage.openAssetSupply(symbol);
  await expect(dashboardPage.modalHeading(`Supply ${symbol}`)).toBeVisible();
  await dashboardPage.enterSupplyAmount('10');
  return { netWorthBefore, collateralBefore };
}

async function supplyAndSign(
  dashboardPage: DashboardPage,
  wallet: MockWallet,
  symbol: 'USDC' | 'USDT',
  asset: `0x${string}`,
  amount: bigint,
  walletAddress: string,
): Promise<void> {
  await expect(dashboardPage.supplyAction(symbol, 'Supply')).toBeEnabled({ timeout: settledWithin });
  await dashboardPage.submitSupplyAction(symbol, 'Supply');
  await expect(dashboardPage.signatureProgress).toBeVisible();
  expectSupply(await wallet.signatureRequest(), asset, amount, walletAddress);
  await wallet.sign();
  await dashboardPage.expectTransactionConfirmed();
  await dashboardPage.finishSupply();
}

function expectApprovalAtLeast(
  request: Parameters<typeof readApproval>[0],
  spender: `0x${string}`,
  amount: bigint,
): void {
  const approval = readApproval(request);
  expect(approval.spender).toBe(spender);
  expect(approval.amount).toBeGreaterThanOrEqual(amount);
}

function expectSupply(
  request: Parameters<typeof readPoolAction>[0],
  asset: `0x${string}`,
  amount: bigint,
  onBehalfOf: string,
): void {
  const action = readPoolAction(request);
  expect(action.name === 'supply' || action.name === 'supplyWithPermit').toBe(true);
  expect(action.asset).toBe(asset);
  expect(action.amount).toBe(amount);
  expect(action.onBehalfOf).toBe(getAddress(onBehalfOf));
}

async function expectUnchanged(
  dashboardPage: DashboardPage,
  blockchain: ChainClient,
  walletAddress: string,
  symbol: 'USDC' | 'USDT',
  prepared: PreparedSupply,
  shown: ShownPosition,
): Promise<void> {
  const suppliedNow = (await blockchain.aaveReserve(walletAddress, symbol)).supplied.raw;
  const balanceNow = (await blockchain.token(symbol).balanceOf(walletAddress)).raw;
  const accountNow = await blockchain.aaveUser(walletAddress);
  expect(suppliedNow).toBe(prepared.beforeSupplied);
  expect(balanceNow).toBe(prepared.beforeBalance);
  // Existing debt accrues a fraction of a cent while the rejected signature is open.
  expect(difference(accountNow.totalCollateral.raw, prepared.beforeAccount.totalCollateral.raw)).toBeLessThanOrEqual(1_000_000n);
  expect(difference(netWorth(accountNow).raw, netWorth(prepared.beforeAccount).raw)).toBeLessThanOrEqual(1_000_000n);
  await dashboardPage.closeModal();
  expect(await dashboardPage.netWorthValue.innerText()).toBe(shown.netWorthBefore);
  expect(await dashboardPage.collateralValue.innerText()).toBe(shown.collateralBefore);
}

async function expectSupplied(input: {
  dashboardPage: DashboardPage;
  blockchain: ChainClient;
  wallet: string;
  symbol: 'USDC' | 'USDT';
  amount: bigint;
  decimals: number;
  beforeSupplied: bigint;
  beforeBalance: bigint;
  beforeAccount: UserAccountData;
  netWorthBefore: string;
  collateralBefore: string;
}): Promise<void> {
  const afterAccount = await input.blockchain.aaveUser(input.wallet);
  const suppliedNow = (await input.blockchain.aaveReserve(input.wallet, input.symbol)).supplied.raw;
  const balanceNow = (await input.blockchain.token(input.symbol).balanceOf(input.wallet)).raw;
  const suppliedIncrease = suppliedNow - input.beforeSupplied;
  // The liquidity index rounds the minted aToken balance down by a few raw units.
  const supplyRounding = 5n;
  expect(suppliedIncrease).toBeGreaterThanOrEqual(input.amount - supplyRounding);
  expect(suppliedIncrease).toBeLessThanOrEqual(input.amount);
  expect(input.beforeBalance - balanceNow).toBe(input.amount);
  expect(afterAccount.totalCollateral.raw).toBeGreaterThan(input.beforeAccount.totalCollateral.raw);
  expect(netWorth(afterAccount).raw).toBeGreaterThan(netWorth(input.beforeAccount).raw);

  await expect(input.dashboardPage.suppliedAssetRow(input.symbol).getByTestId('nativeAmount')).toBeVisible();
  expectDisplayed(
    await input.dashboardPage.suppliedAssetRow(input.symbol).getByTestId('nativeAmount').innerText(),
    suppliedNow,
    input.decimals,
  );
  expectDisplayed(
    await input.dashboardPage.supplyAssetRow(input.symbol).getByTestId('nativeAmount').innerText(),
    balanceNow,
    input.decimals,
  );

  const worth = netWorth(afterAccount);
  expectDisplayed(await input.dashboardPage.netWorthValue.innerText(), worth.raw, worth.decimals);
  expect(await input.dashboardPage.netWorthValue.innerText()).not.toBe(input.netWorthBefore);
  expectDisplayed(
    await input.dashboardPage.collateralValue.innerText(),
    afterAccount.totalCollateral.raw,
    afterAccount.totalCollateral.decimals,
  );
  expect(await input.dashboardPage.collateralValue.innerText()).not.toBe(input.collateralBefore);
}

function expectDisplayed(displayed: string, raw: bigint, decimals: number): void {
  const line = displayed
    .split('\n')
    .map((item) => item.trim())
    .find((item) => /\d/.test(item)) ?? displayed;
  const comparison = compareDisplayedAmount(line, raw, decimals);
  expect(comparison.difference).toBeLessThanOrEqual(comparison.tolerance);
}

function difference(left: bigint, right: bigint): bigint {
  return left > right ? left - right : right - left;
}
