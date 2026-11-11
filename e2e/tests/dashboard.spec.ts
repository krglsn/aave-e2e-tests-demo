import { compareDisplayedAmount, netWorth } from '../blockchain/index.js';
import { expect, test } from '../fixtures/index.js';
import { testWallet2 } from '../fixtures/wallet.fixture.js';
import type { Locator } from '@playwright/test';
import type { DashboardPage } from '../pages/dashboard.page.js';

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
    await expect(dashboardPage.availableRewardsValue).toHaveText(/\$\s*[\d.,]+/, { timeout: 20_000 });
  });

  test('collapsable tables', {
    annotation: { type: 'Test Id', description: 'DP-005' },
  }, async ({ wallet1, connectedWalletPage, dashboardPage }) => {
    await dashboardPage.open();
    await expect(connectedWalletPage.accountButton(wallet1.address)).toBeVisible();

    await dashboardPage.hideYourSupplies();
    await expectEachHidden(dashboardPage.suppliedPositions);
    await expect(dashboardPage.yourSuppliesPanel.getByText('Balance', { exact: true }).first()).toBeVisible();
    await dashboardPage.showYourSupplies();
    await expect(dashboardPage.suppliedPositions.first()).toBeVisible();

    await dashboardPage.hideYourBorrows();
    await expectEachHidden(dashboardPage.borrowedPositions);
    await expect(dashboardPage.yourBorrowsPanel.getByText('Balance', { exact: true }).first()).toBeVisible();
    await dashboardPage.showYourBorrows();
    await expect(dashboardPage.borrowedPositions.first()).toBeVisible();

    await dashboardPage.hideAssetsToSupply();
    await expectEachHidden(dashboardPage.assetsToSupplyRows);
    await expect(dashboardPage.assetsToSupplyShowButton).toBeVisible();
    await dashboardPage.showAssetsToSupply();
    await expect(dashboardPage.assetsToSupplyRows.first()).toBeVisible();

    await dashboardPage.hideAssetsToBorrow();
    await expectEachHidden(dashboardPage.assetsToBorrowRows);
    await expect(dashboardPage.assetsToBorrowShowButton).toBeVisible();
    await dashboardPage.showAssetsToBorrow();
    await expect(dashboardPage.assetsToBorrowRows.first()).toBeVisible();
  });

  test('sorting', {
    annotation: { type: 'Test Id', description: 'DP-006' },
  }, async ({ wallet1, connectedWalletPage, dashboardPage }) => {
    await dashboardPage.open();
    await expect(connectedWalletPage.accountButton(wallet1.address)).toBeVisible();

    await expectSorted(dashboardPage.assetsToSupplyPanel, dashboardPage.assetsToSupplyRows, [
      ['Assets', 'asset'],
      ['Balance', 'amount'],
      ['APY', 'apy'],
    ], dashboardPage);
    await expectSorted(dashboardPage.assetsToBorrowPanel, dashboardPage.assetsToBorrowRows, [
      ['Asset', 'asset'],
      ['Available', 'amount'],
      ['APY, variable', 'apy'],
    ], dashboardPage);
  });

  test('supply buttons', {
    annotation: { type: 'Test Id', description: 'DP-007' },
  }, async ({ wallet1, connectedWalletPage, dashboardPage }) => {
    await dashboardPage.open();
    await expect(connectedWalletPage.accountButton(wallet1.address)).toBeVisible();

    await expect(dashboardPage.suppliedPositions.first()).toBeVisible({ timeout: 20_000 });
    const count = await dashboardPage.suppliedPositions.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      const row = dashboardPage.suppliedPositions.nth(index);
      const symbol = (await row.getByTestId('assetName').innerText()).trim();
      await expect(row.getByRole('checkbox')).toBeVisible();
      await expect(row.getByRole('button', { name: 'Supply', exact: true })).toBeEnabled();
      await expect(row.getByRole('button', { name: 'Withdraw', exact: true })).toBeEnabled();

      await dashboardPage.openAction(row, 'Supply');
      await expect(dashboardPage.modalHeading(`Supply ${symbol}`)).toBeVisible();
      await dashboardPage.closeModal();

      await dashboardPage.openAction(row, 'Withdraw');
      await expect(dashboardPage.modalHeading(`Withdraw ${symbol}`)).toBeVisible();
      await dashboardPage.closeModal();

      await dashboardPage.toggleCollateral(row);
      await expect(dashboardPage.modalHeading(`Review tx ${symbol}`)).toBeVisible();
      await dashboardPage.closeModal();
    }
  });

  test('borrow buttons', {
    annotation: { type: 'Test Id', description: 'DP-008' },
  }, async ({ wallet1, connectedWalletPage, dashboardPage }) => {
    await dashboardPage.open();
    await expect(connectedWalletPage.accountButton(wallet1.address)).toBeVisible();

    await expect(dashboardPage.borrowedPositions.first()).toBeVisible({ timeout: 20_000 });
    const count = await dashboardPage.borrowedPositions.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      const row = dashboardPage.borrowedPositions.nth(index);
      const symbol = (await row.getByTestId('assetName').innerText()).trim();
      await expect(row.getByRole('button', { name: 'Borrow', exact: true })).toBeEnabled();
      await expect(row.getByRole('button', { name: 'Repay', exact: true })).toBeEnabled();

      await dashboardPage.openAction(row, 'Borrow');
      await expect(dashboardPage.modalHeading(`Borrow ${symbol}`)).toBeVisible();
      await dashboardPage.closeModal();

      await dashboardPage.openAction(row, 'Repay');
      await expect(dashboardPage.modalHeading(`Repay ${symbol}`)).toBeVisible();
      await dashboardPage.closeModal();
    }
  });

  test('asset supply button', {
    annotation: { type: 'Test Id', description: 'DP-009' },
  }, async ({ wallet1, connectedWalletPage, dashboardPage }) => {
    await dashboardPage.open();
    await expect(connectedWalletPage.accountButton(wallet1.address)).toBeVisible();
    await expectEveryAction(dashboardPage.assetsToSupplyRows, 'Supply', dashboardPage);
  });

  test('asset borrow button', {
    annotation: { type: 'Test Id', description: 'DP-010' },
  }, async ({ wallet1, connectedWalletPage, dashboardPage }) => {
    await dashboardPage.open();
    await expect(connectedWalletPage.accountButton(wallet1.address)).toBeVisible();
    await expectEveryAction(dashboardPage.assetsToBorrowRows, 'Borrow', dashboardPage);
  });

  test('asset details button', {
    annotation: { type: 'Test Id', description: 'DP-011' },
  }, async ({ page, wallet1, connectedWalletPage, dashboardPage }) => {
    await dashboardPage.open();
    await expect(connectedWalletPage.accountButton(wallet1.address)).toBeVisible();
    await expect(dashboardPage.assetsToBorrowRows.first()).toBeVisible({ timeout: 20_000 });

    const details = dashboardPage.assetsToBorrowRows.getByRole('link', { name: 'Details', exact: true });
    const count = await details.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      await expect(details.nth(index)).toHaveAttribute('href', /\/reserve-overview\//);
    }

    await dashboardPage.openAssetDetails(dashboardPage.assetsToBorrowRows.first());
    await expect(page).toHaveURL(/\/reserve-overview\//);
  });

  test('view transactions button', {
    annotation: { type: 'Test Id', description: 'DP-012' },
  }, async ({ page, wallet1, connectedWalletPage, dashboardPage }) => {
    await dashboardPage.open();
    await expect(connectedWalletPage.accountButton(wallet1.address)).toBeVisible();

    await dashboardPage.openTransactions();
    await expect(page).toHaveURL(/\/history\//);
  });
});

test.describe('dashboard page', { tag: '@dashboard page' }, () => {
  test.use({ walletAddress: testWallet2 });

  test('check user data displayed', {
    annotation: { type: 'Test Id', description: 'DP-013' },
  }, async ({ connectedWalletPage, dashboardPage, blockchain }) => {
    await dashboardPage.open();
    await expect(connectedWalletPage.accountButton(testWallet2)).toBeVisible();

    const account = await blockchain.aaveUser(testWallet2);
    expect(account.totalCollateral.raw).toBe(0n);
    expect(account.totalDebt.raw).toBe(0n);

    const worth = compareDisplayedAmount(
      await dashboardPage.netWorthValue.innerText(),
      netWorth(account).raw,
      netWorth(account).decimals,
    );
    expect(worth.difference, `${worth.displayedText} vs ${worth.onChainText}`).toBeLessThanOrEqual(worth.tolerance);
    await expect(dashboardPage.netApy.locator('..').locator('..').getByRole('paragraph')).toHaveText('—');
    await expect(dashboardPage.healthFactor).toBeHidden();
    await expect(dashboardPage.nothingSupplied).toBeVisible();
    await expect(dashboardPage.nothingBorrowed).toBeVisible();
    await expect(dashboardPage.suppliedPositions).toHaveCount(0);
    await expect(dashboardPage.borrowedPositions).toHaveCount(0);
  });
});

async function expectEachHidden(rows: Locator): Promise<void> {
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    await expect(rows.nth(index)).toBeHidden();
  }
}

async function expectEveryAction(
  rows: Locator,
  action: 'Supply' | 'Borrow',
  dashboardPage: DashboardPage,
): Promise<void> {
  await expect(rows.first()).toBeVisible({ timeout: 20_000 });
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    const symbol = (await row.getByTestId('assetName').innerText()).trim();
    await expect(row.getByRole('button', { name: action, exact: true })).toBeEnabled();
    await dashboardPage.openAction(row, action);
    await expect(dashboardPage.modalHeading(`${action} ${symbol}`)).toBeVisible();
    await dashboardPage.closeModal();
  }
}

async function expectSorted(
  panel: Locator,
  rows: Locator,
  columns: Array<[string, 'asset' | 'amount' | 'apy']>,
  dashboardPage: DashboardPage,
): Promise<void> {
  for (const [column, kind] of columns) {
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });
    const before = (await columnValues(rows, kind)).join('|');
    await dashboardPage.sortBy(panel, column);
    try {
      await expect.poll(async () => (await columnValues(rows, kind)).join('|'), { timeout: 1_500 }).not.toBe(before);
    } catch {
      await dashboardPage.sortBy(panel, column);
      await expect.poll(async () => (await columnValues(rows, kind)).join('|')).not.toBe(before);
    }
    const values = await columnValues(rows, kind);
    expect(isSorted(values, kind), `${column}: ${values.join(', ')}`).toBe(true);
  }
}

async function columnValues(rows: Locator, kind: 'asset' | 'amount' | 'apy'): Promise<string[]> {
  const testId = kind === 'asset' ? 'assetName' : kind === 'amount' ? 'nativeAmount' : 'apy';
  const count = await rows.count();
  const values: string[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push((await rows.nth(index).getByTestId(testId).innerText()).trim());
  }
  return values;
}

function isSorted(values: string[], kind: 'asset' | 'amount' | 'apy'): boolean {
  if (kind === 'asset') {
    const ascending = values.every((value, index) => index === 0 || values[index - 1].localeCompare(value) <= 0);
    const descending = values.every((value, index) => index === 0 || values[index - 1].localeCompare(value) >= 0);
    return ascending || descending;
  }
  const numbers = values.map((value) => Number(value.replace(/[^0-9.-]/g, '')));
  const ascending = numbers.every((value, index) => index === 0 || numbers[index - 1] <= value);
  const descending = numbers.every((value, index) => index === 0 || numbers[index - 1] >= value);
  return ascending || descending;
}
