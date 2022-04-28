// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {IFollowModule} from '../../../interfaces/IFollowModule.sol';
import {ModuleBase} from '../ModuleBase.sol';
import {FollowValidatorFollowModuleBase} from './FollowValidatorFollowModuleBase.sol';
import {IERC721} from '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {Errors} from '../../../libraries/Errors.sol';

struct ProfileData {
    IERC721 nftToken; // Address of the NFT token
    EnumerableSet.UintSet whitelistNftIdSet;
}

struct ProfileDataView {
    IERC721 nftToken; // Address of the NFT token
    uint256[] whitelistNftIdSet;
}

/**
 * @title NftGatedFollowModule
 # @author Lens Protocol, WATCHPUG
 *
 * @notice A simple Lens FollowModule implementation, processes follows if the follower holds an NFT that is in a specified set. (etc Only Zombie Punks, or Bored Apes 15, 18, 20)
 */
contract NftGatedFollowModule is IFollowModule, FollowValidatorFollowModuleBase {
    using EnumerableSet for EnumerableSet.UintSet;

    // Map a profileId to ProfileData
    mapping(uint256 => ProfileData) internal _dataByProfile;

    constructor(address hub) ModuleBase(hub) {}

    /**
     * @notice Initializes the follow module
     *
     * @param data The arbitrary data parameter, decoded into:
     *      address nftToken: The NFT token address that will be needed for following.
     *      uint256[] whitelistNftIdSet: The whitelist id of NFT token to have for following.
     *
     * @return An abi encoded bytes parameter, which is the same as the passed data parameter.
     */
    function initializeFollowModule(uint256 profileId, bytes calldata data)
        external
        override
        onlyHub
        returns (bytes memory)
    {
        // decode
        (address nftToken, uint256[] memory whitelistNftIdSet) = abi.decode(data, (address, uint256[]));
        uint256 whitelistNftIdSetLength = whitelistNftIdSet.length;
        // validate
        if (nftToken == address(0) || whitelistNftIdSetLength == 0) revert Errors.InitParamsInvalid();
        // save
        ProfileData storage profileData = _dataByProfile[profileId];
        profileData.nftToken = IERC721(nftToken);
        for(uint256 i = 0; i < whitelistNftIdSetLength; ++i) {
            profileData.whitelistNftIdSet.add(whitelistNftIdSet[i]);
        }
        return data;
    }

    /**
     * @dev Processes a follow by:
     *  1. Checking if follower has NFT token in whitelist set by the profile creator
     */
    function processFollow(
        address follower,
        uint256 profileId,
        bytes calldata data
    ) external onlyHub {
        EnumerableSet.UintSet storage whitelistNftIdSet = _dataByProfile[profileId].whitelistNftIdSet;
        IERC721 nftToken = _dataByProfile[profileId].nftToken;
        uint256 whitelistNftIdSetLength = whitelistNftIdSet.length();

        for(uint256 i = 0; i < whitelistNftIdSetLength; ++i) {
            uint256 whitelistNftId = whitelistNftIdSet.at(i);

            try nftToken.ownerOf(whitelistNftId) returns (
                address ownerOfWhitelistNftId
            ) {
                if (follower == ownerOfWhitelistNftId) {
                    return;
                }
            } catch {
                // skip this NFT token id, check next NFT token id
            }
        }
        revert Errors.NotHaveWhitelistNftToken();
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
     * @return The ProfileDataView struct mapped to that profile.
     */
    function getProfileData(uint256 profileId) external view returns (ProfileDataView memory) {
        return ProfileDataView({
            nftToken: _dataByProfile[profileId].nftToken,
            whitelistNftIdSet: _dataByProfile[profileId].whitelistNftIdSet.values()
        });
    }
}
