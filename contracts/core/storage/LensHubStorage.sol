// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import {DataTypes} from '../../libraries/DataTypes.sol';

/**
 * @title LensHubStorage
 * @author Lens Protocol
 *
 * @notice This is an abstract contract that *only* contains storage for the LensHub contract. This
 * *must* be inherited last (bar interfaces) in order to preserve the LensHub storage layout. Adding
 * storage variables should be done solely at the bottom of this contract.
 */
abstract contract LensHubStorage {
    mapping(address => bool) internal _profileCreatorWhitelisted;       // Slot 13
    mapping(address => bool) internal _followModuleWhitelisted;         // Slot 14
    mapping(address => bool) internal _collectModuleWhitelisted;        // Slot 15
    mapping(address => bool) internal _referenceModuleWhitelisted;      // Slot 16

    mapping(uint256 => address) internal _dispatcherByProfile;          // slot 17
    mapping(bytes32 => uint256) internal _profileIdByHandleHash;        // slot 18
    mapping(uint256 => DataTypes.ProfileStruct) internal _profileById;  // slot 19
    mapping(uint256 => mapping(uint256 => DataTypes.PublicationStruct)) internal _pubByIdByProfile;  // slot 20

    mapping(address => uint256) internal _defaultProfileByAddress;      // slot 21

    uint256 internal _profileCounter;                                   // slot 22
    address internal _governance;                                       // slot 23
    address internal _emergencyAdmin;                                   // slot 24
}
