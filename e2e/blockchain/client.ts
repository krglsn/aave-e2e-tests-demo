import { createPublicClient, getAddress, http, type Address } from 'viem';
import { getNetwork, type NetworkName, type TokenConfig } from '../config/networks.js';
import { getRpcUrl } from '../config/rpc.js';
import {
  baseCurrencyDecimals,
  basisPointDecimals,
  healthFactorDecimals,
  maxUint256,
  poolAbi,
  protocolDataProviderAbi,
  rayDecimals,
} from './aave-user.js';
import { erc20Abi } from './erc20.js';
import { toChainAmount, type ChainAmount } from './units.js';

/** Collateral minus debt, both in Aave base currency. */
export function netWorth(account: UserAccountData): ChainAmount {
  return toChainAmount(
    account.totalCollateral.raw - account.totalDebt.raw,
    account.totalCollateral.decimals,
  );
}

export type TokenDetails = {
  symbol: string;
  name: string;
  decimals: number;
  address: Address;
};

export type TokenReader = {
  details(): Promise<TokenDetails>;
  balanceOf(wallet: string): Promise<ChainAmount>;
  allowance(wallet: string, spender: string): Promise<ChainAmount>;
};

export type UserAccountData = {
  totalCollateral: ChainAmount;
  totalDebt: ChainAmount;
  availableBorrows: ChainAmount;
  liquidationThreshold: ChainAmount;
  ltv: ChainAmount;
  /** `human` is "max" when the account has no debt. */
  healthFactor: ChainAmount;
};

export type UserReserveData = {
  token: TokenDetails;
  supplied: ChainAmount;
  stableDebt: ChainAmount;
  variableDebt: ChainAmount;
  principalStableDebt: ChainAmount;
  scaledVariableDebt: ChainAmount;
  stableBorrowRate: ChainAmount;
  liquidityRate: ChainAmount;
  stableRateLastUpdated: bigint;
  usageAsCollateralEnabled: boolean;
};

export type ChainClient = {
  readonly network: NetworkName;
  token(symbol: string): TokenReader;
  aaveUser(wallet: string): Promise<UserAccountData>;
  aaveReserve(wallet: string, symbol: string): Promise<UserReserveData>;
  aaveReserves(wallet: string): Promise<UserReserveData[]>;
};

export async function connectChain(networkName: NetworkName): Promise<ChainClient> {
  const network = getNetwork(networkName);
  const publicClient = createPublicClient({
    chain: network.chain,
    transport: http(getRpcUrl(networkName)),
  });
  const chainId = await publicClient.getChainId();

  if (chainId !== network.chain.id) {
    throw new Error(
      `${network.rpcEnvVar} returned chain id ${chainId}. ${network.name} expects ${network.chain.id}.`,
    );
  }

  const detailsCache = new Map<Address, Promise<TokenDetails>>();

  function requireToken(symbol: string): TokenConfig {
    const tokens: Record<string, TokenConfig> = network.tokens;
    const token = tokens[symbol];
    if (token) return token;

    const configured = Object.keys(network.tokens).join(', ');
    throw new Error(
      `Token ${symbol} is not configured for ${network.name}. Configured tokens: ${configured}.`,
    );
  }

  function details(config: TokenConfig): Promise<TokenDetails> {
    const cached = detailsCache.get(config.address);
    if (cached) return cached;

    const pending = readDetails(config).catch((error: unknown) => {
      detailsCache.delete(config.address);
      throw error;
    });
    detailsCache.set(config.address, pending);
    return pending;
  }

  async function readDetails(config: TokenConfig): Promise<TokenDetails> {
    const [name, symbol, decimals] = await Promise.all([
      publicClient.readContract({
        address: config.address,
        abi: erc20Abi,
        functionName: 'name',
      }),
      publicClient.readContract({
        address: config.address,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address: config.address,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
    ]);

    return { name, symbol, decimals, address: config.address };
  }

  const client: ChainClient = {
    network: networkName,
    token(symbol) {
      const config = requireToken(symbol);
      return {
        details: () => details(config),
        balanceOf: async (wallet) => {
          const token = await details(config);
          const raw = await publicClient.readContract({
            address: config.address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [asAddress(wallet, 'Wallet')],
          });
          return toChainAmount(raw, token.decimals);
        },
        allowance: async (wallet, spender) => {
          const token = await details(config);
          const raw = await publicClient.readContract({
            address: config.address,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [asAddress(wallet, 'Wallet'), asAddress(spender, 'Spender')],
          });
          return toChainAmount(raw, token.decimals);
        },
      };
    },
    async aaveUser(wallet) {
      const data = await publicClient.readContract({
        address: network.pool,
        abi: poolAbi,
        functionName: 'getUserAccountData',
        args: [asAddress(wallet, 'Wallet')],
      });

      return {
        totalCollateral: toChainAmount(data[0], baseCurrencyDecimals),
        totalDebt: toChainAmount(data[1], baseCurrencyDecimals),
        availableBorrows: toChainAmount(data[2], baseCurrencyDecimals),
        liquidationThreshold: toChainAmount(data[3], basisPointDecimals),
        ltv: toChainAmount(data[4], basisPointDecimals),
        healthFactor:
          data[5] === maxUint256
            ? { raw: data[5], decimals: healthFactorDecimals, human: 'max' }
            : toChainAmount(data[5], healthFactorDecimals),
      };
    },
    async aaveReserve(wallet, symbol) {
      const config = requireToken(symbol);
      const account = asAddress(wallet, 'Wallet');
      const [token, data] = await Promise.all([
        details(config),
        publicClient.readContract({
          address: network.protocolDataProvider,
          abi: protocolDataProviderAbi,
          functionName: 'getUserReserveData',
          args: [config.address, account],
        }),
      ]);

      return {
        token,
        supplied: toChainAmount(data[0], token.decimals),
        stableDebt: toChainAmount(data[1], token.decimals),
        variableDebt: toChainAmount(data[2], token.decimals),
        principalStableDebt: toChainAmount(data[3], token.decimals),
        scaledVariableDebt: toChainAmount(data[4], token.decimals),
        stableBorrowRate: toChainAmount(data[5], rayDecimals),
        liquidityRate: toChainAmount(data[6], rayDecimals),
        stableRateLastUpdated: BigInt(data[7]),
        usageAsCollateralEnabled: data[8],
      };
    },
    aaveReserves(wallet) {
      const symbols = Object.keys(network.tokens);
      return Promise.all(symbols.map((symbol) => client.aaveReserve(wallet, symbol)));
    },
  };

  return client;
}

function asAddress(value: string, label: string): Address {
  try {
    return getAddress(value);
  } catch {
    throw new Error(`${label} must be an address. Received "${value}".`);
  }
}
