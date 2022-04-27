// SPDX-License-Identifier: AGPLv3
pragma solidity ^0.8.10;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IERC721} from '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import {CFAv1Library} from '@superfluid-finance/ethereum-contracts/contracts/apps/CFAv1Library.sol';
import {ISuperfluid} from '@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol';
import {ISuperToken} from '@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperToken.sol';
import {IConstantFlowAgreementV1} from '@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol';
import {IFollowModule} from '../../../interfaces/IFollowModule.sol';
import {ILensHub} from '../../../interfaces/ILensHub.sol';
import {IModuleGlobals} from '../../../interfaces/IModuleGlobals.sol';
import {Errors} from '../../../libraries/Errors.sol';
import {Events} from '../../../libraries/Events.sol';
import {ModuleBase} from '../ModuleBase.sol';

/**
 * @notice A struct containing the necessary data to execute follow actions on a given profile.
 *
 * @param recipient The recipient address associated with this profile.
 * @param currency The SuperToken associated with this profile.
 * @param amount The following cost associated with this profile.
 * @param flowRate The Constant Flow Agreement flow rate associated with this profile.
 */
struct ProfileData {
    address recipient;
    address currency;
    uint256 amount;
    uint96 flowRate;
}

/**
 * @title SuperfluidFollowModule
 * @author Wary
 *
 * @notice This module only allows addresses that pay the fee and with an open Superfluid money stream to follow
 */
contract SuperfluidCFAFollowModule is IFollowModule, ModuleBase {
    using CFAv1Library for CFAv1Library.InitData;
    using SafeERC20 for IERC20;

    uint16 internal constant BPS_MAX = 10000;
    address public immutable MODULE_GLOBALS;

    CFAv1Library.InitData public cfaV1;

    mapping(uint256 => ProfileData) internal _dataByProfile;
    mapping(uint256 => mapping(address => uint256)) internal _followedAt; // profileId => follower => timestamp

    constructor(
        address hub,
        address moduleGlobals,
        address superfluidHost
    ) ModuleBase(hub) {
        if (moduleGlobals == address(0) || superfluidHost == address(0))
            revert Errors.InitParamsInvalid();
        MODULE_GLOBALS = moduleGlobals;
        cfaV1 = CFAv1Library.InitData(
            ISuperfluid(superfluidHost),
            IConstantFlowAgreementV1(
                address(
                    ISuperfluid(superfluidHost).getAgreementClass(
                        keccak256('org.superfluid-finance.agreements.ConstantFlowAgreement.v1')
                    )
                )
            )
        );
        emit Events.SuperfluidModuleBaseConstructed(moduleGlobals, superfluidHost, block.timestamp);
    }

    /**
     * @notice This follow module levies a fee on follows and checks if a Superfluid constant agreement flow is created from sender to recipient.
     *
     * @param data The arbitrary data parameter, decoded into:
     *      address recipient: The custom recipient address to direct earnings to.
     *      address currency: The currency address, must be internally whitelisted.
     *      uint256 amount: The currency total amount to levy.
     *      uint96 flowRate: The Superfluid constant flow agreement flow rate.
     *
     * @return An abi encoded bytes parameter, which is the same as the passed data parameter.
     */
    function initializeFollowModule(uint256 profileId, bytes calldata data)
        external
        override
        onlyHub
        returns (bytes memory)
    {
        (address recipient, address currency, uint256 amount, uint96 flowRate) = abi.decode(
            data,
            (address, address, uint256, uint96)
        );
        if (recipient == address(0) || !_currencyWhitelisted(currency) || flowRate == 0)
            revert Errors.InitParamsInvalid();

        _dataByProfile[profileId].recipient = recipient;
        _dataByProfile[profileId].currency = currency;
        _dataByProfile[profileId].amount = amount;
        _dataByProfile[profileId].flowRate = flowRate;
        return data;
    }

    /**
     * @dev Processes a follow by:
     *  1. Checking if the follower was already following
     *  2. Charging a fee
     *  3. Checking if a Superfluid constant flow agreement exists between sender and recipient with the correct flowRate
     */
    function processFollow(
        address follower,
        uint256 profileId,
        bytes calldata data
    ) external override onlyHub {
        address followNFT = ILensHub(HUB).getFollowNFT(profileId);
        if (followNFT == address(0)) revert Errors.FollowInvalid();
        // check that follower owns a followNFT
        // ⚠ LensHub mints a follow nft BEFORE calling processFollow()
        if (IERC721(followNFT).balanceOf(follower) > 1) revert Errors.FollowInvalid();

        address currency = _dataByProfile[profileId].currency;
        uint256 amount = _dataByProfile[profileId].amount;
        _validateDataIsExpected(data, currency, amount);

        (address treasury, uint16 treasuryFee) = _treasuryData();
        address recipient = _dataByProfile[profileId].recipient;
        uint256 treasuryAmount = (amount * treasuryFee) / BPS_MAX;
        uint256 adjustedAmount = amount - treasuryAmount;

        IERC20(currency).safeTransferFrom(follower, recipient, adjustedAmount);
        IERC20(currency).safeTransferFrom(follower, treasury, treasuryAmount);

        uint96 flowRate = _dataByProfile[profileId].flowRate;
        if (!_isValidFlow(currency, follower, recipient, flowRate, 0)) revert Errors.CFAInvalid();
        // We must store this timestamp to later verify the subscriber did not update their flow
        _followedAt[profileId][follower] = block.timestamp;
    }

    /**
     * @dev Adapted from FollowValidatorFollowModuleBase.isFollowing to also check if the follower did not update their stream since they followed.
     */
    function isFollowing(
        uint256 profileId,
        address follower,
        uint256 followNFTTokenId
    ) external view override returns (bool) {
        address followNFT = ILensHub(HUB).getFollowNFT(profileId);
        if (followNFT == address(0)) {
            return false;
        }
        if (followNFTTokenId == 0) {
            // check that follower owns a followNFT
            if (IERC721(followNFT).balanceOf(follower) == 0) return false;
        } else {
            // check that follower owns the specific followNFT
            if (IERC721(followNFT).ownerOf(followNFTTokenId) != follower) return false;
        }
        // check that follower's flow
        address currency = _dataByProfile[profileId].currency;
        address recipient = _dataByProfile[profileId].recipient;
        uint96 flowRate = _dataByProfile[profileId].flowRate;
        uint256 followedAt = _followedAt[profileId][follower];
        return _isValidFlow(currency, follower, recipient, flowRate, followedAt);
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
     * @param profileId The token ID of the profile to query.
     *
     * @return The ProfileData struct mapped to that profile.
     */
    function getProfileData(uint256 profileId) external view returns (ProfileData memory) {
        return _dataByProfile[profileId];
    }

    function _isValidFlow(
        address currency,
        address sender,
        address recipient,
        uint96 flowRate,
        uint256 timestamp
    ) internal view returns (bool) {
        (uint256 lastUpdatedAt, int96 currentFlowRate, , ) = cfaV1.cfa.getFlow(
            ISuperToken(currency),
            sender,
            recipient
        );
        // A valid cfa must have the expected flow rate
        return
            currentFlowRate == int96(flowRate) &&
            // and not have been updated since the follower followed
            (lastUpdatedAt <= timestamp || timestamp == 0);
    }

    function _validateDataIsExpected(
        bytes calldata data,
        address currency,
        uint256 amount
    ) internal pure {
        (address decodedCurrency, uint256 decodedAmount) = abi.decode(data, (address, uint256));
        if (decodedAmount != amount || decodedCurrency != currency)
            revert Errors.ModuleDataMismatch();
    }

    function _currencyWhitelisted(address currency) internal view returns (bool) {
        return IModuleGlobals(MODULE_GLOBALS).isCurrencyWhitelisted(currency);
    }

    function _treasuryData() internal view returns (address, uint16) {
        return IModuleGlobals(MODULE_GLOBALS).getTreasuryData();
    }
}
