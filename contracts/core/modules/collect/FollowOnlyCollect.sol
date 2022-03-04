// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {LimitedFeeCollectModule, ProfilePublicationData} from './LimitedFeeCollectModule.sol';
import {ICollectModule} from '../../../interfaces/ICollectModule.sol';
import {ILensHub} from '../../../interfaces/ILensHub.sol';
import {Errors} from '../../../libraries/Errors.sol';
import {IERC721} from '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import "hardhat/console.sol";

contract FollowOnlyCollect is LimitedFeeCollectModule {
    constructor(address hub, address moduleGlobals) LimitedFeeCollectModule(hub, moduleGlobals) {}

    /**
     * @param data The arbitrary data parameter, decoded into:
     *    uint256 profile: Additional profile collector has to follow.
     *    uint256 maxID: Maximum ID of follower id allowed for collector w.r.t additional profile. 
     *
     * @dev Processes a collect by:
     *  1. Ensuring the collector is a follower
     *  2. 
     *  2. Ensuring the collect does not pass the collect limit
     *  3. Charging a fee
     */
    function processCollect(
        uint256 referrerProfileId,
        address collector,
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external override onlyHub {
        (,, uint256 profile, uint256 maxID) = abi.decode(
            data,
            (address, uint256, uint256, uint256)
        );
        _checkFollowValidity(profileId, collector);
        _checkFollowValidityLimit(profile, collector, maxID);

        if (
            _dataByPublicationByProfile[profileId][pubId].currentCollects >=
            _dataByPublicationByProfile[profileId][pubId].collectLimit
        ) {
            revert Errors.MintLimitExceeded();
        } else {
            _dataByPublicationByProfile[profileId][pubId].currentCollects++;
            if (referrerProfileId == profileId) {
                _processCollect(collector, profileId, pubId, data);
            } else {
                _processCollectWithReferral(referrerProfileId, collector, profileId, pubId, data);
            }
        }
    }

    function _checkFollowValidityLimit(
        uint256 profileId,
        address collector,
        uint256 maxID
    ) private {
        address followNFT = ILensHub(HUB).getFollowNFT(profileId);
        if (followNFT == address(0)) revert Errors.FollowInvalid();
        uint256 followCount = IERC721(followNFT).balanceOf(collector);
        if (followCount == 0) revert Errors.FollowInvalid();
        if (followCount > maxID) revert Errors.NotInFollowerLimit();
    }
}