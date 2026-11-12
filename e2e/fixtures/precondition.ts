import { maxUint256, toHuman, toRaw } from '../blockchain/index.js';
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
  decimals: number;
};

/** Aave can mint an aToken balance a few raw units under the supplied amount. Supplying that gap reverts. */
const roundingDust = 5n;

/**
 * Moves the wallet to the requested supply, variable borrow, and pool allowance.
 * Repay excess debt before withdrawing collateral, and add collateral before borrowing more.
 * Allowance is applied last, because supply and repay approve the pool along the way.
 */
export async function applyPrecondition(client: AaveClient, precondition: Precondition): Promise<void> {
  console.log(`[precondition] requested ${JSON.stringify(precondition)}`);
  const entries = Object.entries(precondition) as Array<[TokenSymbol, TokenPrecondition]>;
  const supply = await targets(entries, 'supply', (symbol) => client.getSupply(symbol));
  const borrow = await targets(entries, 'borrow', (symbol) => client.getBorrow(symbol));

  for (const position of borrow) {
    if (position.current <= position.target || closeEnough(position)) continue;
    const repay = position.target === 0n ? maxUint256 : position.current - position.target;
    logPosition('borrow', position, `repay ${shown(repay, position.decimals)}`);
    await client.repay(position.symbol, repay);
  }

  for (const position of supply) {
    if (position.current <= position.target || closeEnough(position)) continue;
    const withdraw = position.target === 0n ? maxUint256 : position.current - position.target;
    logPosition('supply', position, `withdraw ${shown(withdraw, position.decimals)}`);
    await client.withdraw(position.symbol, withdraw);
  }

  for (const position of supply) {
    if (position.current > position.target && !closeEnough(position)) continue;
    const shortfall = position.target - position.current;
    const action = shortfall <= roundingDust ? 'keep' : `supply ${shown(shortfall, position.decimals)}`;
    logPosition('supply', position, action);
    if (shortfall <= roundingDust) continue;
    await client.supply(position.symbol, shortfall);
  }

  for (const position of borrow) {
    if (position.current > position.target && !closeEnough(position)) continue;
    const shortfall = position.target - position.current;
    const action = shortfall <= roundingDust ? 'keep' : `borrow ${shown(shortfall, position.decimals)}`;
    logPosition('borrow', position, action);
    if (shortfall <= roundingDust) continue;
    await client.borrow(position.symbol, shortfall);
  }

  for (const [symbol, position] of entries) {
    if (position.approval === undefined) continue;
    const current = await client.getAllowance(symbol);
    const target = allowanceTarget(position.approval, current.decimals);
    console.log(
      `[precondition] ${symbol} allowance ${current.human} -> ${shown(target, current.decimals)}`,
    );
    await client.setAllowance(symbol, target);
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
    positions.push({
      symbol,
      current: current.raw,
      target: toRaw(amount, current.decimals),
      decimals: current.decimals,
    });
  }
  return positions;
}

function closeEnough(position: Target): boolean {
  if (position.target === 0n) return position.current === 0n;
  const gap = position.current > position.target
    ? position.current - position.target
    : position.target - position.current;
  return gap <= roundingDust;
}

function logPosition(field: 'supply' | 'borrow', position: Target, action: string): void {
  const from = shown(position.current, position.decimals);
  const to = shown(position.target, position.decimals);
  console.log(`[precondition] ${position.symbol} ${field} ${from} -> ${to}: ${action}`);
}

function shown(amount: bigint, decimals: number): string {
  return amount === maxUint256 ? 'max' : toHuman(amount, decimals);
}

function allowanceTarget(amount: string, decimals: number): bigint {
  if (amount === 'none' || amount === '0') return 0n;
  if (amount === 'unlimited') return maxUint256;
  return toRaw(amount, decimals);
}
