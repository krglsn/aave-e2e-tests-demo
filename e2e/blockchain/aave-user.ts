/** Aave base currency uses 8 decimals. 100000000 raw is 1.00 USD. */
export const baseCurrencyDecimals = 8;

/** LTV and liquidation threshold are basis points. 8000 raw is the ratio 0.8. */
export const basisPointDecimals = 4;

/** Health factor uses 18 decimals. The maximum uint256 means the user has no debt. */
export const healthFactorDecimals = 18;

/** Liquidity rate and stable borrow rate are annual ratios in ray units. 1e27 raw is 100%. */
export const rayDecimals = 27;

export const maxUint256 = 2n ** 256n - 1n;

export const poolAbi = [
  {
    type: 'function',
    name: 'getUserAccountData',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'totalCollateralBase', type: 'uint256' },
      { name: 'totalDebtBase', type: 'uint256' },
      { name: 'availableBorrowsBase', type: 'uint256' },
      { name: 'currentLiquidationThreshold', type: 'uint256' },
      { name: 'ltv', type: 'uint256' },
      { name: 'healthFactor', type: 'uint256' },
    ],
  },
] as const;

export const protocolDataProviderAbi = [
  {
    type: 'function',
    name: 'getUserReserveData',
    stateMutability: 'view',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'user', type: 'address' },
    ],
    outputs: [
      { name: 'currentATokenBalance', type: 'uint256' },
      { name: 'currentStableDebt', type: 'uint256' },
      { name: 'currentVariableDebt', type: 'uint256' },
      { name: 'principalStableDebt', type: 'uint256' },
      { name: 'scaledVariableDebt', type: 'uint256' },
      { name: 'stableBorrowRate', type: 'uint256' },
      { name: 'liquidityRate', type: 'uint256' },
      { name: 'stableRateLastUpdated', type: 'uint40' },
      { name: 'usageAsCollateralEnabled', type: 'bool' },
    ],
  },
] as const;
