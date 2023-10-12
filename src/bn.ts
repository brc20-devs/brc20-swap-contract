import BigNumber from "bignumber.js";
import { need } from "./contract-utils";

export const bn = BigNumber as typeof BigNumber;

// global config
bn.config({
  EXPONENTIAL_AT: 1e9,
  DECIMAL_PLACES: 0,
  ROUNDING_MODE: bn.ROUND_DOWN,
});

export type BnCalSymbol = "add" | "sub" | "mul" | "div" | "sqrt";

export function bnInt(value: string, decimal: string) {
  return bnCal([value, "mul", bnCal(["10", "pow", decimal])]);
}

export function bnDecimalPlacesValid(amount: string, decimal: string) {
  return bn(bn(amount).decimalPlaces()!).lte(decimal);
}

export function bnDecimal(value: string, decimal: string) {
  const _bn = bn.clone({
    EXPONENTIAL_AT: 1e9,
    DECIMAL_PLACES: 18,
    ROUNDING_MODE: bn.ROUND_DOWN,
  });
  return _bn(value)
    .div(_bn("10").pow(decimal))
    .decimalPlaces(parseInt(decimal))
    .toString();
}

export function bnCal(
  items: (BnCalSymbol | BigNumber.Value)[],
  decimalPlaces?: string
): string {
  const _bn = bn.clone();
  _bn.config({
    EXPONENTIAL_AT: 1e9,
    DECIMAL_PLACES: decimalPlaces ? parseInt(decimalPlaces) : 0,
    ROUNDING_MODE: bn.ROUND_DOWN,
  });
  let ret = _bn(items[0]);
  need(!_bn(items[0]).isNaN());
  need(_bn(items[1]).isNaN());
  for (let i = 1; i < items.length; i++) {
    const cur = items[i];
    const next = items[i + 1];
    if (cur == "add") {
      need(_bn(next).gte("0"));
      ret = ret.plus(next);
      i++;
    } else if (cur == "sub") {
      need(_bn(next).gte("0"));
      ret = ret.minus(next);
      i++;
    } else if (cur == "mul") {
      need(_bn(next).gte("0"));
      ret = ret.times(next);
      i++;
    } else if (cur == "div") {
      need(_bn(next).gte("0"));
      ret = ret.div(next);
      i++;
    } else if (cur == "pow") {
      need(_bn(next).gte("0"));
      ret = ret.pow(next);
      i++;
    } else if (cur == "sqrt") {
      ret = ret.sqrt();
    } else if (!_bn(cur).isNaN()) {
      need(_bn(next).isNaN());
    }
  }

  if (decimalPlaces) {
    return ret.decimalPlaces(parseInt(decimalPlaces)).toString();
  } else {
    return ret.toString();
  }
}
