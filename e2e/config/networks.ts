import { getAddress, type Address, type Chain } from 'viem';
import { baseSepolia } from 'viem/chains';

export type TokenConfig = {
  symbol: string;
  address: Address;
};

export type NetworkConfig = {
  name: string;
  chain: Chain;
  /** Environment variable that holds this network's JSON-RPC URL. */
  rpcEnvVar: string;
  pool: Address;
  protocolDataProvider: Address;
  tokens: Record<string, TokenConfig>;
};

/**
 * Aave V3 Base Sepolia contracts and listed underlyings.
 * Source: BGD Labs aave-address-book, library AaveV3BaseSepolia.
 */
const baseSepoliaNetwork = {
  name: 'Base Sepolia',
  chain: baseSepolia,
  rpcEnvVar: 'RPC_URL_BASE_SEPOLIA',
  pool: address('0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27'),
  protocolDataProvider: address('0xBc9f5b7E248451CdD7cA54e717a2BFe1F32b566b'),
  tokens: {
    USDT: token('USDT', '0x0a215D8ba66387DCA84B284D18c3B4ec3de6E54a'),
    cbETH: token('cbETH', '0xD171b9694f7A2597Ed006D41f7509aaD4B485c4B'),
    USDC: token('USDC', '0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f'),
    LINK: token('LINK', '0x810d46f9a9027e28f9b01f75e2bdde839da61115'),
    ETH: token('ETH', '0x4200000000000000000000000000000000000006'),
  },
} satisfies NetworkConfig;

export const networks = {
  baseSepolia: baseSepoliaNetwork,
} as const;

export type NetworkName = keyof typeof networks;

export type TokenSymbol = keyof (typeof networks)['baseSepolia']['tokens'];

export function getNetwork(name: NetworkName): (typeof networks)[NetworkName] {
  return networks[name];
}

function token(symbol: string, value: string): TokenConfig {
  return { symbol, address: address(value) };
}

function address(value: string): Address {
  return getAddress(value);
}
