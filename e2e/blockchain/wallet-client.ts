import { getAddress, type Address } from 'viem';
import type { TokenSymbol } from '../config/networks.js';
import type { ChainClient } from './client.js';
import type { ChainAmount } from './units.js';

/** One address on top of a blockchain client. Reads that address only. */
export class WalletClient {
  readonly address: Address;

  constructor(
    readonly blockchain: ChainClient,
    address: string,
  ) {
    this.address = getAddress(address);
  }

  balance(symbol: TokenSymbol): Promise<ChainAmount> {
    return this.blockchain.token(symbol).balanceOf(this.address);
  }

  allowance(symbol: TokenSymbol, contract: string): Promise<ChainAmount> {
    return this.blockchain.token(symbol).allowance(this.address, getAddress(contract));
  }
}
