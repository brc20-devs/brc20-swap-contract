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
const duplicate_tick = "duplicate tick";
const insufficient_liquidity = "insufficient liquidity for this trade";
const pool_existed = "pool existed";
const pool_not_found = "pool not found";

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
    need(!this.assets.isExist(pair), pool_existed);

    this.assets.tryCreate(pair);
    return {};
  }

  public addLiq(params: AddLiqIn): AddLiqOut {
    const { tick0, tick1, amount0, amount1, expect, slippage1000 } =
      sortTickParams(params);

    checkGteZero(expect);
    checkSlippage(slippage1000);

    const pair = getPairStr(tick0, tick1);
    const { address } = params;
    need(!!this.assets.isExist(pair), pool_not_found);

    this.mintFee({
      tick0,
      tick1,
    });

    if (this.assets.get(pair).supply == "0") {
      const lp = bnCal([amount0, "mul", amount1, "sqrt"]);

      // ensure there is always liquidity in the pool
      const firstLP = bnCal([lp, "sub", "1000"]);

      this.assets.get(pair).mint(address, firstLP);
      this.assets.get(pair).mint("0", "1000");
      this.assets.get(tick0).transfer(address, pair, amount0);
      this.assets.get(tick1).transfer(address, pair, amount1);

      checkGtZero(firstLP);
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
        this.status.kLast[pair] = bnCal([
          this.assets.get(tick0).balanceOf(pair),
          "mul",
          this.assets.get(tick1).balanceOf(pair),
        ]);
      }

      return { lp: firstLP, amount0, amount1 };
    } else {
      let amount0Adjust: string;
      let amount1Adjust: string;

      const poolLp = this.assets.get(pair).supply;
      const poolAmount0 = this.assets.get(tick0).balanceOf(pair);
      const poolAmount1 = this.assets.get(tick1).balanceOf(pair);

      amount1Adjust = bnCal([amount0, "mul", poolAmount1, "div", poolAmount0]);
      if (bn(amount1Adjust).lte(amount1)) {
        amount0Adjust = amount0;
      } else {
        amount0Adjust = bnCal([
          amount1,
          "mul",
          poolAmount0,
          "div",
          poolAmount1,
        ]);
        amount1Adjust = amount1;
      }

      const lp0 = bnCal([amount0Adjust, "mul", poolLp, "div", poolAmount0]);
      const lp1 = bnCal([amount1Adjust, "mul", poolLp, "div", poolAmount1]);
      const lp = bn(lp0).lt(lp1) ? lp0 : lp1;

      this.assets.get(pair).mint(address, lp);
      this.assets.get(tick0).transfer(address, pair, amount0Adjust);
      this.assets.get(tick1).transfer(address, pair, amount1Adjust);

      checkGtZero(lp);
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
        this.status.kLast[pair] = bnCal([
          this.assets.get(tick0).balanceOf(pair),
          "mul",
          this.assets.get(tick1).balanceOf(pair),
        ]);
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
    need(!!this.assets.isExist(pair), pool_not_found);

    const poolLp = this.assets.get(pair).supply;
    const reserve0 = this.assets.get(tick0).balanceOf(pair);
    const reserve1 = this.assets.get(tick1).balanceOf(pair);
    const acquire0 = bnCal([lp, "mul", reserve0, "div", poolLp]);
    const acquire1 = bnCal([lp, "mul", reserve1, "div", poolLp]);

    this.assets.get(pair).burn(address, lp);
    this.assets.get(tick0).transfer(pair, address, acquire0);
    this.assets.get(tick1).transfer(pair, address, acquire1);

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
      this.status.kLast[pair] = bnCal([
        this.assets.get(tick0).balanceOf(pair),
        "mul",
        this.assets.get(tick1).balanceOf(pair),
      ]);
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
        reserveIn = this.assets.get(tick0).balanceOf(pair);
        reserveOut = this.assets.get(tick1).balanceOf(pair);
        tickIn = tick0;
        tickOut = tick1;
      } else {
        reserveIn = this.assets.get(tick1).balanceOf(pair);
        reserveOut = this.assets.get(tick0).balanceOf(pair);
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
        reserveIn = this.assets.get(tick1).balanceOf(pair);
        reserveOut = this.assets.get(tick0).balanceOf(pair);
        tickIn = tick1;
        tickOut = tick0;
      } else {
        reserveIn = this.assets.get(tick0).balanceOf(pair);
        reserveOut = this.assets.get(tick1).balanceOf(pair);
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
    this.assets.get(tick).transfer(from, to, amount);
    return {};
  }

  private mintFee(params: MintFeeIn) {
    const { tick0, tick1 } = params;

    const pair = getPairStr(tick0, tick1);

    const reserve0 = this.assets.get(tick0).balanceOf(pair);
    const reserve1 = this.assets.get(tick1).balanceOf(pair);

    if (this.config.platformFeeOn) {
      if (bn(this.status.kLast[pair]).gt("0")) {
        const rootK = bnCal([reserve0, "mul", reserve1, "sqrt"]);
        const rootKLast = bnCal([this.status.kLast[pair], "sqrt"]);
        if (bn(rootK).gt(rootKLast)) {
          const numerator = bnCal([
            this.assets.get(pair).supply,
            "mul",
            bnCal([rootK, "sub", rootKLast]),
          ]);
          const scale = bnCal([this.config.platformFeeRate, "sub", "1"]);
          const denominator = bnCal([rootK, "mul", scale, "add", rootKLast]);
          const liquidity = bnCal([numerator, "div", denominator]);

          this.assets.get(pair).mint(this.config.sequencer, liquidity);
        }
      }
    } else {
      this.status.kLast[pair] = "0";
    }
  }
}
