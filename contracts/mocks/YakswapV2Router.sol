// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

// Used by the ReFiCollectModule
contract YakswapV2Router {

    // just changes 1:1
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        require(amountOutMin <= amountIn, "Can't give you amountOutMin");
        require(block.timestamp <= deadline, "deadline has passed");

        address fromToken = path[0];
        address toToken = path[1];

        IERC20(fromToken).transferFrom(msg.sender, address(this), amountIn);
        IERC20(toToken).transfer(to, amountIn);

        uint[] memory amounts = new uint[](2);
        amounts[0] = amountIn;
        amounts[1] = amountIn;
        return amounts;
    }
}
