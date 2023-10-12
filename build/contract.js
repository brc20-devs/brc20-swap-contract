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
  function getPairStruct(pair) {
      const tick0 = buffer.Buffer.from(pair).subarray(0, 4).toString();
      const tick1 = buffer.Buffer.from(pair).subarray(5).toString();
      need(sortTickParams({ tick0, tick1 }).tick0 == tick0);
      return { tick0, tick1 };
  }
  function need(condition, message) {
      if (!condition) {
          throw new Error(message || "server error");
      }
  }
  const invalid_amount$1 = "invalid amount";
  const invalid_slippage = "invalid slippage";
  function checkGtZero(amount) {
      need(bn(amount).gt("0") && bn(amount).isInteger(), invalid_amount$1);
  }
  function checkGteZero(amount) {
      need(bn(amount).gte("0") && bn(amount).isInteger(), invalid_amount$1);
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

  const invalid_amount = "invalid amount";
  const insufficient_amount = "insufficient amount";
  const pool_not_found = "pool not found";
  class Assets {
      constructor(assets) {
          this.pool = assets.pool;
          this.approval = assets.approval;
          this.withdrawable = assets.withdrawable;
          this.pendingApproval = assets.pendingApproval;
          this.pendingWithdrawable = assets.pendingWithdrawable;
      }
      checkPool(pair) {
          need(!!this.pool[pair], pool_not_found);
      }
      getBalance(address, assetType, tick) {
          var _a;
          return ((_a = this[assetType][address]) === null || _a === void 0 ? void 0 : _a[tick]) || "0";
      }
      mintTick(address, tick, amount) {
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
      mintLp(address, pair, lp, amount0, amount1) {
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
      burnLp(address, pair, lp, amount0, amount1) {
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
      convert(address, tick, amount, fromAssetType, toAssetType) {
          var _a;
          need(bn(amount).gt("0"), invalid_amount);
          need(bn((_a = this[fromAssetType][address]) === null || _a === void 0 ? void 0 : _a[tick]).gte(amount), insufficient_amount);
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
      transfer(from, to, tick, amount) {
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
      swap(address, tickIn, tickOut, amountIn, amountOut) {
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
          }
          else {
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

  const exceeding_slippage = "exceeding slippage";
  const pool_existed = "pool existed";
  const duplicate_tick = "duplicate tick";
  const insufficient_liquidity = "insufficient liquidity for this trade";
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
          need(!this.assets.pool[pair], pool_existed);
          this.assets.pool[pair] = { amount0: "0", amount1: "0", lp: "0" };
          return {};
      }
      addLiq(params) {
          const { tick0, tick1, amount0, amount1, expect, slippage1000 } = sortTickParams(params);
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
              const firstLP = bnCal([lp, "sub", "1000"]);
              this.assets.mintLp(address, pair, firstLP, amount0, amount1);
              this.assets.mintLp("0", pair, "1000");
              need(bn(firstLP).gte(bnCal([
                  expect,
                  "mul",
                  bnCal(["1000", "sub", slippage1000]),
                  "div",
                  "1000",
              ])), exceeding_slippage);
              if (this.config.platformFeeOn) {
                  this.status.kLast[pair] = bnCal([pool.amount0, "mul", pool.amount1]);
              }
              return { lp: firstLP, amount0, amount1 };
          }
          else {
              const lp0 = bnCal([amount0, "mul", pool.lp, "div", pool.amount0]);
              const lp1 = bnCal([amount1, "mul", pool.lp, "div", pool.amount1]);
              let lp;
              let amount0Adjust;
              let amount1Adjust;
              if (bn(lp0).lt(lp1)) {
                  amount0Adjust = amount0;
                  amount1Adjust = bnCal([lp0, "mul", pool.amount1, "div", pool.lp]);
                  lp = lp0;
              }
              else {
                  amount0Adjust = bnCal([lp1, "mul", pool.amount0, "div", pool.lp]);
                  amount1Adjust = amount1;
                  lp = lp1;
              }
              this.assets.mintLp(address, pair, lp, amount0Adjust, amount1Adjust);
              need(bn(lp).gte(bnCal([
                  expect,
                  "mul",
                  bnCal(["1000", "sub", slippage1000]),
                  "div",
                  "1000",
              ])), exceeding_slippage);
              need(amount1Adjust == amount1 || amount0Adjust == amount0);
              if (this.config.platformFeeOn) {
                  this.status.kLast[pair] = bnCal([pool.amount0, "mul", pool.amount1]);
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
          const pool = this.assets.pool[pair];
          const poolLp = pool.lp;
          const reserve0 = pool.amount0;
          const reserve1 = pool.amount1;
          const acquire0 = bnCal([lp, "mul", reserve0, "div", poolLp]);
          const acquire1 = bnCal([lp, "mul", reserve1, "div", poolLp]);
          this.assets.burnLp(address, pair, lp, acquire0, acquire1);
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
              this.status.kLast[pair] = bnCal([pool.amount0, "mul", pool.amount1]);
          }
          return { tick0, tick1, amount0: acquire0, amount1: acquire1 };
      }
      swap(params) {
          const { tick0, tick1, address, tick, exactType, expect, slippage1000, amount, } = sortTickParams(params);
          checkGteZero(expect);
          checkSlippage(slippage1000);
          const pair = getPairStr(tick0, tick1);
          const pool = this.assets.pool[pair];
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
                  reserveIn = pool.amount0;
                  reserveOut = pool.amount1;
                  tickIn = tick0;
                  tickOut = tick1;
              }
              else {
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
          }
          else {
              amountOut = amount;
              if (tick == tick0) {
                  reserveIn = pool.amount1;
                  reserveOut = pool.amount0;
                  tickIn = tick1;
                  tickOut = tick0;
              }
              else {
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
          this.assets.transfer(from, to, tick, amount);
          return {};
      }
      mintFee(params) {
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
          }
          else {
              this.status.kLast[pair] = "0";
          }
      }
  }

  exports.Contract = Contract;

}));
