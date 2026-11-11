import { expect } from '@playwright/test';
import { getNetwork, type TokenSymbol } from '../config/networks.js';
import { toRaw } from './units.js';
import {
  borrowVariable,
  repayVariableDebt,
  setAllowance,
  supply,
  withdrawSupply,
} from '../helpers/protocol.js';
import type { ChainAmount } from './units.js';
import type { WalletClient } from './wallet-client.js';

/** Aave position for one wallet. Supply, borrow, and repay are pool transactions. */
export class AaveClient {
  private readonly pool;

  constructor(readonly wallet: WalletClient) {
    this.pool = getNetwork(wallet.blockchain.network).pool;
  }

  getSupply(symbol: TokenSymbol): Promise<ChainAmount> {
    return this.reserve(symbol).then((position) => position.supplied);
  }

  getBorrow(symbol: TokenSymbol): Promise<ChainAmount> {
    return this.reserve(symbol).then((position) => position.variableDebt);
  }

  getAllowance(symbol: TokenSymbol): Promise<ChainAmount> {
    return this.wallet.allowance(symbol, this.pool);
  }

  async expectSupply(symbol: TokenSymbol, amount: string): Promise<void> {
    await this.expectAmount(await this.getSupply(symbol), amount, `${symbol} supply`);
  }

  async expectBorrow(symbol: TokenSymbol, amount: string): Promise<void> {
    await this.expectAmount(await this.getBorrow(symbol), amount, `${symbol} borrow`);
  }

  async supply(symbol: TokenSymbol, amount: bigint): Promise<void> {
    const balance = await this.wallet.balance(symbol);
    if (balance.raw < amount) {
      throw new Error(
        `Cannot supply ${symbol}: the wallet holds ${balance.human} and the increase requires more.`,
      );
    }
    await supply(this.wallet.address, this.token(symbol), amount);
  }

  withdraw(symbol: TokenSymbol, amount: bigint): Promise<void> {
    return withdrawSupply(this.wallet.address, this.token(symbol), amount);
  }

  borrow(symbol: TokenSymbol, amount: bigint): Promise<void> {
    return borrowVariable(this.wallet.address, this.token(symbol), amount);
  }

  repay(symbol: TokenSymbol, amount: bigint): Promise<void> {
    return repayVariableDebt(this.wallet.address, this.token(symbol), amount);
  }

  setAllowance(symbol: TokenSymbol, amount: bigint): Promise<void> {
    return setAllowance(this.wallet.address, this.token(symbol), this.pool, amount);
  }

  private reserve(symbol: TokenSymbol) {
    return this.wallet.blockchain.aaveReserve(this.wallet.address, symbol);
  }

  private token(symbol: TokenSymbol) {
    return getNetwork(this.wallet.blockchain.network).tokens[symbol].address;
  }

  private async expectAmount(actual: ChainAmount, amount: string, label: string): Promise<void> {
    const expected = toRaw(amount, actual.decimals);
    const difference = actual.raw > expected ? actual.raw - expected : expected - actual.raw;
    expect(difference, `${label}: chain ${actual.human}, expected ${amount}`).toBeLessThanOrEqual(1n);
  }
}
