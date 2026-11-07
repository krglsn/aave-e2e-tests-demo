import { test, type Locator } from '@playwright/test';
import { getPageUrl } from '../config/page-url.js';
import { BasePage } from './base.page.js';

const testnetsEnabledKey = 'testnetsEnabled';

export class UnauthorisedAavePage extends BasePage {
  protected readonly path = new URL(getPageUrl()).pathname;

  readonly testModeButton = this.page.getByRole('button', { name: 'Test Mode' });
  readonly connectWalletButton = this.page.getByRole('button', { name: 'Connect Wallet' });
  readonly settingsButton = this.page.getByRole('button', { name: 'settings' });
  readonly settingsMenu = this.page.getByRole('menu', { name: 'settings' });
  readonly testModeSwitch = this.settingsMenu.getByRole('menuitem', { name: 'Test Mode' }).getByRole('checkbox');
  readonly metaMaskButton = this.page.getByRole('button', { name: 'MetaMask' });
  readonly walletSelectionDialog = this.page.getByRole('dialog').filter({ hasText: 'select a wallet' });
  readonly closeWalletSelectionButton = this.page.getByRole('button', { name: 'Close' });
  readonly retryWalletConnectionButton = this.page.getByRole('button', { name: 'Retry' });
  readonly walletRejectionMessage = this.page.getByText('You cancelled the request.');

  get url(): string {
    return getPageUrl();
  }

  async open(): Promise<void> {
    await test.step('Open the unauthorised Aave app in test mode', async () => {
      // Aave reads Test Mode from this localStorage flag during startup.
      await this.page.addInitScript((key) => {
        localStorage.setItem(key, 'true');
      }, testnetsEnabledKey);
      await super.open();
    });
  }

  async openSettings(): Promise<void> {
    await test.step('Open settings', async () => {
      await this.settingsButton.click();
    });
  }

  async openWalletSelection(): Promise<void> {
    await test.step('Open wallet selection', async () => {
      await this.connectWalletButton.click();
    });
  }

  async chooseMetaMask(): Promise<void> {
    await test.step('Choose MetaMask', async () => {
      await this.metaMaskButton.click();
    });
  }

  async retryWalletConnection(): Promise<void> {
    await test.step('Retry the wallet connection', async () => {
      await this.retryWalletConnectionButton.click();
    });
  }

  async closeWalletSelection(): Promise<void> {
    await test.step('Close wallet selection', async () => {
      await this.closeWalletSelectionButton.click();
    });
  }

  accountButton(address: string): Locator {
    const shortened = `${address.slice(0, 4)}...${address.slice(-4)}`;
    return this.page.getByRole('button', { name: shortened });
  }
}
