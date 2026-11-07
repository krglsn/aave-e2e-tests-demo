import { getAddress } from 'viem';
import type { ChainClient, UserReserveData } from '../blockchain/index.js';
import { testWallet1 } from './wallet.fixture.js';

export type Wallet1 = {
  readonly address: string;
  readonly supplied: readonly UserReserveData[];
  readonly borrowed: readonly UserReserveData[];
};

export async function requireWallet1(blockchain: ChainClient, address: string): Promise<Wallet1> {
  const wallet = getAddress(address);
  if (wallet !== getAddress(testWallet1)) {
    throw new Error(`wallet1 requires ${testWallet1}. The test is using ${wallet}.`);
  }

  const reserves = await blockchain.aaveReserves(wallet);
  const supplied = reserves.filter((reserve) => reserve.supplied.raw > 0n);
  const borrowed = reserves.filter(
    (reserve) => reserve.stableDebt.raw > 0n || reserve.variableDebt.raw > 0n,
  );

  if (supplied.length === 0 || borrowed.length === 0) {
    throw new Error(
      `wallet1 must have an Aave supply and an Aave borrow before the test. Positions: ${reserves
        .map(describePosition)
        .join('; ')}.`,
    );
  }

  return { address: wallet, supplied, borrowed };
}

function describePosition(reserve: UserReserveData): string {
  const debt =
    reserve.stableDebt.raw === 0n && reserve.variableDebt.raw === 0n
      ? '0'
      : `${reserve.stableDebt.human} stable / ${reserve.variableDebt.human} variable`;
  return `${reserve.token.symbol} supplied ${reserve.supplied.human}, debt ${debt}`;
}
