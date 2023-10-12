import { expect } from "chai";
import { describe, it } from "mocha";
import { Contract } from "../src/contract";
import { Assets } from "../src/assets";
import { bnCal } from "../src/bn";

describe("Contract Test", () => {
  it("addLiq", async () => {
    const assets = new Assets({
      pool: {},
      approval: {
        "1": {
          ordi: bnCal(["10000", "mul", "1e18"]),
          sats: bnCal(["50000", "mul", "1e18"]),
        },
      },
      withdrawable: {},
      pendingApproval: {},
      pendingWithdrawable: {},
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
      amount0: bnCal(["10000", "mul", "1e18"]),
      amount1: bnCal(["50000", "mul", "1e18"]),
      expect: "0",
      slippage1000: "0",
    });
    expect(liqOut.lp === "22360679774997896964091");
  });
});
