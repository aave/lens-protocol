// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {ICollectModule} from '../../../interfaces/ICollectModule.sol';
import {Errors} from '../../../libraries/Errors.sol';
import {FeeModuleBase} from '../FeeModuleBase.sol';
import {ModuleBase} from '../ModuleBase.sol';
import {FollowValidationModuleBase} from '../FollowValidationModuleBase.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IERC721} from '@openzeppelin/contracts/token/ERC721/IERC721.sol';

/**
 * @notice A struct containing the necessary data to execute collect actions on a publication.
 *
 * @param amount The collecting cost associated with this publication.
 * @param recipient The recipient address associated with this publication.
 * @param currency The currency associated with this publication.
 * @param referralFee The referral fee associated with this publication.
 * @param tokenToBuy The token that is bought from the collected fees. (e.g. Toucan Protocol's BCT)
 * @param router The swap router that is used to exchange the collected fees. (UniswapV2Router01)
 * @param intermediaryToken An intermediary token to be used for swapping when there is no direct currency - tokenToBuy pair (e.g. USDC)
 */
struct ProfilePublicationData {
    uint256 amount;
    address recipient;
    address currency;
    uint16 referralFee;
    address tokenToBuy;
    address router;
    address intermediaryToken;
}

/**
 * @notice Necessary in order to swap tokens.
 */
interface IUniswapV2Router01 {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

/**
 * @title SwapCollectModule
 * @author yakuhito
 *
 * @notice This is a simple Lens CollectModule implementation, extending FeeCollectModule to swap all received
 * fees to a designated token and send them to the designated rewards recipient.
 *
 * This module works by allowing unlimited collects for a publication at a given price.
 */
contract SwapCollectModule is ICollectModule, FeeModuleBase, FollowValidationModuleBase {
    using SafeERC20 for IERC20;

    mapping(uint256 => mapping(uint256 => ProfilePublicationData))
        internal _dataByPublicationByProfile;

    constructor(address hub, address moduleGlobals) FeeModuleBase(moduleGlobals) ModuleBase(hub) {}

    /**
     * @notice This collect module levies a fee on collects and supports referrals. Thus, we need to decode data.
     *
     * @param profileId The token ID of the profile of the publisher, passed by the hub.
     * @param pubId The publication ID of the newly created publication, passed by the hub.
     * @param data The arbitrary data parameter, decoded into:
     *      uint256 amount: The currency total amount to levy.
     *      address currency: The currency address, must be internally whitelisted.
     *      address recipient: The custom recipient address to direct earnings to.
     *      uint16 referralFee: The referral fee to set.
     *
     * @return An abi encoded bytes parameter, which is the same as the passed data parameter.
     */
    function initializePublicationCollectModule(
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external override onlyHub returns (bytes memory) {
        (uint256 amount, address currency, address recipient, uint16 referralFee, address tokenToBuy, address router, address intermediaryToken) = abi.decode(
            data,
            (uint256, address, address, uint16, address, address, address)
        );
        if (
            !_currencyWhitelisted(currency) ||
            !_currencyWhitelisted(tokenToBuy) ||
            (!_currencyWhitelisted(intermediaryToken) && intermediaryToken != address(0)) ||
            currency == tokenToBuy ||
            intermediaryToken == tokenToBuy ||
            currency == intermediaryToken ||
            recipient == address(0) ||
            referralFee > BPS_MAX ||
            amount < BPS_MAX
        ) revert Errors.InitParamsInvalid();

        _dataByPublicationByProfile[profileId][pubId].referralFee = referralFee;
        _dataByPublicationByProfile[profileId][pubId].recipient = recipient;
        _dataByPublicationByProfile[profileId][pubId].currency = currency;
        _dataByPublicationByProfile[profileId][pubId].amount = amount;
        _dataByPublicationByProfile[profileId][pubId].tokenToBuy = tokenToBuy;
        _dataByPublicationByProfile[profileId][pubId].router = router;
        _dataByPublicationByProfile[profileId][pubId].intermediaryToken = intermediaryToken;

        return data;
    }

    /**
     * @dev Processes a collect by:
     *  1. Ensuring the collector is a follower
     *  2. Charging a fee
     * @dev data contains: currency (address), amount (uint256), amountOutMin (unit256)
     */
    function processCollect(
        uint256 referrerProfileId,
        address collector,
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external virtual override onlyHub {
        _checkFollowValidity(profileId, collector);
        if (referrerProfileId == profileId) {
            _processCollect(collector, profileId, pubId, data);
        } else {
            _processCollectWithReferral(referrerProfileId, collector, profileId, pubId, data);
        }
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

    function _processCollect(
        address collector,
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) internal {
        uint256 amount = _dataByPublicationByProfile[profileId][pubId].amount;
        address currency = _dataByPublicationByProfile[profileId][pubId].currency;
        _validateDataIsExpected(data, currency, amount);

        (address treasury, uint16 treasuryFee) = _treasuryData();
        uint256 treasuryAmount = (amount * treasuryFee) / BPS_MAX;
        IERC20(currency).safeTransferFrom(collector, treasury, treasuryAmount);

        uint256 adjustedAmount = amount - treasuryAmount;
        _buyToken(collector, profileId, pubId, adjustedAmount, data);
    }

    function _processCollectWithReferral(
        uint256 referrerProfileId,
        address collector,
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) internal {
        uint256 amount = _dataByPublicationByProfile[profileId][pubId].amount;
        address currency = _dataByPublicationByProfile[profileId][pubId].currency;
        _validateDataIsExpected(data, currency, amount);

        uint256 referralFee = _dataByPublicationByProfile[profileId][pubId].referralFee;
        address treasury;
        uint256 treasuryAmount;

        // Avoids stack too deep
        {
            uint16 treasuryFee;
            (treasury, treasuryFee) = _treasuryData();
            treasuryAmount = (amount * treasuryFee) / BPS_MAX;
        }

        uint256 adjustedAmount = amount - treasuryAmount;

        if (referralFee != 0) {
            // The reason we levy the referral fee on the adjusted amount is so that referral fees
            // don't bypass the treasury fee, in essence referrals pay their fair share to the treasury.
            uint256 referralAmount = (adjustedAmount * referralFee) / BPS_MAX;
            adjustedAmount = adjustedAmount - referralAmount;

            address referralRecipient = IERC721(HUB).ownerOf(referrerProfileId);

            IERC20(currency).safeTransferFrom(collector, referralRecipient, referralAmount);
        }

        IERC20(currency).safeTransferFrom(collector, treasury, treasuryAmount);
        _buyToken(collector, profileId, pubId, adjustedAmount, data);
    }

    /*
    * @dev data is already verified!
    */
    function _buyToken(
        address collector,
        uint256 profileId,
        uint256 pubId,
        uint256 amount,
        bytes calldata data
    ) internal {
        (address currency, uint256 initialAmount, uint256 amountOutMin) = abi.decode(
            data, (address, uint256, uint256)
        );
        address recipient = _dataByPublicationByProfile[profileId][pubId].recipient;
        address tokenToBuy = _dataByPublicationByProfile[profileId][pubId].tokenToBuy;
        address router = _dataByPublicationByProfile[profileId][pubId].router;
        address intermediaryToken = _dataByPublicationByProfile[profileId][pubId].intermediaryToken;
    
        // Transfer tokens to this contract
        IERC20(currency).safeTransferFrom(collector, address(this), amount);

        // Increase allowance
        IERC20(currency).approve(router, amount);

        // Swap
        address[] memory path;
        
        if(intermediaryToken == address(0)) {
            path = new address[](2);
            path[0] = currency;
            path[1] = tokenToBuy;
        } else {
            path = new address[](3);
            path[0] = currency;
            path[0] = intermediaryToken;
            path[1] = tokenToBuy;
        }
        
        IUniswapV2Router01(router).swapExactTokensForTokens(
            amount,
            amountOutMin,
            path,
            recipient,
            block.timestamp
        );
    }
}
