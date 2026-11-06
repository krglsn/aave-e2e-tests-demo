import { test as base, expect } from '@playwright/test';
import { UnauthorisedAavePage } from '../pages/unauthorised-aave.page.js';

type Fixtures = {
  unauthorisedAavePage: UnauthorisedAavePage;
};

export const test = base.extend<Fixtures>({
  unauthorisedAavePage: async ({ page }, use) => {
    const unauthorisedAavePage = new UnauthorisedAavePage(page);
    await unauthorisedAavePage.open();
    await use(unauthorisedAavePage);
  },
});

export { expect };
