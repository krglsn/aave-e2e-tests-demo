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

  get url(): string {
    return getPageUrl();
  }

  async open(): Promise<void> {
    // Aave reads Test Mode from this localStorage flag during startup.
    await this.page.addInitScript((key) => {
      localStorage.setItem(key, 'true');
    }, testnetsEnabledKey);
    await super.open();
  }

  async openSettings(): Promise<void> {
    await this.settingsButton.click();
  }
}
