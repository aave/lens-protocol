// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import {Errors} from '../../../libraries/Errors.sol';
import {ModuleBase} from '../ModuleBase.sol';
import {FollowValidatorFollowModuleBase} from './FollowValidatorFollowModuleBase.sol';

/**
 * @title RevertFollowModule
 * @author Lens Protocol
 *
 * @notice This follow module rejects all follow attempts.
 */
contract RevertFollowModule is FollowValidatorFollowModuleBase {
    constructor(address hub) ModuleBase(hub) {}

    /**
     * @notice This follow module works on custom profile owner approvals.
     *
     * @param profileId The profile ID of the profile to initialize this module for.
     * @param data The arbitrary data parameter, which in this particular module initialization will be just ignored.
     *
     * @return bytes Empty bytes.
     */
    function initializeFollowModule(uint256 profileId, bytes calldata data)
        external
        view
        override
        onlyHub
        returns (bytes memory)
    {
        return new bytes(0);
    }

    /**
     * @dev Processes a follow by rejecting it reverting the transaction.
     */
    function processFollow(
        address follower,
        uint256 profileId,
        bytes calldata data
    ) external view override onlyHub {
        revert Errors.FollowInvalid();
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
