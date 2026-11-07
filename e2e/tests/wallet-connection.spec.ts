import { expect, test } from '../fixtures/index.js';

test.describe('wallet connection', { tag: '@wallet connection' }, () => {
  test('connect and confirm', {
    annotation: { type: 'Test Id', description: 'WC-001' },
  }, async ({ unauthorisedAavePage, wallet }) => {
    await unauthorisedAavePage.open();
    await unauthorisedAavePage.openWalletSelection();

    await expect(unauthorisedAavePage.walletSelectionDialog).toBeVisible();

    await unauthorisedAavePage.chooseMetaMask();
    await wallet.connect();

    await expect(unauthorisedAavePage.accountButton(wallet.address)).toBeVisible();
    await expect(unauthorisedAavePage.connectWalletButton).toBeHidden();
  });

  test('connect and reject', {
    annotation: { type: 'Test Id', description: 'WC-002' },
  }, async ({ unauthorisedAavePage, wallet }) => {
    await unauthorisedAavePage.open();
    await unauthorisedAavePage.openWalletSelection();

    await expect(unauthorisedAavePage.walletSelectionDialog).toBeVisible();

    await unauthorisedAavePage.chooseMetaMask();
    await wallet.reject();

    await expect(unauthorisedAavePage.walletRejectionMessage).toBeVisible();
  });

  test('connect and close modal', {
    annotation: { type: 'Test Id', description: 'WC-003' },
  }, async ({ unauthorisedAavePage, wallet }) => {
    await unauthorisedAavePage.open();
    await unauthorisedAavePage.openWalletSelection();
    await unauthorisedAavePage.closeWalletSelection();

    await expect(unauthorisedAavePage.walletSelectionDialog).toBeHidden();
    await expect(unauthorisedAavePage.connectWalletButton).toBeVisible();
    await expect(unauthorisedAavePage.walletRejectionMessage).toHaveCount(0);
    await expect(unauthorisedAavePage.accountButton(wallet.address)).toHaveCount(0);
  });

  test('connect, reject and connect again', {
    annotation: { type: 'Test Id', description: 'WC-004' },
  }, async ({ unauthorisedAavePage, wallet }) => {
    await unauthorisedAavePage.open();
    await unauthorisedAavePage.openWalletSelection();
    await unauthorisedAavePage.chooseMetaMask();
    await wallet.reject();

    await expect(unauthorisedAavePage.walletRejectionMessage).toBeVisible();

    await unauthorisedAavePage.retryWalletConnection();
    await wallet.connect();

    await expect(unauthorisedAavePage.accountButton(wallet.address)).toBeVisible();
  });
});
