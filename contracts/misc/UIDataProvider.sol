// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import {ILensHub} from '../interfaces/ILensHub.sol';
import {DataTypes} from '../libraries/DataTypes.sol';

/**
 * @dev This struct contains both a `ProfileStruct` and a `PublicationStruct`.
 *
 * @param profileStruct A standard profile struct.
 * @param publicationStruct A standard publicationStruct.
 */
struct LatestData {
    DataTypes.ProfileStruct profileStruct;
    DataTypes.PublicationStruct publicationStruct;
}

/**
 * @title UIDataProvider
 * @author Lens Protocol
 *
 * @dev This is a helper contract to fetch a profile and its latest publication in a single call.
 */
contract UIDataProvider {
    ILensHub immutable HUB;

    constructor(ILensHub hub) {
        HUB = hub;
    }

    /**
     * @notice Returns the profile struct and latest publication struct associated with the passed
     * profile ID.
     *
     * @param profileId The profile ID to query.
     *
     * @return LensData A struct containing the `ProfileStruct` and the `PublicationStruct` queried.
     */
    function getLatestDataByProfile(uint256 profileId) external view returns (LatestData memory) {
        DataTypes.ProfileStruct memory profileStruct = HUB.getProfile(profileId);
        uint256 pubCount = profileStruct.pubCount;
        return LatestData(profileStruct, HUB.getPub(profileId, pubCount));
    }

    /**
     * @notice Returns the profile struct and latest publication struct associated with the passed
     * profile ID.
     *
     * @param handle The handle to query.
     *
     * @return LensData A struct containing the `ProfileStruct` and the `PublicationStruct` queried.
     */
    function getLatestDataByHandle(string memory handle) external view returns (LatestData memory) {
        uint256 profileId = HUB.getProfileIdByHandle(handle);
        DataTypes.ProfileStruct memory profileStruct = HUB.getProfile(profileId);
        uint256 pubCount = profileStruct.pubCount;
        return LatestData(profileStruct, HUB.getPub(profileId, pubCount));
    }
}
