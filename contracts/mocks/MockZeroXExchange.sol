pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockZeroXExchange {

    function sellToUniswap(address[] calldata tokens, uint256 tokenAmount) external payable {
        require(tokens.length > 1, "tokens");
        IERC20 tokenToSell = IERC20(tokens[0]);
        IERC20 tokenToBuy = IERC20(tokens[1]);
        tokenToSell.transferFrom(msg.sender, address(this), tokenAmount);
        tokenToBuy.transfer(msg.sender, tokenAmount * 2);
    }

}