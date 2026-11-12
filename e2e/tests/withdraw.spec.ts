import { getAddress } from 'viem';
import { compareDisplayedAmount, netWorth, toRaw, type UserAccountData } from '../blockchain/index.js';
import type { ChainClient } from '../blockchain/index.js';
import { getNetwork } from '../config/networks.js';
import { expect, test } from '../fixtures/index.js';
import type { AaveClient } from '../blockchain/aave-client.js';
import { readPoolAction } from '../helpers/protocol.js';
import type { DashboardPage } from '../pages/dashboard.page.js';

test.describe('Withdraw flow', { tag: '@Withdraw flow' }, () => {
  test.describe.configure({ lock: 'wallet1-position' });
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

  test.describe('WF-003', () => {
  test('withdraw 10 USDC', {
    annotation: { type: 'Test Id', description: 'WF-003' },
  }, async ({ preconditionBuilder, aaveClient, wallet1Client, connectedWalletPage, dashboardPage, blockchainClient, wallet }) => {
    test.setTimeout(300_000);
    // 115 USDT of debt puts the health factor after this withdraw inside the 1–1.5 warning band.
    await preconditionBuilder({
      USDC: { supply: await supplyTarget(aaveClient, 'USDC') },
      USDT: { supply: await supplyTarget(aaveClient, 'USDT'), borrow: '115' },
      LINK: { borrow: '0' },
    });
    const position = await readPosition(blockchainClient, wallet1Client.address, 'USDC');
    await dashboardPage.open();
    await expect(connectedWalletPage.accountButton(wallet1Client.address)).toBeVisible();

    await dashboardPage.openWithdraw('USDC');
    await expect(dashboardPage.modalHeading('Withdraw USDC')).toBeVisible();
    await dashboardPage.fillAmount('10');
    await expect(dashboardPage.withdrawLiquidationRisk).toBeVisible();
    const [remaining] = await dashboardPage.overviewValues('Remaining supply', 1);
    expectDisplayed(remaining, position.supplied - toRaw('10', position.decimals), position.decimals);
    const projectedHealth = (await dashboardPage.overviewValues('Health factor', 2))[1];
    expect(Number(projectedHealth)).toBeGreaterThanOrEqual(1);
    expect(Number(projectedHealth)).toBeLessThan(1.5);
    await expect(dashboardPage.withdrawLiquidationRisk).toBeVisible();
    await expect(dashboardPage.actionButton).toBeDisabled();

    await dashboardPage.acknowledgeRisks();
    await expect(dashboardPage.actionButton).toBeEnabled();
    await dashboardPage.submitModalAction('Withdraw USDC');
    await expect(dashboardPage.signatureProgress).toBeVisible();
    const action = readPoolAction(await wallet.signatureRequest());
    expect(action.name).toBe('withdraw');
    expect(action.asset).toBe(position.asset);
    expect(action.amount).toBe(toRaw('10', position.decimals));
    await wallet.sign();
    await dashboardPage.expectTransactionConfirmed();
    await dashboardPage.finishAction();

    const after = await readPosition(blockchainClient, wallet1Client.address, 'USDC');
    const suppliedDecrease = position.supplied - after.supplied;
    expect(suppliedDecrease).toBeGreaterThanOrEqual(toRaw('10', position.decimals) - 1n);
    expect(suppliedDecrease).toBeLessThanOrEqual(toRaw('10', position.decimals) + 1n);
  });
  });

  test('full withdraw not allowed', {
    annotation: { type: 'Test Id', description: 'WF-004' },
  }, async ({ preconditionBuilder, aaveClient, wallet1Client, connectedWalletPage, dashboardPage, blockchainClient }) => {
    test.setTimeout(300_000);
    // 90 USDT cannot be borrowed against 100 USDC at the current loan-to-value, so USDT supply stays.
    await preconditionBuilder({
      USDC: { supply: await supplyTarget(aaveClient, 'USDC') },
      USDT: { supply: await supplyTarget(aaveClient, 'USDT'), borrow: '90' },
    });
    const position = await readPosition(blockchainClient, wallet1Client.address, 'USDC');
    await dashboardPage.open();
    await expect(connectedWalletPage.accountButton(wallet1Client.address)).toBeVisible();
    const suppliedText = await dashboardPage.suppliedAssetRow('USDC').getByTestId('nativeAmount').innerText();
    expectDisplayed(suppliedText, position.supplied, position.decimals);

    await dashboardPage.openWithdraw('USDC');
    await expect(dashboardPage.modalHeading('Withdraw USDC')).toBeVisible();
    await dashboardPage.chooseMaxAmount();
    await expect.poll(async () => dashboardPage.enteredAmount()).not.toBe('');
    const maxWithdraw = toRaw(await dashboardPage.enteredAmount(), position.decimals);
    expect(maxWithdraw).toBeGreaterThan(0n);
    expect(maxWithdraw).toBeLessThan(position.supplied);
    const [remaining] = await dashboardPage.overviewValues('Remaining supply', 1);
    expect(toRaw(remaining, position.decimals)).toBeGreaterThan(0n);
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

/** Avoids topping up a 100 supply by one raw unit, which the pool rejects. */
async function supplyTarget(client: AaveClient, symbol: 'USDC' | 'USDT'): Promise<string | undefined> {
  const supply = await client.getSupply(symbol);
  const target = toRaw('100', supply.decimals);
  return supply.raw + 5n < target ? '100' : undefined;
}
