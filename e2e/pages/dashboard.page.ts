import { expect, test, type Locator } from '@playwright/test';
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
  readonly actionModal = this.page.getByTestId('Modal');
  readonly supplyModal = this.actionModal;
  readonly amountInput = this.page.getByLabel('amount input');
  readonly supplyAmountInput = this.amountInput;
  readonly approvalButton = this.actionModal.getByTestId('approvalButton');
  readonly actionButton = this.actionModal.getByTestId('actionButton');
  readonly signatureProgress = this.actionModal.getByRole('progressbar');
  readonly recalculationProgress = this.signatureProgress;
  readonly transactionCancelled = this.actionModal.getByText('You cancelled the transaction.');
  readonly transactionConfirmed = this.actionModal.getByTestId('txSuccess');
  readonly liquidationRisk = this.actionModal.getByText(
    'Borrowing this amount will reduce your health factor and increase risk of liquidation.',
  );
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

  borrowAssetRow(symbol: string): Locator {
    return this.page.getByTestId(`dashboardBorrowListItem_${symbol.toUpperCase()}`);
  }

  borrowedAssetRow(symbol: string): Locator {
    return this.page.getByTestId(new RegExp(`^dashboardBorrowedListItem_${symbol.toUpperCase()}(_|$)`));
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
    await this.finishAction();
  }

  async openWithdraw(symbol: string): Promise<void> {
    await test.step(`Open withdraw for ${symbol}`, async () => {
      await this.suppliedAssetRow(symbol).getByRole('button', { name: 'Withdraw', exact: true }).click();
    });
  }

  async openBorrow(symbol: string): Promise<void> {
    await test.step(`Open borrow for ${symbol}`, async () => {
      await this.borrowAssetRow(symbol).getByRole('button', { name: 'Borrow', exact: true }).click();
    });
  }

  async openRepay(symbol: string): Promise<void> {
    await test.step(`Open repay for ${symbol}`, async () => {
      await this.borrowedAssetRow(symbol).getByRole('button', { name: 'Repay', exact: true }).click();
    });
  }

  async fillAmount(amount: string): Promise<void> {
    await test.step(`Enter ${amount}`, async () => {
      await this.amountInput.first().fill(amount);
    });
  }

  async enterWithdrawAmount(amount: string): Promise<void> {
    await test.step(`Enter ${amount}`, async () => {
      await this.amountInput.first().fill(amount);
      await expect(this.recalculationProgress.first()).toBeVisible();
    });
  }

  async enteredAmount(): Promise<string> {
    return this.amountInput.first().inputValue();
  }

  async chooseMaxAmount(): Promise<void> {
    await test.step('Enter the maximum amount', async () => {
      await this.actionModal.getByRole('button', { name: 'Max', exact: true }).click();
    });
  }

  async acknowledgeRisks(): Promise<void> {
    await test.step('Acknowledge the liquidation risk', async () => {
      const acknowledgement = this.actionModal.getByText('I acknowledge the risks involved.', { exact: true });
      await acknowledgement.locator('..').getByRole('checkbox').click();
      await expect(acknowledgement.locator('..').getByRole('checkbox')).toBeChecked();
    });
  }

  async submitApproval(symbol: string): Promise<void> {
    await test.step(`Approve ${symbol} to continue`, async () => {
      await this.approvalButton.click();
    });
  }

  async submitModalAction(name: string): Promise<void> {
    await test.step(name, async () => {
      await this.actionButton.click();
    });
  }

  async expectTransactionConfirmed(): Promise<void> {
    await test.step('Transaction confirmed', async () => {
      await expect(this.transactionConfirmed).toBeVisible({ timeout: 30_000 });
      await expect(this.transactionConfirmed.getByRole('heading', { name: /successfully/i })).toBeVisible();
    });
  }

  async finishAction(): Promise<void> {
    await test.step('Close the confirmation', async () => {
      await this.actionModal.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(this.actionModal).toBeHidden();
    });
  }

  async overviewValues(label: string, count: number): Promise<string[]> {
    return test.step(`Read ${label}`, async () => {
      const lines = (await this.actionModal.innerText()).split('\n').map((line) => line.trim());
      const start = lines.findIndex((line) => line === label);
      if (start < 0) throw new Error(`The modal does not show ${label}.`);
      const values = lines
        .slice(start + 1)
        .filter((line) => /^-?\d[\d,]*(?:\.\d+)?$/.test(line));
      if (values.length < count) {
        throw new Error(`Expected ${count} ${label} amounts, found ${values.length}.`);
      }
      return values.slice(0, count);
    });
  }

  projectedHealthFactor(value: string): Locator {
    return this.actionModal.getByText(value, { exact: true }).last();
  }

  async editAllowance(mode: 'Limited' | 'Unlimited', amount?: string): Promise<void> {
    await test.step(`Set a ${mode.toLowerCase()} allowance`, async () => {
      await this.actionModal.evaluate((root) => {
        const unlimited = Array.from(root.querySelectorAll('*')).find((element) =>
          Array.from(element.childNodes).some(
            (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim() === 'Unlimited',
          ),
        );
        const approval = root.querySelector('[data-cy="approvalButton"]');
        const pencil = Array.from(root.querySelectorAll('svg')).find((svg) => {
          if (!unlimited || !approval) return false;
          const afterLabel = (unlimited.compareDocumentPosition(svg) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
          const beforeApproval = (svg.compareDocumentPosition(approval) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
          return afterLabel && beforeApproval;
        });
        const target = pencil?.closest('button') ?? pencil?.parentElement;
        target?.setAttribute('data-allowance-edit', 'true');
      });
      const edit = this.actionModal.locator('[data-allowance-edit="true"]');
      await expect(edit).toBeVisible();
      await edit.click();
      const option = mode === 'Limited' ? 'Exact amount' : 'Unlimited';
      await this.page.getByText(option, { exact: true }).last().click();
      if (amount) await this.amountInput.last().fill(amount);
      const save = this.page.getByRole('button', { name: /^(Save|Set|Confirm)$/ });
      if (await save.count()) await save.first().click();
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
