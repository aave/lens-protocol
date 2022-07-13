// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import {ICollectModule} from '../../../interfaces/ICollectModule.sol';
import {Errors} from '../../../libraries/Errors.sol';

/**
 * @title RevertCollectModule
 * @author Lens Protocol
 *
 * @notice This is a simple Lens CollectModule implementation, inheriting from the ICollectModule interface.
 *
 * This module works by disallowing all collects.
 */
contract RevertCollectModule is ICollectModule {
    /**
     * @dev There is nothing needed at initialization.
     */
    function initializePublicationCollectModule(
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external pure override returns (bytes memory) {
        return new bytes(0);
    }

    /**
     * @dev Processes a collect by:
     *  1. Always reverting
     */
    function processCollect(
        uint256 referrerProfileId,
        address collector,
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external pure override {
        revert Errors.CollectNotAllowed();
    }
}
