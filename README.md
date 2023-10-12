# brc20-swap contract

The brc20-swap contract is primarily based on the reference implementation of Uniswap V2.

- [getAmountOut, getAmountIn](https://github.com/Uniswap/v2-periphery/blob/0335e8f7e1bd1e8d8329fd300aea2ef2f36dd19f/contracts/libraries/UniswapV2Library.sol#L43C15-L43C15)

- [addLiq](https://github.com/Uniswap/v2-core/blob/ee547b17853e71ed4e0101ccfd52e70d5acded58/contracts/UniswapV2Pair.sol#L110)

- [removeLiq](https://github.com/Uniswap/v2-core/blob/ee547b17853e71ed4e0101ccfd52e70d5acded58/contracts/UniswapV2Pair.sol#L134)

## install

```
yarn
```

## build

Once this step is complete, a 'contract.js' file will be generated in the 'build' directory, which can then be used to inscribe an inscription.

```
yarn build:contract
```

## test

```
yarn test
```
