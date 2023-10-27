export enum ExactType {
  exactIn = "exactIn",
  exactOut = "exactOut",
}

export enum FuncType {
  deployPool = "deployPool",
  addLiq = "addLiq",
  swap = "swap",
  removeLiq = "removeLiq",
}

export type DeployPoolParams = [string /** ordi */, string /** sats */];

export type DeployPoolIn = {
  address: string;
  tick0: string;
  tick1: string;
};

export type DeployPoolOut = {};

export type AddLiqParams = [
  string /** orid/sats */,
  string /** 100 */,
  string /** 200 */,
  string /** 10 */,
  string /** 0.005 */
];

export type AddLiqIn = {
  address: string;
  tick0: string;
  tick1: string;
  amount0: string;
  amount1: string;
  expect: string;
  slippage1000: string;
};

export type AddLiqOut = {
  lp: string;
  amount0: string;
  amount1: string;
};

export type RemoveLiqParams = [
  string /** orid/sats */,
  string /** 100 */,
  string /** 1.34 */,
  string /** 12.34 */,
  string /** 0.005 */
];

export type RemoveLiqIn = {
  address: string;
  lp: string;
  tick0: string;
  tick1: string;
  amount0: string;
  amount1: string;
  slippage1000: string;
};

export type RemoveLiqOut = {
  tick0: string;
  tick1: string;
  amount0: string;
  amount1: string;
};

export type SwapParams = [
  string /** ordi/sats */,
  string /** ordi */,
  string /** 100 */,
  string /** exactIn */,
  string /** 12.34 */,
  string /** 0.005 */
];

export type SwapIn = {
  address: string;
  tickIn: string;
  tickOut: string;
  amount: string;
  exactType: ExactType;
  expect: string;
  slippage1000: string;
};

export type SwapOut = {
  amount: string;
};

export type MintFeeIn = {
  tick0: string;
  tick1: string;
};

export type ApproveIn = {
  address: string;
  tick: string;
  amount: string;
};

export type ApproveOut = {};

export type AmountInputIn = {
  amountIn: string;
  reserveIn: string;
  reserveOut: string;
};

export type AmountOutputIn = {
  amountOut: string;
  reserveIn: string;
  reserveOut: string;
};

export type SendIn = {
  from: string;
  to: string;
  tick: string;
  amount: string;
};

export type SendOut = {};

export type FuncArr =
  | {
      func: FuncType.deployPool;
      params: DeployPoolParams;
    }
  | {
      func: FuncType.addLiq;
      params: AddLiqParams;
    }
  | {
      func: FuncType.swap;
      params: SwapParams;
    }
  | {
      func: FuncType.removeLiq;
      params: RemoveLiqParams;
    };

export type FuncMap =
  | {
      func: FuncType.deployPool;
      params: DeployPoolIn;
    }
  | {
      func: FuncType.addLiq;
      params: AddLiqIn;
    }
  | {
      func: FuncType.swap;
      params: SwapIn;
    }
  | {
      func: FuncType.removeLiq;
      params: RemoveLiqIn;
    };

export type ContractResult =
  | {
      func: FuncType.deployPool;
      out: DeployPoolOut;
      preResult: Result;
      result: Result;
    }
  | {
      func: FuncType.addLiq;
      out: AddLiqOut;
      preResult: Result;
      result: Result;
    }
  | {
      func: FuncType.swap;
      out: SwapOut;
      preResult: Result;
      result: Result;
    }
  | {
      func: FuncType.removeLiq;
      out: RemoveLiqOut;
      preResult: Result;
      result: Result;
    };

export type Result = {
  user?: {
    address: string;
    tick: string;
    balance: string;
  }[];
  pool?: {
    pair: string;
    amount0: string;
    amount1: string;
    lp: string;
  }[];
};

export type InternalFunc =
  | {
      id: string;
      func: FuncType.deployPool;
      params: DeployPoolIn;
      prevs: string[];
      ts: number;
      sig: string;
    }
  | {
      id: string;
      func: FuncType.addLiq;
      params: AddLiqIn;
      prevs: string[];
      ts: number;
      sig: string;
    }
  | {
      id: string;
      func: FuncType.swap;
      params: SwapIn;
      prevs: string[];
      ts: number;
      sig: string;
    }
  | {
      id: string;
      func: FuncType.removeLiq;
      params: RemoveLiqIn;
      prevs: string[];
      ts: number;
      sig: string;
    };

export type ContractStatus = {
  kLast: {
    [key: string]: string;
  };
};

export type ContractConfig = {
  feeTo: string;
  swapFeeRate1000: string; // eg. 30(=0.3%)
};

export type Balance = { [key: string]: { [key: string]: string } }; // addr -> tick -> amount

export type Pool = {
  [key: string]: { amount0: string; amount1: string; lp: string };
}; // pair -> { amount0, amount1, lp }

export type Pair = {
  tick0: string;
  tick1: string;
};
