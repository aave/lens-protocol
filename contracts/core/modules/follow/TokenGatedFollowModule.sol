// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {IFollowModule} from '../../../interfaces/IFollowModule.sol';
import {Errors} from '../../../libraries/Errors.sol';
import {ModuleBase} from '../ModuleBase.sol';
import {FollowValidatorFollowModuleBase} from './FollowValidatorFollowModuleBase.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/**
 * @title ApprovalFollowModule
 * @author defijesus.eth
 *
 * @notice This follow module only allows addresses that have a minimum balance of a specified ERC20 to follow.
 */
contract TokenGatedFollowModule is IFollowModule, FollowValidatorFollowModuleBase {

    IERC20 public immutable gateToken;
    uint256 public immutable minBalance;

    constructor(address hub, IERC20 _gateToken, uint256 _minBalance) ModuleBase(hub) {
      gateToken = _gateToken;
      minBalance = _minBalance;
    }

    /**
     * @dev Processes a follow by:
     *  1. Validating that the follower has the minimum ERC20 tokens required to follow
     */
    function processFollow(
        address follower,
        uint256 profileId,
        bytes calldata data
    ) external override onlyHub {
        if (gateToken.balanceOf(follower) < minBalance)
            revert Errors.NotEnoughTokens();
    }

    /**
     * @dev We don't need to execute any additional logic on transfers in this follow module.
     */
    function followModuleTransferHook(
        uint256 profileId,
        address from,
        address to,
        uint256 followNFTTokenId
    ) external override {}

}
