// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IAToken {
    function mint(address to, uint256 amount) external;
}

contract MockLendingPool {
    address[] public reserves;
    address public aTokenAddress;

    constructor(
        address _reserve,
        address _aTokenAddress)
    {
        reserves.push(_reserve);
        aTokenAddress = _aTokenAddress;
    }

    function getReservesList() external view returns (address[] memory) {
        return reserves;
    }

    function deposit(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external {
        IERC20(asset).transferFrom(msg.sender, aTokenAddress, amount);

        IAToken(aTokenAddress).mint(onBehalfOf, amount);
    }
}
