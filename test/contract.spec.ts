import { expect } from "chai";
import { beforeEach, describe, it } from "mocha";
import { Contract } from "../src/contract";
import { Assets } from "../src/assets";
import { uintCal } from "../src/bn";
import { expandTo18Decimals } from "./shared/utilities";
import { getPairStr } from "../src/contract-utils";
import { ExactType } from "../src/types";

const FEE_TO = "2";
const ADDRESS_ALICE = "1";
const ADDRESS_ZERO = "0";
const TICK_0 = "ordi";
const TICK_1 = "sats";
const MINIMUM_LIQUIDITY = "1000";
const initToken0Amount = expandTo18Decimals(100000000);
const initToken1Amount = expandTo18Decimals(100000000);

function initSwapTickBalance(
  initState: any,
  tick: string,
  address: string,
  balance: string
) {
  initState.swap = initState.swap || {};
  initState.swap[tick] = initState.swap[tick] || {
    balance: {},
    tick,
  };
  initState.swap[tick].balance[address] = balance;
}

describe("Contract Test", () => {
  let contract: Contract;
  beforeEach(() => {
    const initState = {};
    initSwapTickBalance(initState, TICK_0, ADDRESS_ALICE, initToken0Amount);
    initSwapTickBalance(initState, TICK_1, ADDRESS_ALICE, initToken1Amount);

    const assets = new Assets(initState);

    const contractStatus = {
      kLast: {},
    };
    const contractConfig = {
      feeTo: FEE_TO,
      swapFeeRate1000: "3",
    };
    contract = new Contract(assets, contractStatus, contractConfig);
    contract.deployPool({
      address: ADDRESS_ALICE,
      tick0: TICK_0,
      tick1: TICK_1,
    });
  });

  it("addLiq", async () => {
    const liqOut = contract.addLiq({
      address: ADDRESS_ALICE,
      tick0: TICK_0,
      tick1: TICK_1,
      amount0: expandTo18Decimals(1),
      amount1: expandTo18Decimals(4),
      expect: "0",
      slippage1000: "0",
    });

    const pair = getPairStr(TICK_0, TICK_1);
    expect(contract.assets.get(pair).supply).to.eq(expandTo18Decimals(2));
    expect(contract.assets.get(pair).balance[ADDRESS_ALICE]).to.eq(
      "1999999999999999000"
    );
    expect(contract.assets.get(pair).balance[ADDRESS_ZERO]).to.eq("1000");
    expect(contract.assets.getBalance(ADDRESS_ALICE, TICK_0)).to.eq(
      expandTo18Decimals(100000000 - 1)
    );
    expect(contract.assets.getBalance(ADDRESS_ALICE, TICK_1)).to.eq(
      expandTo18Decimals(100000000 - 4)
    );

    expect(contract.assets.get(TICK_0).balanceOf(pair)).to.eq(liqOut.amount0);
    expect(contract.assets.get(TICK_1).balanceOf(pair)).to.eq(liqOut.amount1);
    expect(liqOut.lp).eq("1999999999999999000");
  });

  const swapTestCases = [
    [1, 5, 10, "1662497915624478906"],
    [1, 10, 5, "453305446940074565"],

    [2, 5, 10, "2851015155847869602"],
    [2, 10, 5, "831248957812239453"],

    [1, 10, 10, "906610893880149131"],
    [1, 100, 100, "987158034397061298"],
    [1, 1000, 1000, "996006981039903216"],
  ].map((a) =>
    a.map((n) => (typeof n === "string" ? n : expandTo18Decimals(n)))
  );
  swapTestCases.forEach((swapTestCase, i) => {
    it(`getInputPrice:${i}`, () => {
      const [swapAmount, token0Amount, token1Amount, expectedOutputAmount] =
        swapTestCase;

      contract.addLiq({
        address: ADDRESS_ALICE,
        tick0: TICK_0,
        tick1: TICK_1,
        amount0: token0Amount,
        amount1: token1Amount,
        expect: "0",
        slippage1000: "0",
      });
      const swapOut = contract.swap({
        tickIn: TICK_0,
        tickOut: TICK_1,
        address: ADDRESS_ALICE,
        exactType: ExactType.exactIn,
        expect: "0",
        slippage1000: "0",
        amount: swapAmount,
      });

      expect(swapOut.amount).to.eq(expectedOutputAmount);
    });
  });

  it("swap:token0", async () => {
    const token0Amount = expandTo18Decimals(5);
    const token1Amount = expandTo18Decimals(10);
    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = "1662497915624478906";

    contract.addLiq({
      address: ADDRESS_ALICE,
      tick0: TICK_0,
      tick1: TICK_1,
      amount0: token0Amount,
      amount1: token1Amount,
      expect: "0",
      slippage1000: "0",
    });

    contract.swap({
      tickIn: TICK_0,
      tickOut: TICK_1,
      address: ADDRESS_ALICE,
      exactType: ExactType.exactIn,
      expect: "0",
      slippage1000: "0",
      amount: swapAmount,
    });

    const pair = getPairStr(TICK_0, TICK_1);
    expect(contract.assets.getBalance(pair, TICK_0)).to.eq(
      uintCal([token0Amount, "add", swapAmount])
    );
    expect(contract.assets.getBalance(pair, TICK_1)).to.eq(
      uintCal([token1Amount, "sub", expectedOutputAmount])
    );
    const totalSupplyToken0 = contract.assets.get(TICK_0).supply;
    const totalSupplyToken1 = contract.assets.get(TICK_1).supply;
    expect(contract.assets.getBalance(ADDRESS_ALICE, TICK_0)).to.eq(
      uintCal([totalSupplyToken0, "sub", token0Amount, "sub", swapAmount])
    );
    expect(contract.assets.getBalance(ADDRESS_ALICE, TICK_1)).to.eq(
      uintCal([
        totalSupplyToken1,
        "sub",
        token1Amount,
        "add",
        expectedOutputAmount,
      ])
    );
  });

  it("swap:token1", async () => {
    const token0Amount = expandTo18Decimals(5);
    const token1Amount = expandTo18Decimals(10);
    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = "453305446940074565";

    contract.addLiq({
      address: ADDRESS_ALICE,
      tick0: TICK_0,
      tick1: TICK_1,
      amount0: token0Amount,
      amount1: token1Amount,
      expect: "0",
      slippage1000: "0",
    });

    contract.swap({
      tickIn: TICK_1,
      tickOut: TICK_0,
      address: ADDRESS_ALICE,
      exactType: ExactType.exactIn,
      expect: "0",
      slippage1000: "0",
      amount: swapAmount,
    });

    const pair = getPairStr(TICK_0, TICK_1);
    expect(contract.assets.getBalance(pair, TICK_0)).to.eq(
      uintCal([token0Amount, "sub", expectedOutputAmount])
    );
    expect(contract.assets.getBalance(pair, TICK_1)).to.eq(
      uintCal([token1Amount, "add", swapAmount])
    );
    const totalSupplyToken0 = contract.assets.get(TICK_0).supply;
    const totalSupplyToken1 = contract.assets.get(TICK_1).supply;
    expect(contract.assets.getBalance(ADDRESS_ALICE, TICK_0)).to.eq(
      uintCal([
        totalSupplyToken0,
        "sub",
        token0Amount,
        "add",
        expectedOutputAmount,
      ])
    );
    expect(contract.assets.getBalance(ADDRESS_ALICE, TICK_1)).to.eq(
      uintCal([totalSupplyToken1, "sub", token1Amount, "sub", swapAmount])
    );
  });

  it("feeTo", async () => {
    const token0Amount = expandTo18Decimals(1000);
    const token1Amount = expandTo18Decimals(1000);
    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = "996006981039903216";
    const pair = getPairStr(TICK_0, TICK_1);
    contract.addLiq({
      address: ADDRESS_ALICE,
      tick0: TICK_0,
      tick1: TICK_1,
      amount0: token0Amount,
      amount1: token1Amount,
      expect: "0",
      slippage1000: "0",
    });
    const swapResult = contract.swap({
      tickIn: TICK_1,
      tickOut: TICK_0,
      address: ADDRESS_ALICE,
      exactType: ExactType.exactOut,
      expect: swapAmount,
      slippage1000: "0",
      amount: expectedOutputAmount,
    });

    expect(swapResult.amount).to.eq(swapAmount);

    contract.removeLiq({
      tick0: TICK_0,
      tick1: TICK_1,
      address: ADDRESS_ALICE,
      lp: contract.assets.getBalance(ADDRESS_ALICE, pair),
      amount0: "0",
      amount1: "0",
      slippage1000: "0",
    });
    expect(contract.assets.get(pair).supply).to.eq(
      uintCal([MINIMUM_LIQUIDITY, "add", "249750499251388"])
    );
    expect(contract.assets.getBalance(ADDRESS_ALICE, pair)).to.eq("0");
    expect(contract.assets.getBalance(FEE_TO, pair)).to.eq("249750499251388");
    expect(contract.assets.getBalance(pair, TICK_0)).to.eq(
      uintCal(["1000", "add", "249501683697445"])
    );
    expect(contract.assets.getBalance(pair, TICK_1)).to.eq(
      uintCal(["1000", "add", "250000187312969"])
    );
  });
});
