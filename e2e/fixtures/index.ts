import { test as base, expect } from '@playwright/test';

// Authorization and wallet mocking will be registered as fixtures on this test object.
export const test = base.extend({});

export { expect };
