import { getNetwork, type NetworkName } from './networks.js';

export function getRpcUrl(networkName: NetworkName): string {
  const network = getNetwork(networkName);
  const raw = process.env[network.rpcEnvVar]?.trim();

  if (!raw) {
    throw new Error(
      `${network.rpcEnvVar} must be set to a ${network.name} JSON-RPC URL before using chain data.`,
    );
  }

  try {
    return new URL(raw).toString();
  } catch {
    throw new Error(`${network.rpcEnvVar} must be an absolute URL. Received "${raw}".`);
  }
}
