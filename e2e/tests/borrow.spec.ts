import { getAddress } from 'viem';
import { compareDisplayedAmount, maxUint256, netWorth, toRaw } from '../blockchain/index.js';
import type { ChainClient } from '../blockchain/index.js';
import { getNetwork } from '../config/networks.js';
import { expect, test } from '../fixtures/index.js';
import { readApproval, readPoolAction, repayVariableDebt, revokeAllowance } from '../helpers/protocol.js';
import type { DashboardPage } from '../pages/dashboard.page.js';
import type { MockWallet } from '../fixtures/wallet.fixture.js';

const borrowAmount = '0.05';
const repayAmount = '0.1';

test.describe('Borrow&repay', { tag: '@Borrow&repay' }, () => {
  test('borrow LINK', {
    annotation: { type: 'Test Id', description: 'BR-001' },
  }, async ({ wallet1Client, connectedWalletPage, dashboardPage, blockchainClient, wallet }) => {
    test.setTimeout(240_000);
    const before = await readLink(blockchainClient, wallet1Client.address);
    await openDashboard(connectedWalletPage, dashboardPage, wallet1Client.address);
    const healthBefore = await dashboardPage.healthFactorValue.innerText();

    await dashboardPage.openBorrow('LINK');
    await expect(dashboardPage.modalHeading('Borrow LINK')).toBeVisible();
    await dashboardPage.fillAmount(borrowAmount);
    await acceptRiskIfShown(dashboardPage);
    await approveIfRequired(dashboardPage, wallet, before.pool, toRaw(borrowAmount, before.decimals));
    await expect(dashboardPage.actionButton).toBeEnabled();
    await dashboardPage.submitModalAction('Borrow LINK');
    await expect(dashboardPage.signatureProgress).toBeVisible();
    const action = readPoolAction(await wallet.signatureRequest());
    expectBorrow(action, before.asset, toRaw(borrowAmount, before.decimals), wallet1Client.address);
    await wallet.sign();
    await dashboardPage.expectTransactionConfirmed();
    await dashboardPage.finishAction();

    const after = await readLink(blockchainClient, wallet1Client.address);
    expect(after.debt - before.debt).toBeGreaterThanOrEqual(action.amount);
    expect(after.debt - before.debt - action.amount).toBeLessThan(action.amount / 100n);
    expect(after.account.healthFactor.raw).not.toBe(before.account.healthFactor.raw);
    await expect(dashboardPage.borrowedAssetRow('LINK')).toBeVisible();
    expectDisplayed(
      await dashboardPage.borrowedAssetRow('LINK').getByTestId('nativeAmount').innerText(),
      after.debt,
      before.decimals,
    );
    expectDisplayed(
      await dashboardPage.healthFactorValue.innerText(),
      after.account.healthFactor.raw,
      after.account.healthFactor.decimals,
    );
    expect(await dashboardPage.healthFactorValue.innerText()).not.toBe(healthBefore);
  });

  test('reject borrow', {
    annotation: { type: 'Test Id', description: 'BR-002' },
  }, async ({ wallet1Client, connectedWalletPage, dashboardPage, blockchainClient, wallet }) => {
    test.setTimeout(180_000);
    const before = await readLink(blockchainClient, wallet1Client.address);
    await openDashboard(connectedWalletPage, dashboardPage, wallet1Client.address);
    const healthBefore = await dashboardPage.healthFactorValue.innerText();
    const netWorthBefore = await dashboardPage.netWorthValue.innerText();

    await dashboardPage.openBorrow('LINK');
    await dashboardPage.fillAmount(borrowAmount);
    await acceptRiskIfShown(dashboardPage);
    await expect(dashboardPage.actionButton).toBeEnabled({ timeout: 20_000 });
    await dashboardPage.submitModalAction('Borrow LINK');
    await expect(dashboardPage.signatureProgress).toBeVisible();
    const action = readPoolAction(await wallet.signatureRequest());
    expectBorrow(action, before.asset, toRaw(borrowAmount, before.decimals), wallet1Client.address);
    await wallet.reject();

    await expect(dashboardPage.transactionCancelled).toBeVisible();
    const after = await readLink(blockchainClient, wallet1Client.address);
    expect(after.balance).toBe(before.balance);
    expect(difference(after.debt, before.debt)).toBeLessThan(10n ** 15n);
    expect(difference(netWorth(after.account).raw, netWorth(before.account).raw)).toBeLessThanOrEqual(1_000_000n);
    await dashboardPage.closeModal();
    expect(await dashboardPage.healthFactorValue.innerText()).toBe(healthBefore);
    expect(await dashboardPage.netWorthValue.innerText()).toBe(netWorthBefore);
  });

  test('repay LINK', {
    annotation: { type: 'Test Id', description: 'BR-003' },
  }, async ({ wallet1Client, connectedWalletPage, dashboardPage, blockchainClient, wallet }) => {
    test.setTimeout(240_000);
    const before = await readLink(blockchainClient, wallet1Client.address);
    const amount = toRaw(repayAmount, before.decimals);
    await openDashboard(connectedWalletPage, dashboardPage, wallet1Client.address);

    await dashboardPage.openRepay('LINK');
    await expect(dashboardPage.modalHeading('Repay LINK')).toBeVisible();
    await dashboardPage.fillAmount(repayAmount);
    await approveIfRequired(dashboardPage, wallet, before.pool, amount);
    await expect(dashboardPage.actionButton).toBeEnabled();
    const [currentDebt, projectedDebt] = await dashboardPage.overviewValues('Remaining debt', 2);
    expectDisplayed(currentDebt, before.debt, before.decimals);
    expectDisplayed(projectedDebt, before.debt - amount, before.decimals);

    await dashboardPage.submitModalAction('Repay LINK');
    await expect(dashboardPage.signatureProgress).toBeVisible();
    const action = readPoolAction(await wallet.signatureRequest());
    expect(action.name === 'repay' || action.name === 'repayWithPermit').toBe(true);
    expect(action.asset).toBe(before.asset);
    expect(action.amount).toBe(amount);
    expect(action.interestRateMode).toBe(2n);
    expect(action.onBehalfOf).toBe(getAddress(wallet1Client.address));
    await wallet.sign();
    await dashboardPage.expectTransactionConfirmed();
    await dashboardPage.finishAction();

    const after = await readLink(blockchainClient, wallet1Client.address);
    expect(before.balance - after.balance).toBe(amount);
    expect(difference(before.debt - after.debt, amount)).toBeLessThan(amount / 100n);
    expectDisplayed(projectedDebt, after.debt, before.decimals);
    expectDisplayed(
      await dashboardPage.borrowedAssetRow('LINK').getByTestId('nativeAmount').innerText(),
      after.debt,
      before.decimals,
    );
    expectDisplayed(
      await dashboardPage.healthFactorValue.innerText(),
      after.account.healthFactor.raw,
      after.account.healthFactor.decimals,
    );
  });

  test('max borrow', {
    annotation: { type: 'Test Id', description: 'BR-004' },
  }, async ({ wallet1Client, connectedWalletPage, dashboardPage, blockchainClient, wallet }) => {
    test.setTimeout(300_000);
    const before = await readLink(blockchainClient, wallet1Client.address);
    let borrowed = 0n;
    try {
      await openDashboard(connectedWalletPage, dashboardPage, wallet1Client.address);
      await dashboardPage.openBorrow('LINK');
      await dashboardPage.chooseMaxAmount();
      await expect(dashboardPage.liquidationRisk).toBeVisible();
      const projected = (await dashboardPage.overviewValues('Health factor', 2))[1];
      expect(Number(projected)).toBeLessThan(1.5);
      const projectedColor = await dashboardPage.projectedHealthFactor(projected).evaluate((element) => getComputedStyle(element).color);
      expect(isLowHealthColor(projectedColor)).toBe(true);
      const [available] = await dashboardPage.overviewValues('Available', 1);

      await dashboardPage.acknowledgeRisks();
      await expect(dashboardPage.actionButton).toBeEnabled({ timeout: 15_000 });
      await dashboardPage.submitModalAction('Borrow LINK');
      await expect(dashboardPage.signatureProgress).toBeVisible();
      const action = readPoolAction(await wallet.signatureRequest());
      expect(action.name).toBe('borrow');
      expect(action.asset).toBe(before.asset);
      expect(action.interestRateMode).toBe(2n);
      expectDisplayed(await dashboardPage.enteredAmount(), action.amount, before.decimals);
      expectDisplayed(available, action.amount, before.decimals);
      await wallet.sign();
      await dashboardPage.expectTransactionConfirmed();
      await dashboardPage.finishAction();
      borrowed = action.amount;

      const after = await readLink(blockchainClient, wallet1Client.address);
      expectDisplayed(
        await dashboardPage.healthFactorValue.innerText(),
        after.account.healthFactor.raw,
        after.account.healthFactor.decimals,
      );
      const shownHealth = numberIn(await dashboardPage.healthFactorValue.innerText());
      expect(shownHealth).toBeLessThan(1.5);
      const healthColor = await dashboardPage.healthFactorValue.evaluate((element) => getComputedStyle(element).color);
      expect(isLowHealthColor(healthColor)).toBe(true);
    } finally {
      if (borrowed > 0n) await repayVariableDebt(wallet1Client.address, before.asset, borrowed);
    }
  });

  test('limited repay allowance', {
    annotation: { type: 'Test Id', description: 'BR-007' },
  }, async ({ wallet1Client, connectedWalletPage, dashboardPage, blockchainClient, wallet }) => {
    test.setTimeout(180_000);
    await expectLimitedAllowance(wallet1Client.address, connectedWalletPage, dashboardPage, blockchainClient, wallet);
  });

  test('unlimited repay allowance', {
    annotation: { type: 'Test Id', description: 'BR-008' },
  }, async ({ wallet1Client, connectedWalletPage, dashboardPage, blockchainClient, wallet }) => {
    test.setTimeout(180_000);
    await expectUnlimitedAllowance(wallet1Client.address, connectedWalletPage, dashboardPage, blockchainClient, wallet);
  });
});

async function expectLimitedAllowance(
  walletAddress: string,
  connectedWalletPage: Parameters<typeof openDashboard>[0],
  dashboardPage: DashboardPage,
  blockchain: ChainClient,
  wallet: MockWallet,
): Promise<void> {
  const position = await readLink(blockchain, walletAddress);
  await revokeAllowance(walletAddress, position.asset, position.pool);
  await openDashboard(connectedWalletPage, dashboardPage, walletAddress);
  await openRepay(dashboardPage);
  await dashboardPage.fillAmount(repayAmount);
  await expect(dashboardPage.approvalButton).toBeEnabled();
  await dashboardPage.editAllowance('Limited');
  await dashboardPage.submitApproval('LINK');
  await expect(dashboardPage.signatureProgress).toBeVisible();
  const approval = readApproval(await wallet.signatureRequest());
  expect(approval.spender).toBe(position.pool);
  expectDisplayed(repayAmount, approval.amount, position.decimals);
  await wallet.sign();
}

async function expectUnlimitedAllowance(
  walletAddress: string,
  connectedWalletPage: Parameters<typeof openDashboard>[0],
  dashboardPage: DashboardPage,
  blockchain: ChainClient,
  wallet: MockWallet,
): Promise<void> {
  const position = await readLink(blockchain, walletAddress);
  await revokeAllowance(walletAddress, position.asset, position.pool);
  await openDashboard(connectedWalletPage, dashboardPage, walletAddress);
  await openRepay(dashboardPage);
  await dashboardPage.fillAmount(repayAmount);
  await expect(dashboardPage.approvalButton).toBeEnabled();
  await dashboardPage.editAllowance('Unlimited');
  await expect(dashboardPage.actionModal.getByText('Unlimited', { exact: true })).toBeVisible();
  await dashboardPage.submitApproval('LINK');
  await expect(dashboardPage.signatureProgress).toBeVisible();
  const approval = readApproval(await wallet.signatureRequest());
  expect(approval.spender).toBe(position.pool);
  expect(approval.amount).toBe(maxUint256);
  await wallet.sign();
}

async function openRepay(dashboardPage: DashboardPage): Promise<void> {
  await dashboardPage.openRepay('LINK');
  await expect(dashboardPage.modalHeading('Repay LINK')).toBeVisible();
}

async function acceptRiskIfShown(dashboardPage: DashboardPage): Promise<void> {
  await expect.poll(async () => {
    if (await dashboardPage.liquidationRisk.isVisible()) return 'risk';
    if (await dashboardPage.actionButton.isEnabled()) return 'ready';
    return '';
  }, { timeout: 20_000 }).not.toBe('');
  if (await dashboardPage.liquidationRisk.isVisible()) await dashboardPage.acknowledgeRisks();
}

async function approveIfRequired(
  dashboardPage: DashboardPage,
  wallet: MockWallet,
  pool: `0x${string}`,
  amount: bigint,
): Promise<void> {
  await expect.poll(async () => {
    if (await dashboardPage.approvalButton.isVisible()) return 'approve';
    if (await dashboardPage.actionButton.isEnabled()) return 'ready';
    return '';
  }, { timeout: 20_000 }).not.toBe('');
  if (!(await dashboardPage.approvalButton.isVisible())) return;
  await dashboardPage.submitApproval('LINK');
  await expect(dashboardPage.signatureProgress).toBeVisible();
  const approval = readApproval(await wallet.signatureRequest());
  expect(approval.spender).toBe(pool);
  expect(approval.amount).toBeGreaterThanOrEqual(amount);
  await wallet.sign();
}

function expectBorrow(
  action: ReturnType<typeof readPoolAction>,
  asset: `0x${string}`,
  amount: bigint,
  walletAddress: string,
): void {
  expect(action.name).toBe('borrow');
  expect(action.asset).toBe(asset);
  expect(action.amount).toBe(amount);
  expect(action.interestRateMode).toBe(2n);
  expect(action.onBehalfOf).toBe(getAddress(walletAddress));
}

async function openDashboard(
  connectedWalletPage: { accountButton(address: string): import('@playwright/test').Locator },
  dashboardPage: DashboardPage,
  walletAddress: string,
): Promise<void> {
  await dashboardPage.open();
  await expect(connectedWalletPage.accountButton(walletAddress)).toBeVisible();
}

async function readLink(blockchain: ChainClient, wallet: string) {
  const network = getNetwork('baseSepolia');
  const [reserve, balance, account] = await Promise.all([
    blockchain.aaveReserve(wallet, 'LINK'),
    blockchain.token('LINK').balanceOf(wallet),
    blockchain.aaveUser(wallet),
  ]);
  return {
    asset: network.tokens.LINK.address,
    pool: network.pool,
    debt: reserve.variableDebt.raw,
    balance: balance.raw,
    decimals: reserve.token.decimals,
    account,
  };
}

function expectDisplayed(displayed: string, raw: bigint, decimals: number): void {
  const line = displayed
    .split('\n')
    .map((item) => item.trim())
    .find((item) => /\d/.test(item)) ?? displayed;
  const comparison = compareDisplayedAmount(line, raw, decimals);
  expect(comparison.difference).toBeLessThanOrEqual(comparison.tolerance);
}

function numberIn(displayed: string): number {
  const line = displayed.split('\n').map((item) => item.trim()).find((item) => /\d/.test(item)) ?? displayed;
  return Number(line.replace(/[^0-9.-]/g, ''));
}

function difference(left: bigint, right: bigint): bigint {
  return left > right ? left - right : right - left;
}

function isLowHealthColor(color: string): boolean {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return false;
  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);
  const safeGreen = green > red && green > blue;
  return !safeGreen && red >= 140;
}
