import Decimal from 'decimal.js';

/**
 * All monetary arithmetic goes through Decimal with half-up rounding to the
 * currency minor unit (2 dp for ZMW). Values cross module boundaries as
 * strings so they never pass through binary floating point.
 */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;
export type MoneyLike = string | number | Dec;

export const ZERO = new D(0);

export function dec(v: MoneyLike | null | undefined): Dec {
  if (v === null || v === undefined || v === '') return ZERO;
  return new D(v);
}

export function round2(v: MoneyLike): Dec {
  return dec(v).toDecimalPlaces(2, D.ROUND_HALF_UP);
}

/** Format to a canonical 2-dp string, e.g. "1250.00". */
export function m(v: MoneyLike): string {
  return round2(v).toFixed(2);
}

export function sum(values: MoneyLike[]): Dec {
  return values.reduce<Dec>((acc, v) => acc.plus(dec(v)), ZERO);
}

export function min(a: MoneyLike, b: MoneyLike): Dec {
  return D.min(dec(a), dec(b));
}

export function max(a: MoneyLike, b: MoneyLike): Dec {
  return D.max(dec(a), dec(b));
}
