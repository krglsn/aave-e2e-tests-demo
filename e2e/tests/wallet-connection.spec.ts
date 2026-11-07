import { expect, test } from '../fixtures/index.js';
import { otherWalletChainId, testWallet2 } from '../fixtures/wallet.fixture.js';

test.describe('wallet connection', { tag: '@wallet connection' }, () => {
  test('connect and confirm', {
    annotation: { type: 'Test Id', description: 'WC-001' },
  }, async ({ unauthorisedAavePage, wallet }) => {
    await unauthorisedAavePage.open();
    await unauthorisedAavePage.openWalletSelection();

    await expect(unauthorisedAavePage.walletSelectionDialog).toBeVisible();

    await unauthorisedAavePage.chooseMetaMask();

    await expect(unauthorisedAavePage.requestingConnectionDialog).toBeVisible();

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

  test('change network in the wallet', {
    annotation: { type: 'Test Id', description: 'WC-006' },
  }, async ({ unauthorisedAavePage, wallet }) => {
    await unauthorisedAavePage.open();
    await unauthorisedAavePage.openWalletSelection();
    await unauthorisedAavePage.chooseMetaMask();
    await wallet.connect();
    await unauthorisedAavePage.openConnectedWallet(wallet.address);

    await expect(unauthorisedAavePage.connectedAccountHeading(wallet.address)).toBeVisible();
    await expect(unauthorisedAavePage.connectedWalletDialog).toContainText('AVAX');

    await wallet.switchChain(otherWalletChainId);

    await expect(unauthorisedAavePage.accountButton(wallet.address)).toBeVisible();
    await expect(unauthorisedAavePage.connectWalletButton).toBeHidden();
    await expect(unauthorisedAavePage.connectedAccountHeading(wallet.address)).toBeVisible();
    await expect(unauthorisedAavePage.connectedWalletDialog).toContainText('AVAX');
    await expect(unauthorisedAavePage.walletRejectionMessage).toHaveCount(0);
  });

  test('change account on connected wallet', {
    annotation: { type: 'Test Id', description: 'WC-007' },
  }, async ({ unauthorisedAavePage, wallet }) => {
    await unauthorisedAavePage.open();
    await unauthorisedAavePage.openWalletSelection();
    await unauthorisedAavePage.chooseMetaMask();
    await wallet.connect();
    await wallet.switchAccount(testWallet2);

    await expect(unauthorisedAavePage.accountButton(testWallet2)).toBeVisible();

    await unauthorisedAavePage.openConnectedWallet(testWallet2);

    await expect(unauthorisedAavePage.connectedAccountHeading(testWallet2)).toBeVisible();
  });

  test('disconnect from app', {
    annotation: { type: 'Test Id', description: 'WC-009' },
  }, async ({ unauthorisedAavePage, wallet }) => {
    await unauthorisedAavePage.open();
    await unauthorisedAavePage.openWalletSelection();
    await unauthorisedAavePage.chooseMetaMask();
    await wallet.connect();
    await unauthorisedAavePage.openConnectedWallet(wallet.address);
    await unauthorisedAavePage.disconnectConnectedWallet();

    await expect(unauthorisedAavePage.connectWalletButton).toBeVisible();
    await expect(unauthorisedAavePage.connectedWalletDialog).toBeHidden();
    await expect(unauthorisedAavePage.accountButton(wallet.address)).toHaveCount(0);
  });

  test('disconnect from wallet', {
    annotation: { type: 'Test Id', description: 'WC-010' },
  }, async ({ unauthorisedAavePage, wallet }) => {
    await unauthorisedAavePage.open();
    await unauthorisedAavePage.openWalletSelection();
    await unauthorisedAavePage.chooseMetaMask();
    await wallet.connect();
    await wallet.disconnect();

    await expect(unauthorisedAavePage.connectWalletButton).toBeVisible();
    await expect(unauthorisedAavePage.accountButton(wallet.address)).toHaveCount(0);
  });

  test('page reload', {
    annotation: { type: 'Test Id', description: 'WC-011' },
  }, async ({ unauthorisedAavePage, wallet }) => {
    await unauthorisedAavePage.open();
    await unauthorisedAavePage.openWalletSelection();
    await unauthorisedAavePage.chooseMetaMask();
    await wallet.connect();
    await expect(unauthorisedAavePage.accountButton(wallet.address)).toBeVisible();

    await unauthorisedAavePage.reload();

    await expect(unauthorisedAavePage.accountButton(wallet.address)).toBeVisible();
    await expect(unauthorisedAavePage.connectWalletButton).toBeHidden();

    // Reconnecting can send the click to the dashboard before the wallet modal opens.
    await expect(async () => {
      await unauthorisedAavePage.openConnectedWallet(wallet.address);
      await expect(unauthorisedAavePage.connectedAccountHeading(wallet.address)).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
  });
});
