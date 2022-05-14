// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {IERC20Burnable} from '../interfaces/IERC20Burnable.sol';

contract MockKlimaRetirementAggregator {

    function retireCarbonFrom (
        address _recipient,
        address _sourceToken,
        address _poolToken,
        uint256 _amount,
        bool _amountInCarbon,
        address _beneficiaryAddress,
        string memory _beneficiaryString,
        string memory _retirementMessage
    ) external {
        // The actual contract would swap for and properly retire BCT
        IERC20Burnable(_sourceToken).burnFrom(address(this), _amount);
    }
}
