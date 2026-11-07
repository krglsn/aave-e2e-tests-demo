import { test as base, expect } from '@playwright/test';
import { UnauthorisedAavePage } from '../pages/unauthorised-aave.page.js';

type Fixtures = {
  unauthorisedAavePage: UnauthorisedAavePage;
};

export const test = base.extend<Fixtures>({
  unauthorisedAavePage: async ({ page }, use) => {
    await use(new UnauthorisedAavePage(page));
  },
});

export { expect };
