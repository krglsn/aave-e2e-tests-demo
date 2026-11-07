import { test, type Locator } from '@playwright/test';
import { BasePage } from './base.page.js';

export class DashboardPage extends BasePage {
  protected readonly path = '/dashboard/';

  readonly netWorth = this.metric('Net worth');
  readonly netWorthValue = this.metricValue(/^Net worth\s*\$\s*[\d.,]+$/);
  readonly netApy = this.metric('Net APY');
  readonly netApyValue = this.metricValue(/^Net APY\s*-?[\d.]+\s*%$/);
  readonly healthFactor = this.metric('Health factor');
  readonly healthFactorValue = this.page.getByTestId('HealthFactorTopPannel').getByRole('paragraph');
  readonly availableRewards = this.metric('Available rewards');
  readonly availableRewardsValue = this.page.getByTestId('Claim_Value');

  readonly suppliedPositions = this.page.getByTestId(/^dashboardSuppliedListItem_/);
  readonly borrowedPositions = this.page.getByTestId(/^dashboardBorrowedListItem_/);
  readonly assetsToSupplyRows = this.page.getByTestId(/^dashboardSupplyListItem_/);
  readonly assetsToBorrowRows = this.page.getByTestId(/^dashboardBorrowListItem_/);

  readonly yourSuppliesPanel = this.panel('Your supplies', this.suppliedPositions);
  readonly yourBorrowsPanel = this.panel('Your borrows', this.borrowedPositions);
  readonly assetsToSupplyPanel = this.panel('Assets to supply', this.assetsToSupplyRows);
  readonly assetsToBorrowPanel = this.panel('Assets to borrow', this.assetsToBorrowRows);

  readonly yourSuppliesHideButton = this.visibilityButton(this.yourSuppliesPanel, 'Hide');
  readonly yourSuppliesShowButton = this.visibilityButton(this.yourSuppliesPanel, 'Show');
  readonly yourBorrowsHideButton = this.visibilityButton(this.yourBorrowsPanel, 'Hide');
  readonly yourBorrowsShowButton = this.visibilityButton(this.yourBorrowsPanel, 'Show');
  readonly assetsToSupplyHideButton = this.visibilityButton(this.assetsToSupplyPanel, 'Hide');
  readonly assetsToSupplyShowButton = this.visibilityButton(this.assetsToSupplyPanel, 'Show');
  readonly assetsToBorrowHideButton = this.visibilityButton(this.assetsToBorrowPanel, 'Hide');
  readonly assetsToBorrowShowButton = this.visibilityButton(this.assetsToBorrowPanel, 'Show');

  readonly viewTransactionsLink = this.page.getByRole('link', { name: 'View transactions' });
  readonly nothingSupplied = this.page.getByText('Nothing supplied yet');
  readonly nothingBorrowed = this.page.getByText('Nothing borrowed yet');
  readonly supplyModal = this.page.getByTestId('Modal');
  readonly supplyAmountInput = this.page.getByLabel('amount input');
  readonly signatureProgress = this.supplyModal.getByRole('progressbar');
  readonly collateralValue = this.yourSuppliesPanel
    .locator('div')
    .filter({ hasText: /^Collateral/ })
    .locator('> p')
    .filter({ hasText: /\$/ });

  async open(): Promise<void> {
    await test.step('Open the dashboard in test mode', async () => {
      await super.open();
    });
  }

  async hideYourSupplies(): Promise<void> {
    await test.step('Hide your supplies', async () => {
      await this.yourSuppliesHideButton.click();
    });
  }

  async showYourSupplies(): Promise<void> {
    await test.step('Show your supplies', async () => {
      await this.yourSuppliesShowButton.click();
    });
  }

  async hideYourBorrows(): Promise<void> {
    await test.step('Hide your borrows', async () => {
      await this.yourBorrowsHideButton.click();
    });
  }

  async showYourBorrows(): Promise<void> {
    await test.step('Show your borrows', async () => {
      await this.yourBorrowsShowButton.click();
    });
  }

  async hideAssetsToSupply(): Promise<void> {
    await test.step('Hide assets to supply', async () => {
      await this.assetsToSupplyHideButton.click();
    });
  }

  async showAssetsToSupply(): Promise<void> {
    await test.step('Show assets to supply', async () => {
      await this.assetsToSupplyShowButton.click();
    });
  }

  async hideAssetsToBorrow(): Promise<void> {
    await test.step('Hide assets to borrow', async () => {
      await this.assetsToBorrowHideButton.click();
    });
  }

  async showAssetsToBorrow(): Promise<void> {
    await test.step('Show assets to borrow', async () => {
      await this.assetsToBorrowShowButton.click();
    });
  }

  async sortBy(panel: Locator, column: string): Promise<void> {
    await test.step(`Sort by ${column}`, async () => {
      await this.sortHeader(panel, column).click();
    });
  }

  private sortHeader(panel: Locator, column: string): Locator {
    return panel
      .locator('div')
      .filter({ has: this.page.locator('> span') })
      .filter({ has: this.page.locator('> div > svg') })
      .filter({ hasText: column })
      .locator('> div > svg');
  }

  async openAction(row: Locator, action: 'Supply' | 'Withdraw' | 'Borrow' | 'Repay'): Promise<void> {
    await test.step(`Open ${action}`, async () => {
      await row.getByRole('button', { name: action, exact: true }).click();
    });
  }

  async toggleCollateral(row: Locator): Promise<void> {
    await test.step('Toggle collateral', async () => {
      await row.getByRole('checkbox').click();
    });
  }

  async openAssetDetails(row: Locator): Promise<void> {
    await test.step('Open asset details', async () => {
      await row.getByRole('link', { name: 'Details', exact: true }).click();
    });
  }

  async openTransactions(): Promise<void> {
    await test.step('Open transaction history', async () => {
      await this.viewTransactionsLink.click();
    });
  }

  supplyAssetRow(symbol: string): Locator {
    return this.page.getByTestId(`dashboardSupplyListItem_${symbol.toUpperCase()}`);
  }

  suppliedAssetRow(symbol: string): Locator {
    return this.page.getByTestId(new RegExp(`^dashboardSuppliedListItem_${symbol.toUpperCase()}(_|$)`));
  }

  supplyAction(symbol: string, action: 'Approve' | 'Supply'): Locator {
    const name = action === 'Approve' ? `Approve ${symbol} to continue` : `Supply ${symbol}`;
    return this.supplyModal.getByRole('button', { name, exact: true });
  }

  async openAssetSupply(symbol: string): Promise<void> {
    await test.step(`Open supply for ${symbol}`, async () => {
      await this.supplyAssetRow(symbol).getByRole('button', { name: 'Supply', exact: true }).click();
    });
  }

  async enterSupplyAmount(amount: string): Promise<void> {
    await test.step(`Enter ${amount}`, async () => {
      await this.supplyAmountInput.fill(amount);
    });
  }

  async submitSupplyAction(symbol: string, action: 'Approve' | 'Supply'): Promise<void> {
    await test.step(`${action} ${symbol}`, async () => {
      await this.supplyAction(symbol, action).click();
    });
  }

  async finishSupply(): Promise<void> {
    await test.step('Confirm the supply is done', async () => {
      await this.supplyModal.getByRole('button', { name: 'Done', exact: true }).click();
    });
  }

  async closeModal(): Promise<void> {
    await test.step('Close the modal', async () => {
      await this.page.keyboard.press('Escape');
    });
  }

  modalHeading(name: string): Locator {
    return this.page.getByRole('heading', { name, exact: true });
  }

  private metric(label: string): Locator {
    return this.page.getByText(label, { exact: true });
  }

  private metricValue(pattern: RegExp): Locator {
    return this.page.locator('div').filter({ hasText: pattern }).getByRole('paragraph');
  }

  private panel(title: string, rows: Locator): Locator {
    const otherTitles = ['Your supplies', 'Your borrows', 'Assets to supply', 'Assets to borrow']
      .filter((candidate) => candidate !== title);

    return otherTitles.reduce(
      (panel, other) => panel.filter({ hasNotText: other }),
      this.page
        .locator('div')
        .filter({ has: this.page.getByText(title, { exact: true }) })
        .filter({ has: rows }),
    );
  }

  private visibilityButton(panel: Locator, name: 'Show' | 'Hide'): Locator {
    return panel.getByRole('button', { name, exact: true });
  }
}
