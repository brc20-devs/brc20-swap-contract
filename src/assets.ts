import { Balance, Pool } from "./types";
import { bn, bnCal } from "./bn";
import { getPairStr, getPairStruct, need } from "./contract-utils";

type AssetType =
  | "approval"
  | "withdrawable"
  | "pendingApproval"
  | "pendingWithdrawable";

const invalid_amount = "invalid amount";
const insufficient_amount = "insufficient amount";
const pool_not_found = "pool not found";

export class Assets {
  readonly pool: Pool;
  readonly approval: Balance;
  readonly withdrawable: Balance;
  readonly pendingApproval: Balance;
  readonly pendingWithdrawable: Balance;

  constructor(assets: {
    pool: Pool;
    approval: Balance;
    withdrawable: Balance;
    pendingApproval: Balance;
    pendingWithdrawable: Balance;
  }) {
    this.pool = assets.pool;
    this.approval = assets.approval;
    this.withdrawable = assets.withdrawable;
    this.pendingApproval = assets.pendingApproval;
    this.pendingWithdrawable = assets.pendingWithdrawable;
  }

  checkPool(pair: string) {
    need(!!this.pool[pair], pool_not_found);
  }

  getBalance(address: string, assetType: AssetType, tick: string): string {
    return this[assetType][address]?.[tick] || "0";
  }

  mintTick(address: string, tick: string, amount: string) {
    need(bn(amount).gt("0"), invalid_amount);
    if (!this.pendingApproval[address]) {
      this.pendingApproval[address] = {};
    }
    this.pendingApproval[address][tick] = bnCal([
      this.pendingApproval[address][tick] || "0",
      "add",
      amount,
    ]);
  }

  mintLp(
    address: string,
    pair: string,
    lp: string,
    amount0?: string,
    amount1?: string
  ) {
    need(bn(lp).gt("0"), invalid_amount);

    this.checkPool(pair);
    const { tick0, tick1 } = getPairStruct(pair);

    this.pool[pair].lp = bnCal([this.pool[pair].lp || "0", "add", lp]);
    if (!this.approval[address]) {
      this.approval[address] = {};
    }
    this.approval[address][pair] = bnCal([
      this.approval[address][pair] || "0",
      "add",
      lp,
    ]);

    if (amount0) {
      need(bn(amount0).gt("0"), invalid_amount);
      this.pool[pair].amount0 = bnCal([
        this.pool[pair].amount0 || "0",
        "add",
        amount0,
      ]);
      this.approval[address][tick0] = bnCal([
        this.approval[address][tick0] || "0",
        "sub",
        amount0,
      ]);
    }
    if (amount1) {
      need(bn(amount1).gt("0"), invalid_amount);
      this.pool[pair].amount1 = bnCal([
        this.pool[pair].amount1 || "0",
        "add",
        amount1,
      ]);
      this.approval[address][tick1] = bnCal([
        this.approval[address][tick1] || "0",
        "sub",
        amount1,
      ]);
    }

    need(bn(this.pool[pair].lp).gte("0"), insufficient_amount);
    need(bn(this.pool[pair].amount0).gte("0"), insufficient_amount);
    need(bn(this.pool[pair].amount1).gte("0"), insufficient_amount);
    need(bn(this.approval[address][pair]).gte("0"), insufficient_amount);
    if (amount0) {
      need(bn(this.approval[address][tick0]).gte("0"), insufficient_amount);
    }
    if (amount1) {
      need(bn(this.approval[address][tick1]).gte("0"), insufficient_amount);
    }
  }

  burnLp(
    address: string,
    pair: string,
    lp: string,
    amount0: string,
    amount1: string
  ) {
    need(bn(lp).gt("0"), invalid_amount);
    need(bn(amount0).gt("0"), invalid_amount);
    need(bn(amount1).gt("0"), invalid_amount);

    this.checkPool(pair);
    const { tick0, tick1 } = getPairStruct(pair);

    this.pool[pair].lp = bnCal([this.pool[pair].lp, "sub", lp]);
    this.pool[pair].amount0 = bnCal([
      this.pool[pair].amount0 || "0",
      "sub",
      amount0,
    ]);
    this.pool[pair].amount1 = bnCal([
      this.pool[pair].amount1 || "0",
      "sub",
      amount1,
    ]);
    this.approval[address][pair] = bnCal([
      this.approval[address][pair] || "0",
      "sub",
      lp,
    ]);
    this.approval[address][tick0] = bnCal([
      this.approval[address][tick0] || "0",
      "add",
      amount0,
    ]);
    this.approval[address][tick1] = bnCal([
      this.approval[address][tick1] || "0",
      "add",
      amount1,
    ]);

    need(bn(this.pool[pair].lp).gte("0"), insufficient_amount);
    need(bn(this.pool[pair].amount0).gte("0"), insufficient_amount);
    need(bn(this.pool[pair].amount1).gte("0"), insufficient_amount);
    need(bn(this.approval[address][pair]).gte("0"), insufficient_amount);
    need(bn(this.approval[address][tick0]).gte("0"), insufficient_amount);
    need(bn(this.approval[address][tick1]).gte("0"), insufficient_amount);
  }

  convert(
    address: string,
    tick: string,
    amount: string,
    fromAssetType: AssetType,
    toAssetType: AssetType
  ) {
    need(bn(amount).gt("0"), invalid_amount);
    need(
      bn(this[fromAssetType][address]?.[tick]).gte(amount),
      insufficient_amount
    );
    need(fromAssetType !== toAssetType);

    this[fromAssetType][address][tick] = bnCal([
      this[fromAssetType][address][tick],
      "sub",
      amount,
    ]);
    if (!this[toAssetType][address]) {
      this[toAssetType][address] = {};
    }
    this[toAssetType][address][tick] = bnCal([
      this[toAssetType][address][tick] || "0",
      "add",
      amount,
    ]);
  }

  transfer(from: string, to: string, tick: string, amount: string) {
    need(bn(amount).gt("0"), invalid_amount);
    need(bn(this.approval[from][tick]).gte(amount), insufficient_amount);

    this.approval[from][tick] = bnCal([
      this.approval[from][tick] || "0",
      "sub",
      amount,
    ]);
    this.approval[to][tick] = bnCal([
      this.approval[to][tick] || "0",
      "add",
      amount,
    ]);

    need(bn(this.approval[from][tick]).gte("0"), insufficient_amount);
    need(bn(this.approval[to][tick]).gte("0"), insufficient_amount);
  }

  swap(
    address: string,
    tickIn: string,
    tickOut: string,
    amountIn: string,
    amountOut: string
  ) {
    const pair = getPairStr(tickIn, tickOut);
    const { tick0 } = getPairStruct(pair);
    need(bn(amountIn).gt("0"), invalid_amount);
    need(bn(amountOut).gt("0"), invalid_amount);

    if (tickIn == tick0) {
      this.pool[pair].amount0 = bnCal([
        this.pool[pair].amount0,
        "add",
        amountIn,
      ]);
      this.pool[pair].amount1 = bnCal([
        this.pool[pair].amount1,
        "sub",
        amountOut,
      ]);
    } else {
      this.pool[pair].amount1 = bnCal([
        this.pool[pair].amount1,
        "add",
        amountIn,
      ]);
      this.pool[pair].amount0 = bnCal([
        this.pool[pair].amount0,
        "sub",
        amountOut,
      ]);
    }

    this.approval[address][tickIn] = bnCal([
      this.approval[address][tickIn],
      "sub",
      amountIn,
    ]);
    this.approval[address][tickOut] = bnCal([
      this.approval[address][tickOut] || "0",
      "add",
      amountOut,
    ]);

    need(bn(this.pool[pair].lp).gte("0"), insufficient_amount);
    need(bn(this.pool[pair].amount0).gte("0"), insufficient_amount);
    need(bn(this.pool[pair].amount1).gte("0"), insufficient_amount);
    need(bn(this.approval[address][tickIn]).gte("0"), insufficient_amount);
    need(bn(this.approval[address][tickOut]).gte("0"), insufficient_amount);
  }

  dataRefer() {
    return {
      pool: this.pool,
      approval: this.approval,
      withdrawable: this.withdrawable,
      pendingApproval: this.pendingApproval,
      pendingWithdrawable: this.pendingWithdrawable,
    };
  }
}
