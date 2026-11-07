import { test, type Locator } from '@playwright/test';
import { BasePage } from './base.page.js';

export class DashboardPage extends BasePage {
  protected readonly path = '/dashboard/';

  readonly netWorth = this.metric('Net worth');
  readonly netWorthValue = this.metricValue(/^Net worth\s*\$\s*[\d.,]+$/);
  readonly netApy = this.metric('Net APY');
  readonly netApyValue = this.metricValue(/^Net APY\s*-?[\d.]+\s*%$/);
  readonly availableRewards = this.metric('Available rewards');
  readonly availableRewardsValue = this.page.getByTestId('Claim_Value');

  readonly yourSuppliesPanel = this.panel('Your supplies', 'dashboardSuppliedListItem_');
  readonly yourBorrowsPanel = this.panel('Your borrows', 'dashboardBorrowedListItem_');
  readonly assetsToSupplyPanel = this.panel('Assets to supply', 'dashboardSupplyListItem_');
  readonly assetsToBorrowPanel = this.panel('Assets to borrow', 'dashboardBorrowListItem_');

  readonly yourSuppliesHideButton = this.visibilityButton(this.yourSuppliesPanel, 'Hide');
  readonly yourSuppliesShowButton = this.visibilityButton(this.yourSuppliesPanel, 'Show');
  readonly yourBorrowsHideButton = this.visibilityButton(this.yourBorrowsPanel, 'Hide');
  readonly yourBorrowsShowButton = this.visibilityButton(this.yourBorrowsPanel, 'Show');
  readonly assetsToSupplyHideButton = this.visibilityButton(this.assetsToSupplyPanel, 'Hide');
  readonly assetsToSupplyShowButton = this.visibilityButton(this.assetsToSupplyPanel, 'Show');
  readonly assetsToBorrowHideButton = this.visibilityButton(this.assetsToBorrowPanel, 'Hide');
  readonly assetsToBorrowShowButton = this.visibilityButton(this.assetsToBorrowPanel, 'Show');

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

  private metric(label: string): Locator {
    return this.page.getByText(label, { exact: true });
  }

  private metricValue(pattern: RegExp): Locator {
    return this.page.locator('div').filter({ hasText: pattern }).getByRole('paragraph');
  }

  private panel(title: string, rowPrefix: string): Locator {
    const otherTitles = ['Your supplies', 'Your borrows', 'Assets to supply', 'Assets to borrow']
      .filter((candidate) => candidate !== title);

    return otherTitles.reduce(
      (panel, other) => panel.filter({ hasNotText: other }),
      this.page
        .locator('div')
        .filter({ has: this.page.getByText(title, { exact: true }) })
        .filter({ has: this.page.locator(`[data-cy^="${rowPrefix}"]`) }),
    );
  }

  private visibilityButton(panel: Locator, name: 'Show' | 'Hide'): Locator {
    return panel.getByRole('button', { name, exact: true });
  }
}
