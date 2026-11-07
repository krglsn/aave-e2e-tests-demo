import { setTimeout } from 'node:timers/promises';
import { expect, type Page, type Response } from '@playwright/test';
import { connectChain, type ChainClient } from '../blockchain/index.js';
import { type NetworkName } from '../config/networks.js';
import { getPageUrl } from '../config/page-url.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { MarketsPage } from '../pages/markets.page.js';
import { UnauthorisedAavePage } from '../pages/unauthorised-aave.page.js';
import { test as base } from './wallet.fixture.js';

const rateLimitStatus = 429;

type Fixtures = {
  unauthorisedAavePage: UnauthorisedAavePage;
  dashboardPage: DashboardPage;
  marketsPage: MarketsPage;
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
    page.goto = (url, options) => openApp(goto, url, options);
    await use(page);
  },
  unauthorisedAavePage: async ({ page }, use) => {
    await use(new UnauthorisedAavePage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  marketsPage: async ({ page }, use) => {
    await use(new MarketsPage(page));
  },
});

async function openApp(
  goto: Page['goto'],
  url: string,
  options?: Parameters<Page['goto']>[1],
): Promise<Response | null> {
  let response = await goto(url, options);
  const backoffMs = [2_000 + Math.random() * 4_000, 5_000 + Math.random() * 5_000];

  for (const delayMs of backoffMs) {
    if (!isAppRateLimited(url, response)) return response;
    await setTimeout(delayMs);
    response = await goto(url, options);
  }

  if (!response?.ok()) {
    throw new Error(
      `Application rate limited. Response: ${response?.status() ?? 'no response'}`,
    );
  }
  return response;
}

function isAppRateLimited(url: string, response: Response | null): boolean {
  if (response?.status() !== rateLimitStatus) return false;

  const appOrigin = new URL(getPageUrl()).origin;
  return new URL(url, getPageUrl()).origin === appOrigin;
}

export { expect };
