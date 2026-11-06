import { expect, test } from '../fixtures/index.js';

test('shows the unauthorised app in test mode', async ({ page, unauthorisedAavePage }) => {
  await expect(page).toHaveURL(unauthorisedAavePage.url);
  await expect(unauthorisedAavePage.connectWalletButton).toBeVisible();
  await expect(unauthorisedAavePage.testModeButton).toBeVisible();

  await unauthorisedAavePage.openSettings();
  await expect(unauthorisedAavePage.settingsMenu).toBeVisible();
  await expect(unauthorisedAavePage.testModeSwitch).toBeChecked();
});
