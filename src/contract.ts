import { ContractConfig, ContractStatus } from "./types";
import {
  AddLiqIn,
  AddLiqOut,
  AmountInputIn,
  AmountOutputIn,
  DeployPoolIn,
  DeployPoolOut,
  ExactType,
  MintFeeIn,
  RemoveLiqIn,
  RemoveLiqOut,
  SendIn,
  SendOut,
  SwapIn,
  SwapOut,
} from "./types";
import { bn, bnCal } from "./bn";
import {
  checkGtZero,
  checkGteZero,
  checkSlippage,
  getPairStr,
  need,
  sortTickParams,
} from "./contract-utils";
import { Assets } from "./assets";

const exceeding_slippage = "exceeding slippage";
const pool_existed = "pool existed";
const duplicate_tick = "duplicate tick";
const insufficient_liquidity = "insufficient liquidity for this trade";

export class Contract {
  readonly assets: Assets;
  readonly status: ContractStatus;
  readonly config: ContractConfig;

  constructor(assets: Assets, status: ContractStatus, config: ContractConfig) {
    if (!(assets instanceof Assets)) {
      assets = new Assets(assets);
    }
    this.assets = assets;
    this.status = status;
    this.config = config;
  }

  public deployPool(params: DeployPoolIn): DeployPoolOut {
    need(params.tick0 !== params.tick1, duplicate_tick);

    const pair = getPairStr(params.tick0, params.tick1);
    need(!this.assets.pool[pair], pool_existed);
    this.assets.pool[pair] = { amount0: "0", amount1: "0", lp: "0" };
    return {};
  }

  public addLiq(params: AddLiqIn): AddLiqOut {
    const { tick0, tick1, amount0, amount1, expect, slippage1000 } =
      sortTickParams(params);

    checkGteZero(expect);
    checkSlippage(slippage1000);

    const pair = getPairStr(tick0, tick1);
    const pool = this.assets.pool[pair];
    const { address } = params;

    this.mintFee({
      tick0,
      tick1,
    });

    if (pool.lp == "0") {
      const lp = bnCal([amount0, "mul", amount1, "sqrt"]);

      // ensure there is always liquidity in the pool
      const firstLP = bnCal([lp, "sub", "1000"]);

      this.assets.mintLp(address, pair, firstLP, amount0, amount1);
      this.assets.mintLp("0", pair, "1000");

      need(
        bn(firstLP).gte(
          bnCal([
            expect,
            "mul",
            bnCal(["1000", "sub", slippage1000]),
            "div",
            "1000",
          ])
        ),
        exceeding_slippage
      );

      if (this.config.platformFeeOn) {
        this.status.kLast[pair] = bnCal([pool.amount0, "mul", pool.amount1]);
      }

      return { lp: firstLP, amount0, amount1 };
    } else {
      const lp0 = bnCal([amount0, "mul", pool.lp, "div", pool.amount0]);
      const lp1 = bnCal([amount1, "mul", pool.lp, "div", pool.amount1]);

      let lp: string;
      let amount0Adjust: string;
      let amount1Adjust: string;
      if (bn(lp0).lt(lp1)) {
        amount0Adjust = amount0;
        amount1Adjust = bnCal([lp0, "mul", pool.amount1, "div", pool.lp]);
        lp = lp0;
      } else {
        amount0Adjust = bnCal([lp1, "mul", pool.amount0, "div", pool.lp]);
        amount1Adjust = amount1;
        lp = lp1;
      }

      this.assets.mintLp(address, pair, lp, amount0Adjust, amount1Adjust);

      need(
        bn(lp).gte(
          bnCal([
            expect,
            "mul",
            bnCal(["1000", "sub", slippage1000]),
            "div",
            "1000",
          ])
        ),
        exceeding_slippage
      );
      need(amount1Adjust == amount1 || amount0Adjust == amount0);

      if (this.config.platformFeeOn) {
        this.status.kLast[pair] = bnCal([pool.amount0, "mul", pool.amount1]);
      }

      return { lp, amount0: amount0Adjust, amount1: amount1Adjust };
    }
  }

  public removeLiq(params: RemoveLiqIn): RemoveLiqOut {
    const { address, lp, tick0, tick1, amount0, amount1, slippage1000 } =
      sortTickParams(params);

    checkGteZero(amount0);
    checkGteZero(amount1);
    checkSlippage(slippage1000);

    this.mintFee({
      tick0,
      tick1,
    });

    const pair = getPairStr(tick0, tick1);
    const pool = this.assets.pool[pair];
    const poolLp = pool.lp;
    const reserve0 = pool.amount0;
    const reserve1 = pool.amount1;
    const acquire0 = bnCal([lp, "mul", reserve0, "div", poolLp]);
    const acquire1 = bnCal([lp, "mul", reserve1, "div", poolLp]);

    this.assets.burnLp(address, pair, lp, acquire0, acquire1);

    need(
      bn(acquire0).gte(
        bnCal([
          amount0,
          "mul",
          bnCal(["1000", "sub", slippage1000]),
          "div",
          "1000",
        ])
      ),
      exceeding_slippage
    );
    need(
      bn(acquire1).gte(
        bnCal([
          amount1,
          "mul",
          bnCal(["1000", "sub", slippage1000]),
          "div",
          "1000",
        ])
      ),
      exceeding_slippage
    );

    if (this.config.platformFeeOn) {
      this.status.kLast[pair] = bnCal([pool.amount0, "mul", pool.amount1]);
    }

    return { tick0, tick1, amount0: acquire0, amount1: acquire1 };
  }

  public swap(params: SwapIn): SwapOut {
    const {
      tick0,
      tick1,
      address,
      tick,
      exactType,
      expect,
      slippage1000,
      amount,
    } = sortTickParams(params);

    checkGteZero(expect);
    checkSlippage(slippage1000);

    const pair = getPairStr(tick0, tick1);
    const pool = this.assets.pool[pair];

    let amountIn: string;
    let amountOut: string;
    let reserveIn: string;
    let reserveOut: string;
    let tickIn: string;
    let tickOut: string;
    let ret: string;

    if (exactType == ExactType.exactIn) {
      amountIn = amount;
      if (tick == tick0) {
        reserveIn = pool.amount0;
        reserveOut = pool.amount1;
        tickIn = tick0;
        tickOut = tick1;
      } else {
        reserveIn = pool.amount1;
        reserveOut = pool.amount0;
        tickIn = tick1;
        tickOut = tick0;
      }

      amountOut = this.getAmountOut({
        amountIn,
        reserveIn,
        reserveOut,
      });

      const amountOutMin = bnCal([
        expect,
        "mul",
        bnCal(["1000", "div", bnCal(["1000", "add", slippage1000])]),
      ]);
      need(bn(amountOut).gte(amountOutMin), exceeding_slippage);

      ret = amountOut;
    } else {
      amountOut = amount;
      if (tick == tick0) {
        reserveIn = pool.amount1;
        reserveOut = pool.amount0;
        tickIn = tick1;
        tickOut = tick0;
      } else {
        reserveIn = pool.amount0;
        reserveOut = pool.amount1;
        tickIn = tick0;
        tickOut = tick1;
      }

      amountIn = this.getAmountIn({
        amountOut,
        reserveIn,
        reserveOut,
      });

      const amountInMax = bnCal([
        expect,
        "mul",
        bnCal(["1000", "add", slippage1000]),
        "div",
        "1000",
      ]);
      need(bn(amountIn).lte(amountInMax), exceeding_slippage);

      ret = amountIn;
    }

    this.assets.swap(address, tickIn, tickOut, amountIn, amountOut);

    return { amount: ret };
  }

  getAmountOut(params: AmountInputIn) {
    const { amountIn, reserveIn, reserveOut } = params;
    checkGtZero(amountIn);
    need(
      bn(reserveIn).gt("0") && bn(reserveOut).gt("0"),
      insufficient_liquidity
    );
    const amountInWithFee = bnCal([
      amountIn,
      "mul",
      bnCal(["1000", "sub", this.config.swapFeeRate1000]),
    ]);
    const numerator = bnCal([amountInWithFee, "mul", reserveOut]);
    const denominator = bnCal([
      reserveIn,
      "mul",
      "1000",
      "add",
      amountInWithFee,
    ]);
    return bnCal([numerator, "div", denominator]);
  }

  getAmountIn(params: AmountOutputIn) {
    const { amountOut, reserveIn, reserveOut } = params;
    checkGtZero(amountOut);
    need(
      bn(reserveIn).gt("0") && bn(reserveOut).gt("0"),
      insufficient_liquidity
    );

    const numerator = bnCal([reserveIn, "mul", amountOut, "mul", "1000"]);
    const denominator = bnCal([
      reserveOut,
      "sub",
      amountOut,
      "mul",
      bnCal(["1000", "sub", this.config.swapFeeRate1000]),
    ]);
    return bnCal([numerator, "div", denominator, "add", "1"]);
  }

  public send(params: SendIn): SendOut {
    const { from, to, tick, amount } = params;

    this.assets.transfer(from, to, tick, amount);

    return {};
  }

  private mintFee(params: MintFeeIn) {
    const { tick0, tick1 } = params;

    const pair = getPairStr(tick0, tick1);
    const pool = this.assets.pool[pair];
    this.assets.checkPool(pair);

    const reserve0 = pool.amount0 || "0";
    const reserve1 = pool.amount1 || "0";

    if (this.config.platformFeeOn) {
      if (bn(this.status.kLast[pair]).gt("0")) {
        const rootK = bnCal([reserve0, "mul", reserve1, "sqrt"]);
        const rootKLast = bnCal([this.status.kLast[pair], "sqrt"]);
        if (bn(rootK).gt(rootKLast)) {
          const numerator = bnCal([
            pool.lp,
            "mul",
            bnCal([rootK, "sub", rootKLast]),
          ]);
          const scale = bnCal([this.config.platformFeeRate, "sub", "1"]);
          const denominator = bnCal([rootK, "mul", scale, "add", rootKLast]);
          const liquidity = bnCal([numerator, "div", denominator]);
          pool.lp = bnCal([pool.lp, "add", liquidity]);

          const sequencer = this.config.sequencer;

          this.assets.mintLp(sequencer, pair, liquidity);
        }
      }
    } else {
      this.status.kLast[pair] = "0";
    }
  }
}
