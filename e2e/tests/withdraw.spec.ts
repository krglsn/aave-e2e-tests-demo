import { getAddress } from 'viem';
import { compareDisplayedAmount, netWorth, toRaw, type UserAccountData } from '../blockchain/index.js';
import type { ChainClient } from '../blockchain/index.js';
import { getNetwork } from '../config/networks.js';
import { expect, test } from '../fixtures/index.js';
import { readPoolAction } from '../helpers/protocol.js';
import type { DashboardPage } from '../pages/dashboard.page.js';

test.describe('Withdraw flow', { tag: '@Withdraw flow' }, () => {
  test('withdraw 10 USDC', {
    annotation: { type: 'Test Id', description: 'WF-001' },
  }, async ({ preconditionBuilder, wallet1Client, connectedWalletPage, dashboardPage, blockchainClient, wallet }) => {
    test.setTimeout(240_000);
    await preconditionBuilder({ USDC: { supply: '100' }, USDT: { supply: '100' } });
    const position = await readPosition(blockchainClient, wallet1Client.address, 'USDC');
    await dashboardPage.open();
    await expect(connectedWalletPage.accountButton(wallet1Client.address)).toBeVisible();
    const netWorthBefore = await dashboardPage.netWorthValue.innerText();
    const collateralBefore = await dashboardPage.collateralValue.innerText();

    await dashboardPage.openWithdraw('USDC');
    await expect(dashboardPage.modalHeading('Withdraw USDC')).toBeVisible();
    await expectPreview(dashboardPage, position.supplied, position.decimals, '1');
    const previousRemaining = (await dashboardPage.overviewValues('Remaining supply', 1))[0];
    await expectPreview(dashboardPage, position.supplied, position.decimals, '4');
    expect((await dashboardPage.overviewValues('Remaining supply', 1))[0]).not.toBe(previousRemaining);

    const amount = toRaw('10', position.decimals);
    await expectPreview(dashboardPage, position.supplied, position.decimals, '10');
    const [remaining] = await dashboardPage.overviewValues('Remaining supply', 1);
    const projectedHealth = (await dashboardPage.overviewValues('Health factor', 2))[1];

    await expect(dashboardPage.actionButton).toBeEnabled();
    await dashboardPage.submitModalAction('Withdraw USDC');
    await expect(dashboardPage.signatureProgress).toBeVisible();
    const action = readPoolAction(await wallet.signatureRequest());
    expect(action.name).toBe('withdraw');
    expect(action.asset).toBe(position.asset);
    expect(action.amount).toBe(amount);
    expect(action.onBehalfOf).toBe(getAddress(wallet1Client.address));
    await wallet.sign();
    await dashboardPage.expectTransactionConfirmed();
    await dashboardPage.finishAction();

    const after = await readPosition(blockchainClient, wallet1Client.address, 'USDC');
    const suppliedDecrease = position.supplied - after.supplied;
    expect(suppliedDecrease).toBeGreaterThanOrEqual(amount - 1n);
    expect(suppliedDecrease).toBeLessThanOrEqual(amount + 1n);
    expect(after.balance - position.balance).toBe(amount);
    expect(after.account.totalCollateral.raw).toBeLessThan(position.account.totalCollateral.raw);
    expect(netWorth(after.account).raw).toBeLessThan(netWorth(position.account).raw);

    expectDisplayed(remaining, after.supplied, position.decimals);
    expectDisplayed(
      await dashboardPage.suppliedAssetRow('USDC').getByTestId('nativeAmount').innerText(),
      after.supplied,
      position.decimals,
    );
    expectDisplayed(
      await dashboardPage.supplyAssetRow('USDC').getByTestId('nativeAmount').innerText(),
      after.balance,
      position.decimals,
    );
    const worth = netWorth(after.account);
    expectDisplayed(await dashboardPage.netWorthValue.innerText(), worth.raw, worth.decimals);
    expect(await dashboardPage.netWorthValue.innerText()).not.toBe(netWorthBefore);
    expectDisplayed(
      await dashboardPage.collateralValue.innerText(),
      after.account.totalCollateral.raw,
      after.account.totalCollateral.decimals,
    );
    expect(await dashboardPage.collateralValue.innerText()).not.toBe(collateralBefore);
    expectDisplayed(await dashboardPage.healthFactorValue.innerText(), after.account.healthFactor.raw, after.account.healthFactor.decimals);
    expectDisplayed(projectedHealth, after.account.healthFactor.raw, after.account.healthFactor.decimals);
  });

  test('reject withdrawing USDT', {
    annotation: { type: 'Test Id', description: 'WF-002' },
  }, async ({ preconditionBuilder, wallet1Client, connectedWalletPage, dashboardPage, blockchainClient, wallet }) => {
    test.setTimeout(180_000);
    await preconditionBuilder({ USDT: { supply: '100' }, USDC: { supply: '100' } });
    const position = await readPosition(blockchainClient, wallet1Client.address, 'USDT');
    await dashboardPage.open();
    await expect(connectedWalletPage.accountButton(wallet1Client.address)).toBeVisible();
    const netWorthBefore = await dashboardPage.netWorthValue.innerText();
    const collateralBefore = await dashboardPage.collateralValue.innerText();

    await dashboardPage.openWithdraw('USDT');
    await expect(dashboardPage.modalHeading('Withdraw USDT')).toBeVisible();
    await expectPreview(dashboardPage, position.supplied, position.decimals, '10');
    const [currentHealth, projectedHealth] = await dashboardPage.overviewValues('Health factor', 2);
    expect(projectedHealth).not.toBe(currentHealth);

    await expect(dashboardPage.actionButton).toBeEnabled();
    await dashboardPage.submitModalAction('Withdraw USDT');
    await expect(dashboardPage.signatureProgress).toBeVisible();
    const action = readPoolAction(await wallet.signatureRequest());
    expect(action.name).toBe('withdraw');
    expect(action.asset).toBe(position.asset);
    expect(action.amount).toBe(toRaw('10', position.decimals));
    await wallet.reject();

    await expect(dashboardPage.transactionCancelled).toBeVisible();
    const after = await readPosition(blockchainClient, wallet1Client.address, 'USDT');
    expect(after.supplied).toBe(position.supplied);
    expect(after.balance).toBe(position.balance);
    expect(difference(after.account.totalCollateral.raw, position.account.totalCollateral.raw)).toBeLessThanOrEqual(1_000_000n);
    expect(difference(netWorth(after.account).raw, netWorth(position.account).raw)).toBeLessThanOrEqual(1_000_000n);
    await dashboardPage.closeModal();
    expect(await dashboardPage.netWorthValue.innerText()).toBe(netWorthBefore);
    expect(await dashboardPage.collateralValue.innerText()).toBe(collateralBefore);
  });
});

async function expectPreview(
  dashboardPage: DashboardPage,
  supplied: bigint,
  decimals: number,
  amount: string,
): Promise<void> {
  await dashboardPage.enterWithdrawAmount(amount);
  await expect(dashboardPage.actionButton).toBeEnabled();
  const [remaining] = await dashboardPage.overviewValues('Remaining supply', 1);
  expectDisplayed(remaining, supplied - toRaw(amount, decimals), decimals);
}

async function readPosition(blockchain: ChainClient, wallet: string, symbol: 'USDC' | 'USDT') {
  const asset = getNetwork('baseSepolia').tokens[symbol].address;
  const [reserve, token, account] = await Promise.all([
    blockchain.aaveReserve(wallet, symbol),
    blockchain.token(symbol).balanceOf(wallet),
    blockchain.aaveUser(wallet),
  ]);
  return {
    asset,
    supplied: reserve.supplied.raw,
    balance: token.raw,
    decimals: reserve.token.decimals,
    account: account as UserAccountData,
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

function difference(left: bigint, right: bigint): bigint {
  return left > right ? left - right : right - left;
}
