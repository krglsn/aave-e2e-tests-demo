import { test as base, type Page } from '@playwright/test';
import { hexToBigInt, hexToString, isHex, type Hex } from 'viem';
import { getNetwork } from '../config/networks.js';
import { createWalletBridge } from './wallet-rpc.js';

export const testWallet1 = '0x7b697Bf94E3fa3559Ee3fbc0389D942b7230Da54';
export const testWallet2 = '0xf9b4B50794393C4870956B73531AFC83CBc7436b';
const defaultChainId = getNetwork('baseSepolia').chain.id;
export const otherWalletChainId = 10;

type WalletAction = 'connect' | 'disconnect' | 'reject';

type WalletOptions = {
  walletAddress: string;
  walletChainId: number;
};

export type TransactionSignature = {
  type: 'transaction';
  from: `0x${string}`;
  to: `0x${string}`;
  data: Hex;
  value: bigint;
};

export type MessageSignature = {
  type: 'message';
  address: `0x${string}`;
  message: string;
};

export type TypedDataSignature = {
  type: 'typedData';
  address: `0x${string}`;
  domain: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
};

export type SignatureRequest = TransactionSignature | MessageSignature | TypedDataSignature;

export type MockWallet = {
  readonly address: string;
  readonly chainId: number;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  reject(): Promise<void>;
  sign(): Promise<void>;
  signatureRequest(): Promise<SignatureRequest>;
  switchAccount(address: string): Promise<void>;
  switchChain(chainId: number): Promise<void>;
};

type WalletFixtures = {
  wallet: MockWallet;
};

declare global {
  interface Window {
    ethereum?: unknown;
    __mockWalletRpc?(method: string, params: unknown[]): Promise<unknown>;
    __mockWalletExecute?(request: { method: string; params: unknown[] }): Promise<unknown>;
    __mockWallet?: {
      connect(): void;
      disconnect(): void;
      reject(): void;
      sign(): void;
      hasSignatureRequest(): boolean;
      signatureRequest(): { method: string; params: unknown[] };
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
    const bridge = createWalletBridge({
      address: this.address,
      privateKeyEnv: privateKeyEnv(this.address),
    });
    await this.page.exposeFunction('__mockWalletRpc', (method: string, params: unknown[] = []) =>
      bridge.request(method, params),
    );
    await this.page.exposeFunction(
      '__mockWalletExecute',
      (request: { method: string; params: unknown[] }) => bridge.execute(request),
    );
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
        const signatureQueue: Array<{ method: string; params: unknown[] }> = [];
        const signatureWaiters: Array<{
          resolve: (value: unknown) => void;
          reject: (reason?: unknown) => void;
        }> = [];
        const signatureMethods = new Set([
          'eth_sendTransaction',
          'personal_sign',
          'eth_sign',
          'eth_signTypedData',
          'eth_signTypedData_v3',
          'eth_signTypedData_v4',
        ]);

        const permissions = () =>
          accounts.length ? [{ parentCapability: 'eth_accounts', invoker: location.origin }] : [];

        const provider = {
          // Aave reaches the injected provider through its MetaMask option.
          isMetaMask: true,
          request: async ({ method, params }: { method: string; params?: unknown[] }) => {
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
              const nextChain = params?.[0] as { chainId?: string } | undefined;
              currentChainId = nextChain?.chainId ?? currentChainId;
              localStorage.setItem(chainKey, currentChainId);
              emit('chainChanged', currentChainId);
              return null;
            }
            if (signatureMethods.has(method)) {
              if (rejectNext) {
                rejectNext = false;
                throw rpcError(4001, 'User rejected the request.');
              }
              return new Promise((resolve, reject) => {
                signatureQueue.push({ method, params: params ?? [] });
                signatureWaiters.push({ resolve, reject });
              });
            }
            if (!window.__mockWalletRpc) throw rpcError(4900, 'The wallet is not connected to a network.');
            return window.__mockWalletRpc(method, params ?? []);
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
            const signature = signatureWaiters.shift();
            if (signature) {
              signatureQueue.shift();
              signature.reject(rpcError(4001, 'User rejected the request.'));
              return;
            }
            const queued = pending.splice(0);
            if (!queued.length) {
              rejectNext = true;
              return;
            }
            for (const item of queued) item.reject(rpcError(4001, 'User rejected the request.'));
          },
          async sign() {
            const request = signatureQueue[0];
            const waiter = signatureWaiters[0];
            if (!request || !waiter) throw new Error('No signature request is waiting.');
            if (!window.__mockWalletExecute) throw new Error('The wallet cannot sign without the Base Sepolia connection.');
            try {
              const result = await window.__mockWalletExecute(request);
              signatureQueue.shift();
              signatureWaiters.shift();
              waiter.resolve(result);
            } catch (error) {
              signatureQueue.shift();
              signatureWaiters.shift();
              const message = error instanceof Error ? error.message : 'Failed to sign.';
              waiter.reject(rpcError(-32603, message));
              throw error;
            }
          },
          hasSignatureRequest() {
            return signatureQueue.length > 0;
          },
          signatureRequest() {
            const request = signatureQueue[0];
            if (!request) throw new Error('No signature request is waiting.');
            return { method: request.method, params: request.params };
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

  sign(): Promise<void> {
    return base.step('Sign with the mocked wallet', async () => {
      await this.waitForSignatureRequest();
      await this.page.evaluate(() => window.__mockWallet?.sign());
    });
  }

  async signatureRequest(): Promise<SignatureRequest> {
    return base.step('Read the pending wallet signature', async () => {
      await this.waitForSignatureRequest();
      const request = await this.page.evaluate(() => window.__mockWallet?.signatureRequest());
      if (!request) throw new Error('No signature request is waiting.');
      return toSignatureRequest(request);
    });
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

  private async waitForSignatureRequest(): Promise<void> {
    await this.page.waitForFunction(() => window.__mockWallet?.hasSignatureRequest() === true);
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

function privateKeyEnv(walletAddress: string): string {
  const normalized = walletAddress.toLowerCase();
  if (normalized === testWallet1.toLowerCase()) return 'WALLET1_PRIVATE_KEY';
  if (normalized === testWallet2.toLowerCase()) return 'WALLET2_PRIVATE_KEY';
  throw new Error(`No private key variable is configured for ${walletAddress}.`);
}

const typedDataMethods = new Set(['eth_signTypedData', 'eth_signTypedData_v3', 'eth_signTypedData_v4']);

function toSignatureRequest(request: { method: string; params: unknown[] }): SignatureRequest {
  if (request.method === 'eth_sendTransaction') return toTransactionSignature(request.params);
  if (typedDataMethods.has(request.method)) return toTypedDataSignature(request.params);
  if (request.method === 'personal_sign' || request.method === 'eth_sign') return toMessageSignature(request.params);
  throw new Error(`Unsupported signature method ${request.method}`);
}

function toTransactionSignature(params: unknown[]): TransactionSignature {
  const tx = (params[0] ?? {}) as { from?: string; to?: string; data?: string; value?: string };
  if (!isAddress(tx.from) || !isAddress(tx.to)) {
    throw new Error('Transaction request is missing the sender or the contract address.');
  }
  return {
    type: 'transaction',
    from: tx.from,
    to: tx.to,
    data: isHex(tx.data) ? tx.data : '0x',
    value: tx.value && isHex(tx.value) ? hexToBigInt(tx.value) : 0n,
  };
}

function toMessageSignature(params: unknown[]): MessageSignature {
  const address = params.find(isAddress);
  const raw = params.find((param) => typeof param === 'string' && !isAddress(param));
  if (!address || typeof raw !== 'string') throw new Error('Message signature request is missing the address or the message.');
  return {
    type: 'message',
    address,
    message: isHex(raw) ? hexToString(raw) : raw,
  };
}

function toTypedDataSignature(params: unknown[]): TypedDataSignature {
  const address = params.find(isAddress);
  const raw = params.find((param) => param !== address);
  const data = typeof raw === 'string' ? JSON.parse(raw) as Record<string, unknown> : raw as Record<string, unknown>;
  if (!address || !data?.domain || !data.types || !data.primaryType || !data.message) {
    throw new Error('Typed data signature request does not contain domain, types, and message.');
  }
  return {
    type: 'typedData',
    address,
    domain: data.domain as Record<string, unknown>,
    types: data.types as TypedDataSignature['types'],
    primaryType: String(data.primaryType),
    message: data.message as Record<string, unknown>,
  };
}

function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
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
