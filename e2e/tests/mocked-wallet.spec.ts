import { expect, test } from '../fixtures/index.js';

test('connects the mocked wallet', async ({ unauthorisedAavePage, wallet }) => {
  await unauthorisedAavePage.open();
  await unauthorisedAavePage.chooseMetaMask();
  await wallet.connect();

  await expect(unauthorisedAavePage.accountButton(wallet.address)).toBeVisible();
});

test('rejects the mocked wallet connection', async ({ unauthorisedAavePage, wallet }) => {
  await unauthorisedAavePage.open();
  await unauthorisedAavePage.chooseMetaMask();
  await expect(unauthorisedAavePage.connectionRequest).toBeVisible();
  await wallet.reject();

  await expect(unauthorisedAavePage.connectionRequest).toBeHidden();
  await expect(unauthorisedAavePage.connectWalletButton).toBeVisible();
  await expect(unauthorisedAavePage.accountButton(wallet.address)).toHaveCount(0);
});

test('disconnects the mocked wallet', async ({ unauthorisedAavePage, wallet }) => {
  await unauthorisedAavePage.open();
  await unauthorisedAavePage.chooseMetaMask();
  await wallet.connect();
  await expect(unauthorisedAavePage.accountButton(wallet.address)).toBeVisible();

  await wallet.disconnect();

  await expect(unauthorisedAavePage.connectWalletButton).toBeVisible();
  await expect(unauthorisedAavePage.accountButton(wallet.address)).toHaveCount(0);
});
