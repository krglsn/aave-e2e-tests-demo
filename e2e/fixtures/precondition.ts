import { maxUint256, toRaw } from '../blockchain/index.js';
import type { AaveClient } from '../blockchain/aave-client.js';
import type { TokenSymbol } from '../config/networks.js';

/** Human amounts for one token. Omitted fields stay as they are. `0` clears supply or borrow. */
export type TokenPrecondition = {
  supply?: string;
  borrow?: string;
  /** `none`, `0`, `unlimited`, or an exact human amount. */
  approval?: string;
};

/** Several tokens. Each key is the token symbol. */
export type Precondition = Partial<Record<TokenSymbol, TokenPrecondition>>;

type Target = {
  symbol: TokenSymbol;
  current: bigint;
  target: bigint;
};

/**
 * Moves the wallet to the requested supply, variable borrow, and pool allowance.
 * Repay excess debt before withdrawing collateral, and add collateral before borrowing more.
 * Allowance is applied last, because supply and repay approve the pool along the way.
 */
export async function applyPrecondition(client: AaveClient, precondition: Precondition): Promise<void> {
  const entries = Object.entries(precondition) as Array<[TokenSymbol, TokenPrecondition]>;
  const supply = await targets(entries, 'supply', (symbol) => client.getSupply(symbol));
  const borrow = await targets(entries, 'borrow', (symbol) => client.getBorrow(symbol));

  for (const position of borrow) {
    if (position.current <= position.target) continue;
    const repay = position.target === 0n ? maxUint256 : position.current - position.target;
    await client.repay(position.symbol, repay);
  }

  for (const position of supply) {
    if (position.current <= position.target) continue;
    const withdraw = position.target === 0n ? maxUint256 : position.current - position.target;
    await client.withdraw(position.symbol, withdraw);
  }

  for (const position of supply) {
    if (position.current >= position.target) continue;
    await client.supply(position.symbol, position.target - position.current);
  }

  for (const position of borrow) {
    if (position.current >= position.target) continue;
    await client.borrow(position.symbol, position.target - position.current);
  }

  for (const [symbol, position] of entries) {
    if (position.approval === undefined) continue;
    const { decimals } = await client.getSupply(symbol);
    await client.setAllowance(symbol, allowanceTarget(position.approval, decimals));
  }
}

async function targets(
  entries: Array<[TokenSymbol, TokenPrecondition]>,
  field: 'supply' | 'borrow',
  read: (symbol: TokenSymbol) => Promise<{ raw: bigint; decimals: number }>,
): Promise<Target[]> {
  const positions: Target[] = [];
  for (const [symbol, position] of entries) {
    const amount = position[field];
    if (amount === undefined) continue;
    const current = await read(symbol);
    positions.push({ symbol, current: current.raw, target: toRaw(amount, current.decimals) });
  }
  return positions;
}

function allowanceTarget(amount: string, decimals: number): bigint {
  if (amount === 'none' || amount === '0') return 0n;
  if (amount === 'unlimited') return maxUint256;
  return toRaw(amount, decimals);
}
