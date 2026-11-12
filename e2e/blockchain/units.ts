import { formatUnits, parseUnits } from 'viem';

export type ChainAmount = {
  raw: bigint;
  decimals: number;
  /** Decimal string trimmed of trailing zeros. A ratio uses its raw scale, so 80% is "0.8". */
  human: string;
};

export type AmountComparison = {
  displayedUnits: bigint;
  onChainUnits: bigint;
  difference: bigint;
  tolerance: bigint;
  displayedText: string;
  /** On-chain amount rounded to the same scale the UI shows. */
  onChainText: string;
};

export function toChainAmount(raw: bigint, decimals: number): ChainAmount {
  return { raw, decimals, human: toHuman(raw, decimals) };
}

/** Converts a human amount to raw units. Extra fraction digits are truncated to `decimals`. */
export function toRaw(human: string, decimals: number): bigint {
  assertDecimals(decimals);
  const normalized = human.replace(/,/g, '').trim();
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ''] = unsigned.split('.');
  const digits = fraction.replace(/\D/g, '').slice(0, decimals);
  const amount = `${negative ? '-' : ''}${digits.length > 0 ? `${whole}.${digits}` : whole}`;
  return parseUnits(amount, decimals);
}

export function toHuman(raw: bigint, decimals: number): string {
  assertDecimals(decimals);
  const formatted = formatUnits(raw, decimals);
  if (!formatted.includes('.')) return formatted;
  return formatted.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/**
 * Compare a UI amount with a chain integer at the precision the UI shows.
 * "$ 74.36" is cents. "5.00%" is a ratio, so it is compared with the chain value divided by 100.
 * The default tolerance is one unit of the last displayed digit.
 */
export function compareDisplayedAmount(
  displayed: string,
  onChainRaw: bigint,
  onChainDecimals: number,
  tolerance = 1n,
): AmountComparison {
  assertDecimals(onChainDecimals);
  if (tolerance < 0n) {
    throw new Error(`Tolerance must be zero or positive. Received ${tolerance}.`);
  }

  const parsed = parseDisplayedAmount(displayed);
  const onChainUnits = scaleAmount(onChainRaw, onChainDecimals, parsed.scale);
  const difference =
    displayedUnitsDistance(parsed.units, onChainUnits);

  return {
    displayedUnits: parsed.units,
    onChainUnits,
    difference,
    tolerance,
    displayedText: displayed.trim(),
    onChainText: formatDisplayed(onChainUnits, parsed),
  };
}

function parseDisplayedAmount(displayed: string): {
  units: bigint;
  scale: number;
  fractionDigits: number;
  percent: boolean;
} {
  const matches = displayed.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length !== 1) {
    throw new Error(`Expected one amount in "${displayed}".`);
  }

  const [numeric] = matches;
  const negative = numeric.startsWith('-');
  const digits = negative ? numeric.slice(1) : numeric;
  const [whole, fraction = ''] = digits.split('.');
  const percent = displayed.includes('%');
  const units = BigInt(`${negative ? '-' : ''}${whole}${fraction}`);

  return {
    units,
    fractionDigits: fraction.length,
    percent,
    scale: fraction.length + (percent ? 2 : 0),
  };
}

function scaleAmount(raw: bigint, fromDecimals: number, toDecimals: number): bigint {
  const negative = raw < 0n;
  const value = negative ? -raw : raw;
  const scaled =
    toDecimals >= fromDecimals
      ? value * 10n ** BigInt(toDecimals - fromDecimals)
      : roundHalfAwayFromZero(value, 10n ** BigInt(fromDecimals - toDecimals));
  return negative ? -scaled : scaled;
}

function roundHalfAwayFromZero(value: bigint, divisor: bigint): bigint {
  const quotient = value / divisor;
  const remainder = value % divisor;
  return quotient + (remainder * 2n >= divisor ? 1n : 0n);
}

function displayedUnitsDistance(left: bigint, right: bigint): bigint {
  return left >= right ? left - right : right - left;
}

function formatDisplayed(
  units: bigint,
  parsed: { fractionDigits: number; percent: boolean },
): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units)
    .toString()
    .padStart(parsed.fractionDigits + 1, '0');
  const whole = parsed.fractionDigits === 0 ? digits : digits.slice(0, -parsed.fractionDigits);
  const fraction = parsed.fractionDigits === 0 ? '' : digits.slice(-parsed.fractionDigits);
  const amount = parsed.fractionDigits === 0 ? whole : `${whole}.${fraction}`;
  return `${negative ? '-' : ''}${amount}${parsed.percent ? '%' : ''}`;
}

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error(`Decimals must be an integer from 0 to 255. Received ${decimals}.`);
  }
}
