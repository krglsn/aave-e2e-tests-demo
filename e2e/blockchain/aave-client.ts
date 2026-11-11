import { expect } from '@playwright/test';
import { getNetwork, type TokenSymbol } from '../config/networks.js';
import { maxUint256 } from './aave-user.js';
import { toHuman, toRaw } from './units.js';
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
    await this.logAction('supply', symbol, amount, `wallet balance ${balance.human}`);
    if (balance.raw < amount) {
      throw new Error(
        `Cannot supply ${symbol}: the wallet holds ${balance.human} and the increase requires more.`,
      );
    }
    await supply(this.wallet.address, this.token(symbol), amount);
  }

  async withdraw(symbol: TokenSymbol, amount: bigint): Promise<void> {
    await this.logAction('withdraw', symbol, amount);
    await withdrawSupply(this.wallet.address, this.token(symbol), amount);
  }

  async borrow(symbol: TokenSymbol, amount: bigint): Promise<void> {
    await this.logAction('borrow', symbol, amount);
    await borrowVariable(this.wallet.address, this.token(symbol), amount);
  }

  async repay(symbol: TokenSymbol, amount: bigint): Promise<void> {
    await this.logAction('repay', symbol, amount);
    await repayVariableDebt(this.wallet.address, this.token(symbol), amount);
  }

  async setAllowance(symbol: TokenSymbol, amount: bigint): Promise<void> {
    const current = await this.getAllowance(symbol);
    await this.logAction('set allowance', symbol, amount, `current ${current.human}`);
    await setAllowance(this.wallet.address, this.token(symbol), this.pool, amount);
  }

  private reserve(symbol: TokenSymbol) {
    return this.wallet.blockchain.aaveReserve(this.wallet.address, symbol);
  }

  private token(symbol: TokenSymbol) {
    return getNetwork(this.wallet.blockchain.network).tokens[symbol].address;
  }

  private async logAction(action: string, symbol: TokenSymbol, amount: bigint, detail?: string): Promise<void> {
    const { decimals } = await this.getSupply(symbol);
    const shown = amount === maxUint256 ? 'max' : toHuman(amount, decimals);
    const extra = detail === undefined ? '' : `; ${detail}`;
    console.log(`[aave] ${action} ${symbol} ${shown}${extra}`);
  }

  private async expectAmount(actual: ChainAmount, amount: string, label: string): Promise<void> {
    const expected = toRaw(amount, actual.decimals);
    const difference = actual.raw > expected ? actual.raw - expected : expected - actual.raw;
    expect(difference, `${label}: chain ${actual.human}, expected ${amount}`).toBeLessThanOrEqual(1n);
  }
}
