import { expect } from "chai";
import { describe, it } from "mocha";
import { Contract } from "../src/contract";
import { Assets } from "../src/assets";
import { uintCal } from "../src/bn";

describe("Contract Test", () => {
  it("addLiq", async () => {
    const assets = new Assets({
      swap: {
        ordi: {
          balance: { "1": uintCal(["10000", "mul", "1e18"]) },
          tick: "ordi",
        },
        sats: {
          balance: { "1": uintCal(["50000", "mul", "1e18"]) },
          tick: "sats",
        },
      },
    });
    const contractStatus = {
      kLast: {},
    };
    const contractConfig = {
      sequencer: "",
      platformFeeOn: false,
      swapFeeRate1000: "0",
      platformFeeRate: "0",
      feeTick: "sats",
    };
    const contract = new Contract(assets, contractStatus, contractConfig);
    contract.deployPool({ address: "1", tick0: "ordi", tick1: "sats" });
    const liqOut = contract.addLiq({
      address: "1",
      tick0: "ordi",
      tick1: "sats",
      amount0: uintCal(["10000", "mul", "1e18"]),
      amount1: uintCal(["50000", "mul", "1e18"]),
      expect: "0",
      slippage1000: "0",
    });
    expect(liqOut.lp).eq("22360679774997896963091");
  });
});
