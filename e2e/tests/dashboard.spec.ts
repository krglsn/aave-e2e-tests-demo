import { compareDisplayedAmount, netWorth } from '../blockchain/index.js';
import { expect, test } from '../fixtures/index.js';

test.describe('dashboard page', { tag: '@dashboard page' }, () => {
  test('net worth', {
    annotation: { type: 'Test Id', description: 'DP-001' },
  }, async ({ wallet1, connectedWalletPage, dashboardPage, blockchain }) => {
    await dashboardPage.open();
    await expect(connectedWalletPage.accountButton(wallet1.address)).toBeVisible();

    const worth = netWorth(await blockchain.aaveUser(wallet1.address));
    const displayed = await dashboardPage.netWorthValue.innerText();
    const comparison = compareDisplayedAmount(displayed, worth.raw, worth.decimals);

    await expect(dashboardPage.netWorth).toBeVisible();
    expect(
      comparison.difference,
      `${comparison.displayedText} vs ${comparison.onChainText}`,
    ).toBeLessThanOrEqual(comparison.tolerance);
  });

  test('health factor', {
    annotation: { type: 'Test Id', description: 'DP-002' },
  }, async ({ wallet1, connectedWalletPage, dashboardPage, blockchain }) => {
    await dashboardPage.open();
    await expect(connectedWalletPage.accountButton(wallet1.address)).toBeVisible();

    const account = await blockchain.aaveUser(wallet1.address);
    const displayed = await dashboardPage.healthFactorValue.innerText();
    const comparison = compareDisplayedAmount(
      displayed,
      account.healthFactor.raw,
      account.healthFactor.decimals,
    );

    await expect(dashboardPage.healthFactor).toBeVisible();
    expect(
      comparison.difference,
      `${comparison.displayedText} vs ${comparison.onChainText}`,
    ).toBeLessThanOrEqual(comparison.tolerance);
  });

  test('net APY', {
    annotation: { type: 'Test Id', description: 'DP-003' },
  }, async ({ wallet1, connectedWalletPage, dashboardPage }) => {
    await dashboardPage.open();
    await expect(connectedWalletPage.accountButton(wallet1.address)).toBeVisible();

    const displayed = await dashboardPage.netApyValue.innerText();
    const comparison = compareDisplayedAmount(displayed, 0n, 0);

    await expect(dashboardPage.netApy).toBeVisible();
    expect(comparison.displayedUnits, displayed).not.toBe(0n);
  });

  test('available rewards', {
    annotation: { type: 'Test Id', description: 'DP-004' },
  }, async ({ wallet1, connectedWalletPage, dashboardPage }) => {
    await dashboardPage.open();

    await expect(connectedWalletPage.accountButton(wallet1.address)).toBeVisible();
    await expect(dashboardPage.availableRewards).toBeVisible();
    await expect(dashboardPage.availableRewardsValue).toHaveText(/\$\s*[\d.,]+/);
  });
});
