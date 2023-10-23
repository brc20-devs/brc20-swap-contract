import { Balance, Pool } from "./types";
import { bn, uintCal } from "./bn";
import { getPairStr, getPairStruct, need } from "./contract-utils";

import { Brc20 } from "./brc20";

type AssetType =
  // swap
  | "swap"
  | "pendingSwap"
  // module
  | "available"
  | "pendingAvailable"
  | "approve"
  | "conditionalApprove";

export class Assets {
  // assetType --> tick --> brc20
  private map: { [key: string]: { [key: string]: Brc20 } } = {};

  constructor(map: {
    [key: string]: { [key: string]: { balance: any; tick: string } };
  }) {
    for (const assetType in map) {
      for (const tick in map[assetType]) {
        const brc20 = new Brc20(
          map[assetType][tick].balance,
          map[assetType][tick].tick
        );
        map[assetType][tick] = brc20;
      }
    }
    this.map = map as any;
  }

  traverseTick(assetType: AssetType, cb: (brc20: Brc20) => void) {
    for (const tick in this.map[assetType]) {
      const brc20 = this.map[assetType][tick];
      cb(brc20);
    }
  }

  tryCreate(tick: string) {
    for (let assetType in this.map) {
      if (!this.map[assetType][tick]) {
        this.map[assetType][tick] = new Brc20({}, tick);
      }
    }
  }

  isExist(tick: string) {
    return !!this.map["swap"][tick];
  }

  get(tick: string, assetType: AssetType = "swap") {
    return this.map[assetType][tick];
  }

  getBalance(
    address: string,
    tick: string,
    assetType: AssetType = "swap"
  ): string {
    try {
      need(!!this.map[assetType][tick]);
      return this.map[assetType][tick].balanceOf(address);
    } catch (err) {
      return "0";
    }
  }

  getAggregateBalance(
    address: string,
    tick: string,
    assetTypes: AssetType[]
  ): string {
    let ret = "0";
    assetTypes.forEach((assetType) => {
      ret = uintCal([ret, "add", this.getBalance(address, tick, assetType)]);
    });
    return ret;
  }

  mint(
    address: string,
    tick: string,
    amount: string,
    assetType: AssetType = "swap"
  ) {
    this.tryCreate(tick);
    this.map[assetType][tick].mint(address, amount);
  }

  burn(
    address: string,
    tick: string,
    amount: string,
    assetType: AssetType = "swap"
  ) {
    this.map[assetType][tick].burn(address, amount);
  }

  convert(
    address: string,
    tick: string,
    amount: string,
    fromAssetType: AssetType,
    toAssetType: AssetType
  ) {
    this.map[fromAssetType][tick].burn(address, amount);
    this.map[toAssetType][tick].mint(address, amount);
  }

  transfer(
    tick: string,
    from: string,
    to: string,
    amount: string,
    fromAssetType: AssetType,
    toAssetType: AssetType
  ) {
    this.map[fromAssetType][tick].burn(from, amount);
    this.map[toAssetType][tick].mint(to, amount);
  }

  swap(
    address: string,
    tickIn: string,
    tickOut: string,
    amountIn: string,
    amountOut: string,
    assetType: AssetType = "swap"
  ) {
    const pair = getPairStr(tickIn, tickOut);
    this.map[assetType][tickIn].transfer(address, pair, amountIn);
    this.map[assetType][tickOut].transfer(pair, address, amountOut);
  }

  dataRefer() {
    return this.map;
  }
}
