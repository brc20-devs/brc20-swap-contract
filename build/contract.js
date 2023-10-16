(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('bignumber.js')) :
  typeof define === 'function' && define.amd ? define(['exports', 'bignumber.js'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Contract = {}, global.BigNumber));
})(this, (function (exports, BigNumber) { 'use strict';

  var ExactType;
  (function (ExactType) {
      ExactType["exactIn"] = "exactIn";
      ExactType["exactOut"] = "exactOut";
  })(ExactType || (ExactType = {}));
  var FuncType;
  (function (FuncType) {
      FuncType["deployPool"] = "deployPool";
      FuncType["addLiq"] = "addLiq";
      FuncType["swap"] = "swap";
      FuncType["removeLiq"] = "removeLiq";
  })(FuncType || (FuncType = {}));

  function sortTickParams(params) {
      if (params.tick0 < params.tick1) {
          return params;
      }
      else {
          const ret = Object.assign(Object.assign({}, params), { tick0: params.tick1, tick1: params.tick0, amount0: params.amount1, amount1: params.amount0 });
          return ret;
      }
  }
  function getPairStr(tick0, tick1) {
      const params = sortTickParams({ tick0, tick1 });
      return `${params.tick0}/${params.tick1}`;
  }
  function need(condition, message) {
      if (!condition) {
          throw new Error(message || "server error");
      }
  }
  const invalid_amount = "invalid amount";
  const invalid_slippage = "invalid slippage";
  function checkGtZero(amount) {
      need(bn(amount).gt("0") && bn(amount).isInteger(), invalid_amount);
  }
  function checkGteZero(amount) {
      need(bn(amount).gte("0") && bn(amount).isInteger(), invalid_amount);
  }
  function checkSlippage(slippage) {
      need(bn(slippage).gte("0"), invalid_slippage);
      need(bn(slippage).lte("1000"), invalid_slippage);
      need(bn(slippage).isInteger(), invalid_slippage);
  }

  const bn = BigNumber;
  bn.config({
      EXPONENTIAL_AT: 1e9,
      DECIMAL_PLACES: 0,
      ROUNDING_MODE: bn.ROUND_DOWN,
  });
  function bnCal(items, decimalPlaces) {
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
          }
          else if (cur == "sub") {
              need(_bn(next).gte("0"));
              ret = ret.minus(next);
              i++;
          }
          else if (cur == "mul") {
              need(_bn(next).gte("0"));
              ret = ret.times(next);
              i++;
          }
          else if (cur == "div") {
              need(_bn(next).gte("0"));
              ret = ret.div(next);
              i++;
          }
          else if (cur == "pow") {
              need(_bn(next).gte("0"));
              ret = ret.pow(next);
              i++;
          }
          else if (cur == "sqrt") {
              ret = ret.sqrt();
          }
          else if (!_bn(cur).isNaN()) {
              need(_bn(next).isNaN());
          }
      }
      if (decimalPlaces) {
          return ret.decimalPlaces(parseInt(decimalPlaces)).toString();
      }
      else {
          return ret.toString();
      }
  }

  class Brc20 {
      constructor(balance, tick) {
          this.balance = {};
          this.balance = balance;
          this.tick = tick;
          this._supply = "0";
          for (const address in this.balance) {
              this._supply = bnCal([this._supply, "add", this.balance[address]]);
          }
      }
      get supply() {
          return this._supply;
      }
      balanceOf(address) {
          return this.balance[address] || "0";
      }
      transfer(from, to, amount) {
          this.checkAmount(amount);
          this.balance[from] = bnCal([this.balance[from], "sub", amount]);
          this.balance[to] = bnCal([this.balance[to] || "0", "add", amount]);
          this.checkAddress(from);
          this.checkAddress(to);
      }
      mint(address, amount) {
          this.checkAmount(amount);
          this.balance[address] = bnCal([
              this.balance[address] || "0",
              "add",
              amount,
          ]);
          this._supply = bnCal([this._supply, "add", amount]);
          this.checkAddress(address);
      }
      burn(address, amount) {
          this.checkAmount(amount);
          this.balance[address] = bnCal([
              this.balance[address] || "0",
              "sub",
              amount,
          ]);
          this._supply = bnCal([this._supply, "sub", amount]);
          this.checkAddress(address);
      }
      checkAmount(amount) {
          need(bn(amount).gt("0"), "invalid amount");
      }
      checkAddress(address) {
          need(bn(this.balance[address]).gte("0"), "insufficient amount");
      }
  }

  class Assets {
      constructor(map) {
          this.map = {};
          for (const assetType in map) {
              for (const tick in map[assetType]) {
                  const brc20 = new Brc20(map[assetType][tick].balance, map[assetType][tick].tick);
                  map[assetType][tick] = brc20;
              }
          }
          this.map = map;
      }
      traverseTick(assetType, cb) {
          for (const tick in this.map[assetType]) {
              const brc20 = this.map[assetType][tick];
              cb(brc20);
          }
      }
      tryCreate(tick) {
          for (let assetType in this.map) {
              if (!this.map[assetType][tick]) {
                  this.map[assetType][tick] = new Brc20({}, tick);
              }
          }
      }
      isExist(tick) {
          return !!this.map["swap"][tick];
      }
      get(tick, assetType = "swap") {
          return this.map[assetType][tick];
      }
      getBalance(address, tick, assetType = "swap") {
          return this.map[assetType][tick].balanceOf(address);
      }
      mint(address, tick, amount, assetType = "swap") {
          this.tryCreate(tick);
          this.map[assetType][tick].mint(address, amount);
      }
      burn(address, tick, amount, assetType = "swap") {
          this.map[assetType][tick].burn(address, amount);
      }
      convert(address, tick, amount, fromAssetType, toAssetType) {
          this.map[fromAssetType][tick].burn(address, amount);
          this.map[toAssetType][tick].mint(address, amount);
      }
      transfer(tick, from, to, amount, fromAssetType, toAssetType) {
          this.map[fromAssetType][tick].burn(from, amount);
          this.map[toAssetType][tick].mint(to, amount);
      }
      swap(address, tickIn, tickOut, amountIn, amountOut, assetType = "swap") {
          const pair = getPairStr(tickIn, tickOut);
          this.map[assetType][tickIn].transfer(address, pair, amountIn);
          this.map[assetType][tickOut].transfer(pair, address, amountOut);
      }
      dataRefer() {
          return this.map;
      }
  }

  const exceeding_slippage = "exceeding slippage";
  const duplicate_tick = "duplicate tick";
  const insufficient_liquidity = "insufficient liquidity for this trade";
  const pool_existed = "pool existed";
  const pool_not_found = "pool not found";
  class Contract {
      constructor(assets, status, config) {
          if (!(assets instanceof Assets)) {
              assets = new Assets(assets);
          }
          this.assets = assets;
          this.status = status;
          this.config = config;
      }
      deployPool(params) {
          need(params.tick0 !== params.tick1, duplicate_tick);
          const pair = getPairStr(params.tick0, params.tick1);
          need(!this.assets.isExist(pair), pool_existed);
          this.assets.tryCreate(pair);
          return {};
      }
      addLiq(params) {
          const { tick0, tick1, amount0, amount1, expect, slippage1000 } = sortTickParams(params);
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
              const firstLP = bnCal([lp, "sub", "1000"]);
              this.assets.get(pair).mint(address, firstLP);
              this.assets.get(pair).mint("0", "1000");
              this.assets.get(tick0).transfer(address, pair, amount0);
              this.assets.get(tick1).transfer(address, pair, amount1);
              checkGtZero(firstLP);
              need(bn(firstLP).gte(bnCal([
                  expect,
                  "mul",
                  bnCal(["1000", "sub", slippage1000]),
                  "div",
                  "1000",
              ])), exceeding_slippage);
              if (this.config.platformFeeOn) {
                  this.status.kLast[pair] = bnCal([
                      this.assets.get(tick0).balanceOf(pair),
                      "mul",
                      this.assets.get(tick1).balanceOf(pair),
                  ]);
              }
              return { lp: firstLP, amount0, amount1 };
          }
          else {
              let amount0Adjust;
              let amount1Adjust;
              const poolLp = this.assets.get(pair).supply;
              const poolAmount0 = this.assets.get(tick0).balanceOf(pair);
              const poolAmount1 = this.assets.get(tick1).balanceOf(pair);
              amount1Adjust = bnCal([amount0, "mul", poolAmount1, "div", poolAmount0]);
              if (bn(amount1Adjust).lte(amount1)) {
                  amount0Adjust = amount0;
              }
              else {
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
              need(bn(lp).gte(bnCal([
                  expect,
                  "mul",
                  bnCal(["1000", "sub", slippage1000]),
                  "div",
                  "1000",
              ])), exceeding_slippage);
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
      removeLiq(params) {
          const { address, lp, tick0, tick1, amount0, amount1, slippage1000 } = sortTickParams(params);
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
          need(bn(acquire0).gte(bnCal([
              amount0,
              "mul",
              bnCal(["1000", "sub", slippage1000]),
              "div",
              "1000",
          ])), exceeding_slippage);
          need(bn(acquire1).gte(bnCal([
              amount1,
              "mul",
              bnCal(["1000", "sub", slippage1000]),
              "div",
              "1000",
          ])), exceeding_slippage);
          if (this.config.platformFeeOn) {
              this.status.kLast[pair] = bnCal([
                  this.assets.get(tick0).balanceOf(pair),
                  "mul",
                  this.assets.get(tick1).balanceOf(pair),
              ]);
          }
          return { tick0, tick1, amount0: acquire0, amount1: acquire1 };
      }
      swap(params) {
          const { tick0, tick1, address, tick, exactType, expect, slippage1000, amount, } = sortTickParams(params);
          checkGteZero(expect);
          checkSlippage(slippage1000);
          const pair = getPairStr(tick0, tick1);
          let amountIn;
          let amountOut;
          let reserveIn;
          let reserveOut;
          let tickIn;
          let tickOut;
          let ret;
          if (exactType == ExactType.exactIn) {
              amountIn = amount;
              if (tick == tick0) {
                  (reserveIn = this.assets.get(tick0).balanceOf(pair)),
                      (reserveOut = this.assets.get(tick1).balanceOf(pair)),
                      (tickIn = tick0);
                  tickOut = tick1;
              }
              else {
                  (reserveIn = this.assets.get(tick1).balanceOf(pair)),
                      (reserveOut = this.assets.get(tick0).balanceOf(pair)),
                      (tickIn = tick1);
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
          }
          else {
              amountOut = amount;
              if (tick == tick0) {
                  reserveIn = this.assets.get(tick1).balanceOf(pair);
                  reserveOut = this.assets.get(tick0).balanceOf(pair);
                  tickIn = tick1;
                  tickOut = tick0;
              }
              else {
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
      getAmountOut(params) {
          const { amountIn, reserveIn, reserveOut } = params;
          checkGtZero(amountIn);
          need(bn(reserveIn).gt("0") && bn(reserveOut).gt("0"), insufficient_liquidity);
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
      getAmountIn(params) {
          const { amountOut, reserveIn, reserveOut } = params;
          checkGtZero(amountOut);
          need(bn(reserveIn).gt("0") && bn(reserveOut).gt("0"), insufficient_liquidity);
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
      send(params) {
          const { from, to, tick, amount } = params;
          this.assets.get(tick).transfer(from, to, amount);
          return {};
      }
      mintFee(params) {
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
          }
          else {
              this.status.kLast[pair] = "0";
          }
      }
  }

  exports.Contract = Contract;

}));
