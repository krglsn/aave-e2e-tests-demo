import { setTimeout } from 'node:timers/promises';
import { expect, type Page, type Response } from '@playwright/test';
import { connectChain, type ChainClient } from '../blockchain/index.js';
import { type NetworkName } from '../config/networks.js';
import { getPageUrl } from '../config/page-url.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { MarketsPage } from '../pages/markets.page.js';
import { UnauthorisedAavePage } from '../pages/unauthorised-aave.page.js';
import { requireWallet1, type Wallet1 } from './wallet1.fixture.js';
import { test as base } from './wallet.fixture.js';

const rateLimitStatus = 429;

type Fixtures = {
  unauthorisedAavePage: UnauthorisedAavePage;
  connectedWalletPage: UnauthorisedAavePage;
  dashboardPage: DashboardPage;
  marketsPage: MarketsPage;
  wallet1: Wallet1;
};

type BlockchainFixtures = {
  network: NetworkName;
  blockchain: ChainClient;
};

export const test = base.extend<Fixtures, BlockchainFixtures>({
  network: ['baseSepolia', { option: true, scope: 'worker' }],
  blockchain: [
    async ({ network }, use) => {
      await use(await connectChain(network));
    },
    { scope: 'worker' },
  ],
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      // Aave hides the analytics banner once this choice has been recorded.
      localStorage.setItem('userAcceptedAnalytics_v1', 'false');
      localStorage.setItem('analyticsConsentCounted_v1', 'true');
      // Aave reads Test Mode from this flag during startup.
      localStorage.setItem('testnetsEnabled', 'true');
    });
    const goto = page.goto.bind(page);
    page.goto = (url, options) => openApp(page, goto, url, options);
    await use(page);
  },
  unauthorisedAavePage: async ({ page }, use) => {
    await use(new UnauthorisedAavePage(page));
  },
  connectedWalletPage: async ({ unauthorisedAavePage, wallet }, use) => {
    await unauthorisedAavePage.open();
    await unauthorisedAavePage.openWalletSelection();
    await unauthorisedAavePage.chooseMetaMask();
    await wallet.connect();
    await use(unauthorisedAavePage);
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  marketsPage: async ({ page }, use) => {
    await use(new MarketsPage(page));
  },
  wallet1: async ({ blockchain, wallet }, use) => {
    await use(await requireWallet1(blockchain, wallet.address));
  },
});

async function openApp(
  page: Page,
  goto: Page['goto'],
  url: string,
  options?: Parameters<Page['goto']>[1],
): Promise<Response | null> {
  let response = await goto(url, options);
  const backoffMs = [2_000 + Math.random() * 4_000, 5_000 + Math.random() * 5_000];

  for (const delayMs of backoffMs) {
    if (!isAppRateLimited(url, response) && !(await isBlankApp(page, url))) return response;
    await setTimeout(delayMs);
    response = await goto(url, options);
  }

  if (isAppRateLimited(url, response) && !response?.ok()) {
    throw new Error(
      `Application rate limited. Response: ${response?.status() ?? 'no response'}`,
    );
  }
  return response;
}

async function isBlankApp(page: Page, url: string): Promise<boolean> {
  const appOrigin = new URL(getPageUrl()).origin;
  if (new URL(url, getPageUrl()).origin !== appOrigin) return false;

  const shell = page.getByRole('button').or(page.getByRole('heading')).first();
  try {
    await shell.waitFor({ state: 'visible', timeout: 10_000 });
    return false;
  } catch {
    const text = await page.locator('body').innerText().catch(() => '');
    return text.trim().length === 0;
  }
}

function isAppRateLimited(url: string, response: Response | null): boolean {
  if (response?.status() !== rateLimitStatus) return false;

  const appOrigin = new URL(getPageUrl()).origin;
  return new URL(url, getPageUrl()).origin === appOrigin;
}

export { expect };
