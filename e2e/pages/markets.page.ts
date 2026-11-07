import { test, type Locator } from '@playwright/test';
import { BasePage } from './base.page.js';

export class MarketsPage extends BasePage {
  protected readonly path = '/markets/';

  readonly totalDeposits = this.metric('Aave total deposits');
  readonly totalDepositsValue = this.metricValue('Aave total deposits');
  readonly totalLoans = this.metric('Aave total loans');
  readonly totalLoansValue = this.metricValue('Aave total loans');
  readonly totalMarketSize = this.metric('Total market size');
  readonly totalMarketSizeValue = this.metricValue('Total market size');
  readonly totalAvailable = this.metric('Total available');
  readonly totalAvailableValue = this.metricValue('Total available');
  readonly totalBorrows = this.metric('Total borrows');
  readonly totalBorrowsValue = this.metricValue('Total borrows');

  readonly assetSearch = this.page.getByPlaceholder('Search asset name, symbol, or address');
  readonly inWalletToggle = this.page.getByRole('button', { name: 'In Wallet' });
  readonly assetsTable = this.page.locator('div').filter({
    has: this.page.getByText('Total supplied', { exact: true }),
    hasNotText: 'Aave total deposits',
  }).first();
  readonly assetColumn = this.page.getByText('Asset', { exact: true });
  readonly totalSuppliedColumn = this.page.getByText('Total supplied', { exact: true });
  readonly supplyApyColumn = this.page.getByText('Supply APY', { exact: true });
  readonly totalBorrowedColumn = this.page.getByText('Total borrowed', { exact: true });
  readonly borrowApyColumn = this.page.getByText('Borrow APY, variable', { exact: true });

  async open(): Promise<void> {
    await test.step('Open the markets page in test mode', async () => {
      await super.open();
    });
  }

  async searchAssets(query: string): Promise<void> {
    await test.step('Search assets', async () => {
      await this.assetSearch.fill(query);
    });
  }

  async toggleInWallet(): Promise<void> {
    await test.step('Toggle the in-wallet filter', async () => {
      await this.inWalletToggle.click();
    });
  }

  asset(symbol: string): Locator {
    return this.assetsTable.getByText(symbol, { exact: true });
  }

  private metric(label: string): Locator {
    return this.page.getByText(label, { exact: true });
  }

  private metricValue(label: string): Locator {
    return this.page
      .locator('div')
      .filter({ hasText: new RegExp(`^${label}\\s*\\$\\s*[\\d.,]+[KMBT]?$`) })
      .getByRole('paragraph')
      .filter({ hasText: '$' });
  }
}
