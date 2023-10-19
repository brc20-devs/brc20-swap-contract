import { uintCal } from "../../src/bn";

export function expandTo18Decimals(n: number) {
  return uintCal([n.toString(), "mul", "1e18"]);
}
