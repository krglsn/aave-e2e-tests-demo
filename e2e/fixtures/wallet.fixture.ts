import { test as base, type Page } from '@playwright/test';
import { getNetwork } from '../config/networks.js';

export const testWallet1 = '0x7b697Bf94E3fa3559Ee3fbc0389D942b7230Da54';
export const testWallet2 = '0xf9b4B50794393C4870956B73531AFC83CBc7436b';
const defaultChainId = getNetwork('baseSepolia').chain.id;
export const otherWalletChainId = 10;

type WalletAction = 'connect' | 'disconnect' | 'reject';

type WalletOptions = {
  walletAddress: string;
  walletChainId: number;
};

export type MockWallet = {
  readonly address: string;
  readonly chainId: number;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  reject(): Promise<void>;
  switchAccount(address: string): Promise<void>;
  switchChain(chainId: number): Promise<void>;
};

type WalletFixtures = {
  wallet: MockWallet;
};

declare global {
  interface Window {
    ethereum?: unknown;
    __mockWallet?: {
      connect(): void;
      disconnect(): void;
      reject(): void;
      switchAccount(address: string): void;
      switchChain(chainId: string): void;
    };
  }
}

class Eip1193Wallet implements MockWallet {
  constructor(
    private readonly page: Page,
    readonly address: string,
    readonly chainId: number,
  ) {}

  async install(): Promise<void> {
    await this.page.addInitScript(
      ({ address, chainId }) => {
        const listeners: Record<string, Array<(payload?: unknown) => void>> = {};
        const emit = (event: string, payload?: unknown) => {
          for (const listener of listeners[event] ?? []) listener(payload);
        };
        const rpcError = (code: number, message: string) => {
          const error = new Error(message) as Error & { code: number };
          error.code = code;
          return error;
        };

        const storageKey = 'mockWalletAccount';
        const chainKey = 'mockWalletChainId';
        const storedAccount = localStorage.getItem(storageKey);
        const storedChainId = localStorage.getItem(chainKey);
        let accounts: string[] = storedAccount ? [storedAccount] : [];
        let currentChainId = storedChainId ?? chainId;
        let rejectNext = false;
        const pending: Array<{
          method: string;
          resolve: (value: unknown) => void;
          reject: (reason?: unknown) => void;
        }> = [];

        const permissions = () =>
          accounts.length ? [{ parentCapability: 'eth_accounts', invoker: location.origin }] : [];

        const provider = {
          // Aave reaches the injected provider through its MetaMask option.
          isMetaMask: true,
          request: async ({ method, params }: { method: string; params?: [{ chainId?: string }] }) => {
            if (method === 'eth_chainId') return currentChainId;
            if (method === 'net_version') return String(Number.parseInt(currentChainId, 16));
            if (method === 'eth_accounts') return accounts.slice();
            if (method === 'wallet_getPermissions') return permissions();
            if (method === 'eth_requestAccounts' || method === 'wallet_requestPermissions') {
              if (rejectNext) {
                rejectNext = false;
                throw rpcError(4001, 'User rejected the request.');
              }
              if (accounts.length) {
                return method === 'eth_requestAccounts' ? accounts.slice() : permissions();
              }
              return new Promise((resolve, reject) => pending.push({ method, resolve, reject }));
            }
            if (method === 'wallet_revokePermissions') {
              accounts = [];
              localStorage.removeItem(storageKey);
              localStorage.removeItem(chainKey);
              emit('accountsChanged', []);
              emit('disconnect', rpcError(4900, 'The provider is disconnected from all chains.'));
              return null;
            }
            if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') {
              currentChainId = params?.[0]?.chainId ?? currentChainId;
              localStorage.setItem(chainKey, currentChainId);
              emit('chainChanged', currentChainId);
              return null;
            }
            throw rpcError(-32601, `Unsupported method ${method}`);
          },
          on(event: string, listener: (payload?: unknown) => void) {
            (listeners[event] ??= []).push(listener);
          },
          removeListener(event: string, listener: (payload?: unknown) => void) {
            listeners[event] = (listeners[event] ?? []).filter((candidate) => candidate !== listener);
          },
        };

        const settle = (item: (typeof pending)[number]) => {
          item.resolve(item.method === 'eth_requestAccounts' ? accounts.slice() : permissions());
        };

        window.__mockWallet = {
          connect() {
            rejectNext = false;
            if (!accounts.length) accounts = [address];
            localStorage.setItem(storageKey, accounts[0]);
            pending.splice(0).forEach(settle);
            emit('connect', { chainId: currentChainId });
            emit('accountsChanged', accounts.slice());
          },
          disconnect() {
            accounts = [];
            localStorage.removeItem(storageKey);
            localStorage.removeItem(chainKey);
            emit('accountsChanged', []);
            emit('disconnect', rpcError(4900, 'The provider is disconnected from all chains.'));
          },
          switchAccount(next: string) {
            accounts = [next];
            localStorage.setItem(storageKey, next);
            emit('accountsChanged', accounts.slice());
          },
          switchChain(next: string) {
            currentChainId = next;
            localStorage.setItem(chainKey, next);
            emit('chainChanged', currentChainId);
          },
          reject() {
            const queued = pending.splice(0);
            if (!queued.length) {
              rejectNext = true;
              return;
            }
            for (const item of queued) item.reject(rpcError(4001, 'User rejected the request.'));
          },
        };

        window.ethereum = provider;
        const info = {
          uuid: '8b3d1c2e-0000-4000-8000-000000000001',
          name: 'MetaMask',
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
          rdns: 'io.metamask',
        };
        const announce = () => {
          window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info, provider } }));
        };
        window.addEventListener('eip6963:requestProvider', announce);
        announce();
      },
      { address: this.address, chainId: toHexChainId(this.chainId) },
    );
  }

  connect(): Promise<void> {
    return this.invoke('connect');
  }

  disconnect(): Promise<void> {
    return this.invoke('disconnect');
  }

  reject(): Promise<void> {
    return this.invoke('reject');
  }

  switchAccount(address: string): Promise<void> {
    return base.step('Switch the mocked wallet account', async () => {
      await this.page.evaluate((next) => {
        window.__mockWallet?.switchAccount(next);
      }, address);
    });
  }

  switchChain(chainId: number): Promise<void> {
    return base.step('Switch the mocked wallet network', async () => {
      await this.page.evaluate((next) => {
        window.__mockWallet?.switchChain(next);
      }, toHexChainId(chainId));
    });
  }

  private async invoke(action: WalletAction): Promise<void> {
    await base.step(`${actionLabel[action]} the mocked wallet`, async () => {
      const ready = await this.page
        .evaluate(() => typeof window.__mockWallet !== 'undefined')
        .catch(() => false);
      if (ready) {
        await this.page.evaluate((name) => window.__mockWallet?.[name](), action);
        return;
      }
      await this.page.addInitScript((name) => {
        window.__mockWallet?.[name]();
      }, action);
    });
  }
}

const actionLabel: Record<WalletAction, string> = {
  connect: 'Connect',
  disconnect: 'Disconnect',
  reject: 'Reject',
};

function toHexChainId(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}

export const test = base.extend<WalletFixtures & WalletOptions>({
  walletAddress: [testWallet1, { option: true }],
  walletChainId: [defaultChainId, { option: true }],
  wallet: async ({ page, walletAddress, walletChainId }, use) => {
    const wallet = new Eip1193Wallet(page, walletAddress, walletChainId);
    await wallet.install();
    await use(wallet);
  },
});
