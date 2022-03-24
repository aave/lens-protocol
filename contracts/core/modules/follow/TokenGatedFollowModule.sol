// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {IFollowModule} from '../../../interfaces/IFollowModule.sol';
import {ModuleBase} from '../ModuleBase.sol';
import {FollowValidatorFollowModuleBase} from './FollowValidatorFollowModuleBase.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {Errors} from '../../../libraries/Errors.sol';

struct ProfileData {
    address currency; // Address of the token
    uint256 amount; // Amount of tokens needed to follow
}

/**
 * @title TokenGatedFollowModule
 * @author fl4C
 *
 * @notice A simple Lens FollowModule implementation, processes follows if the follower has the minimum amount of a token (set by the profile creator)
 */
contract TokenGatedFollowModule is IFollowModule, FollowValidatorFollowModuleBase {
    // Map a profileId to ProfileData
    mapping(uint256 => ProfileData) public _dataByProfile;

    constructor(address hub) ModuleBase(hub) {}

    /**
     * @notice Initializes the follow module
     *
     * @param data The arbitrary data parameter, decoded into:
     *      address currency: The currency address that will be needed for following.
     *      uint256 amount: The minimum amount of currency to have for following.
     *
     * @return An abi encoded bytes parameter, which is the same as the passed data parameter.
     */
    function initializeFollowModule(uint256 profileId, bytes calldata data)
        external
        override
        onlyHub
        returns (bytes memory)
    {
        (address currency, uint256 amount) = abi.decode(data, (address, uint256));
        if (currency == address(0) || amount == 0) revert Errors.InitParamsInvalid();
        _dataByProfile[profileId].currency = currency;
        _dataByProfile[profileId].amount = amount;
        return data;
    }

    /**
     * @dev Processes a follow by:
     *  1. Checking if follower has enough of a token set by the profile creator
     */
    function processFollow(
        address follower,
        uint256 profileId,
        bytes calldata data
    ) external onlyHub {
        address currency = _dataByProfile[profileId].currency;
        uint256 amount = _dataByProfile[profileId].amount;
        if (IERC20(currency).balanceOf(follower) < amount) revert Errors.NotEnoughTokens();
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

    /**
     * @notice Returns the profile data for a given profile, or an empty struct if that profile was not initialized
     * with this module.
     *
     * @param profileId The profile ID of the profile to query.
     *
     * @return The ProfileData struct mapped to that profile.
     */
    function getProfileData(uint256 profileId) external view returns (ProfileData memory) {
        return _dataByProfile[profileId];
    }
}
