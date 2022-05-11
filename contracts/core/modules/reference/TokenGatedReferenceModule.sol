// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {IReferenceModule} from '../../../interfaces/IReferenceModule.sol';
import {ModuleBase} from '../ModuleBase.sol';
import {IERC721} from '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ILensHub} from '../../../interfaces/ILensHub.sol';
import {Errors} from '../../../libraries/Errors.sol';

/**
 * @notice A struct containing the necessary data to execute reference actions on a publication.
 *
 * @param token The token address associated with a publication.
 * @param minimumBalance The minimum amount of token an address should have to reference a publication.
 */
struct ProfilePublicationData {
    address token;
    uint256 minimumBalance;
}

/**
 * @title TokenGatedReferenceModule
 * @author Lens Protocol, starwalker00
 *
 * @notice A simple reference module that validates that comments or mirrors originate from a profile
 * owned by an address that has at least `minimumBalance` amount of ERC-20 token at address `token`.
 */
contract TokenGatedReferenceModule is IReferenceModule, ModuleBase {
    mapping(uint256 => mapping(uint256 => ProfilePublicationData))
        internal _dataByPublicationByProfile;

    constructor(address hub) ModuleBase(hub) {}

    /**
     * @notice This reference module sets up a token gate. Thus, we need to decode data.
     *
     * @param profileId The token ID of the profile of the publisher, passed by the hub.
     * @param pubId The publication ID of the newly created publication, passed by the hub.
     * @param data The arbitrary data parameter, decoded into:
     *      address token: The token address.
     *      uint256 minimumBalance: The minimum amount of token an address should have to reference the publication.
     *
     * @return An abi encoded bytes parameter, which is the same as the passed data parameter.
     */
    function initializeReferenceModule(
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external override onlyHub returns (bytes memory) {
        (address token, uint256 minimumBalance) = abi.decode(data, (address, uint256));
        if (token == address(0)) revert Errors.InitParamsInvalid();

        _dataByPublicationByProfile[profileId][pubId].token = token;
        _dataByPublicationByProfile[profileId][pubId].minimumBalance = minimumBalance;

        return data;
    }

    /**
     * @notice Returns the publication data for a given publication, or an empty struct if that publication was not
     * initialized with this module.
     *
     * @param profileId The token ID of the profile mapped to the publication to query.
     * @param pubId The publication ID of the publication to query.
     *
     * @return The ProfilePublicationData struct mapped to that publication.
     */
    function getPublicationData(uint256 profileId, uint256 pubId)
        external
        view
        returns (ProfilePublicationData memory)
    {
        return _dataByPublicationByProfile[profileId][pubId];
    }

    /**
     * @notice Validates that the commenting profile's owner passes the token gate.
     */
    function processComment(
        uint256 profileId,
        uint256 profileIdPointed,
        uint256 pubIdPointed
    ) external view override {
        _checkBalanceOf(profileId, profileIdPointed, pubIdPointed);
    }

    /**
     * @notice Validates that the mirroring profile's owner passes the token gate.
     */
    function processMirror(
        uint256 profileId,
        uint256 profileIdPointed,
        uint256 pubIdPointed
    ) external view override {
        _checkBalanceOf(profileId, profileIdPointed, pubIdPointed);
    }

    /**
     * @notice Validates that an referencing profile's owner passes the token gate.
     *
     * @param profileId The token ID of the profile trying to comment or mirror.
     * @param profileIdPointed The token ID of the profile mapped to the publication to query.
     * @param pubIdPointed The publication ID of the publication to query.
     *
     */
    function _checkBalanceOf(
        uint256 profileId,
        uint256 profileIdPointed,
        uint256 pubIdPointed
    ) internal view {
        address referenceCreatorAddress = IERC721(HUB).ownerOf(profileId);
        address tokenAddress = _dataByPublicationByProfile[profileIdPointed][pubIdPointed].token;
        uint256 balance = IERC20(tokenAddress).balanceOf(referenceCreatorAddress);
        uint256 minimumBalance = _dataByPublicationByProfile[profileIdPointed][pubIdPointed]
            .minimumBalance;

        if (balance < minimumBalance) revert Errors.NotEnoughTokens();
    }
}
