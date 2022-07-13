// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import {IFollowModule} from '../../interfaces/IFollowModule.sol';
import {ILensHub} from '../../interfaces/ILensHub.sol';
import {Errors} from '../../libraries/Errors.sol';
import {Events} from '../../libraries/Events.sol';
import {ModuleBase} from './ModuleBase.sol';
import {IERC721} from '@openzeppelin/contracts/token/ERC721/IERC721.sol';

/**
 * @title FollowValidationModuleBase
 * @author Lens Protocol
 *
 * @notice This abstract contract adds a simple non-specific follow validation function.
 *
 * NOTE: Both the `HUB` variable and `_checkFollowValidity()` function are exposed to inheriting
 * contracts.
 *
 * NOTE: This is only compatible with COLLECT & REFERENCE MODULES.
 */
abstract contract FollowValidationModuleBase is ModuleBase {
    /**
     * @notice Validates whether a given user is following a given profile.
     *
     * @dev It will revert if the user is not following the profile except the case when the user is the profile owner.
     *
     * @param profileId The ID of the profile that should be followed by the given user.
     * @param user The address of the user that should be following the given profile.
     */
    function _checkFollowValidity(uint256 profileId, address user) internal view {
        address followModule = ILensHub(HUB).getFollowModule(profileId);
        bool isFollowing;
        if (followModule != address(0)) {
            isFollowing = IFollowModule(followModule).isFollowing(profileId, user, 0);
        } else {
            address followNFT = ILensHub(HUB).getFollowNFT(profileId);
            isFollowing = followNFT != address(0) && IERC721(followNFT).balanceOf(user) != 0;
        }
        if (!isFollowing && IERC721(HUB).ownerOf(profileId) != user) {
            revert Errors.FollowInvalid();
        }
    }
}
