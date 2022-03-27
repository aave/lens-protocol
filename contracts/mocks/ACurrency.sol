// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract ACurrency is ERC20('ACurrency', 'aCRNC') {
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
