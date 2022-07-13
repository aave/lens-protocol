// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import {IFollowModule} from '../../../interfaces/IFollowModule.sol';
import {Errors} from '../../../libraries/Errors.sol';
import {Events} from '../../../libraries/Events.sol';
import {ModuleBase} from '../ModuleBase.sol';
import {FollowValidatorFollowModuleBase} from './FollowValidatorFollowModuleBase.sol';
import {IERC721} from '@openzeppelin/contracts/token/ERC721/IERC721.sol';

/**
 * @title ApprovalFollowModule
 * @author Lens Protocol
 *
 * @notice This follow module only allows addresses that are approved for a profile by the profile owner to follow.
 */
contract ApprovalFollowModule is FollowValidatorFollowModuleBase {
    // We use a triple nested mapping so that, on profile transfer, the previous approved address list is invalid;
    mapping(address => mapping(uint256 => mapping(address => bool)))
        internal _approvedByProfileByOwner;

    constructor(address hub) ModuleBase(hub) {}

    /**
     * @notice A custom function that allows profile owners to customize approved addresses.
     *
     * @param profileId The profile ID to approve/disapprove follower addresses for.
     * @param addresses The addresses to approve/disapprove for following the profile.
     * @param toApprove Whether to approve or disapprove the addresses for following the profile.
     */
    function approve(
        uint256 profileId,
        address[] calldata addresses,
        bool[] calldata toApprove
    ) external {
        if (addresses.length != toApprove.length) revert Errors.InitParamsInvalid();
        address owner = IERC721(HUB).ownerOf(profileId);
        if (msg.sender != owner) revert Errors.NotProfileOwner();

        uint256 addressesLength = addresses.length;
        for (uint256 i = 0; i < addressesLength; ) {
            _approvedByProfileByOwner[owner][profileId][addresses[i]] = toApprove[i];
            unchecked {
                ++i;
            }
        }

        emit Events.FollowsApproved(owner, profileId, addresses, toApprove, block.timestamp);
    }

    /**
     * @notice This follow module works on custom profile owner approvals.
     *
     * @param profileId The profile ID of the profile to initialize this module for.
     * @param data The arbitrary data parameter, decoded into:
     *      address[] addresses: The array of addresses to approve initially.
     *
     * @return bytes An abi encoded bytes parameter, which is the same as the passed data parameter.
     */
    function initializeFollowModule(uint256 profileId, bytes calldata data)
        external
        override
        onlyHub
        returns (bytes memory)
    {
        address owner = IERC721(HUB).ownerOf(profileId);

        if (data.length > 0) {
            address[] memory addresses = abi.decode(data, (address[]));
            uint256 addressesLength = addresses.length;
            for (uint256 i = 0; i < addressesLength; ) {
                _approvedByProfileByOwner[owner][profileId][addresses[i]] = true;
                unchecked {
                    ++i;
                }
            }
        }
        return data;
    }

    /**
     * @dev Processes a follow by:
     *  1. Validating that the follower has been approved for that profile by the profile owner
     */
    function processFollow(
        address follower,
        uint256 profileId,
        bytes calldata data
    ) external override onlyHub {
        address owner = IERC721(HUB).ownerOf(profileId);
        if (!_approvedByProfileByOwner[owner][profileId][follower])
            revert Errors.FollowNotApproved();
        _approvedByProfileByOwner[owner][profileId][follower] = false; // prevents repeat follows
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
     * @notice Returns whether the given address is approved for the profile owned by a given address.
     *
     * @param profileOwner The profile owner of the profile to query the approval with.
     * @param profileId The token ID of the profile to query approval with.
     * @param toCheck The address to query approval for.
     *
     * @return bool True if the address is approved and false otherwise.
     */
    function isApproved(
        address profileOwner,
        uint256 profileId,
        address toCheck
    ) external view returns (bool) {
        return _approvedByProfileByOwner[profileOwner][profileId][toCheck];
    }

    /**
     * @notice Returns whether the given addresses are approved for the profile owned by a given address.
     *
     * @param profileOwner The profile owner of the profile to query the approvals with.
     * @param profileId The token ID of the profile to query approvals with.
     * @param toCheck The address array to query approvals for.
     *
     * @return bool[] true if the address at the specified index is approved and false otherwise.
     */
    function isApprovedArray(
        address profileOwner,
        uint256 profileId,
        address[] calldata toCheck
    ) external view returns (bool[] memory) {
        bool[] memory approved = new bool[](toCheck.length);
        uint256 toCheckLength = toCheck.length;
        for (uint256 i = 0; i < toCheckLength; ) {
            approved[i] = _approvedByProfileByOwner[profileOwner][profileId][toCheck[i]];
            unchecked {
                ++i;
            }
        }
        return approved;
    }
}
