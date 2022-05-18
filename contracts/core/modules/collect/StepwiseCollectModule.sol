// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {ICollectModule} from '../../../interfaces/ICollectModule.sol';
import {Errors} from '../../../libraries/Errors.sol';
// import {FeeModuleBase} from '../FeeModuleBase.sol';
// import {ModuleBase} from '../ModuleBase.sol';
import {LimitedFeeCollectModule} from './LimitedFeeCollectModule.sol';
// import {FollowValidationModuleBase} from '../FollowValidationModuleBase.sol';
// import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
// import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
// import {IERC721} from '@openzeppelin/contracts/token/ERC721/IERC721.sol';

/**
 * @notice A struct containing the necessary data to execute collect actions on a publication.
 *
 * @param collectLimit The maximum number of collects for this publication.
 * @param currentCollects The current number of collects for this publication.
 * @param amount The collecting cost associated with this publication.
 * @param recipient The recipient address associated with this publication.
 * @param currency The currency associated with this publication.
 * @param referralFee The referral fee associated with this publication.
 * @param step The amount collection cost will increase after each collection.
 */
struct ProfilePublicationData {
    uint256 collectLimit;
    uint256 currentCollects;
    uint256 amount;
    address recipient;
    address currency;
    uint16 referralFee;
    uint256 step;
}

/**
 * @title StepwiseCollectModule
 * @author Roy Toledo for Lens Protocol
 *
 * @notice This is a simple Lens CollectModule implementation, inheriting from the ICollectModule interface and
 * the LimitedFeeCollectModule contract.
 *
 * This module works by allowing limited collects for a publication indefinitely with an incrementally increasing price.
 */
contract StepwiseCollectModule is ICollectModule, LimitedFeeCollectModule {
    // using SafeERC20 for IERC20;

    mapping(uint256 => mapping(uint256 => ProfilePublicationData))
        internal _dataByPublicationByProfile;
        
    // constructor(address hub, address moduleGlobals) FeeModuleBase(moduleGlobals) ModuleBase(hub) {}
    constructor(address hub, address moduleGlobals) LimitedFeeCollectModule(hub, moduleGlobals) {}

    /**
     * @notice This collect module levies a fee on collects and supports referrals. Thus, we need to decode data.
     *
     * @param data The arbitrary data parameter, decoded into:
     *      uint256 collectLimit: The maximum amount of collects.
     *      uint256 amount: The currency total amount to levy.
     *      address currency: The currency address, must be internally whitelisted.
     *      address recipient: The custom recipient address to direct earnings to.
     *      uint16 referralFee: The referral fee to set.
     *      uint256 step: Amount increment for each item.
     *
     * @return An abi encoded bytes parameter, which is the same as the passed data parameter.
     */
    function initializePublicationCollectModule(
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external override onlyHub returns (bytes memory) {
        (
            uint256 collectLimit,
            uint256 amount,
            address currency,
            address recipient,
            uint16 referralFee,
            uint256 step
        ) = abi.decode(data, (uint256, uint256, address, address, uint16, uint256));
        if (
            collectLimit == 0 ||
            !_currencyWhitelisted(currency) ||
            recipient == address(0) ||
            referralFee > BPS_MAX ||
            amount < BPS_MAX
        ) revert Errors.InitParamsInvalid();

        _dataByPublicationByProfile[profileId][pubId].collectLimit = collectLimit;
        _dataByPublicationByProfile[profileId][pubId].amount = amount;
        _dataByPublicationByProfile[profileId][pubId].currency = currency;
        _dataByPublicationByProfile[profileId][pubId].recipient = recipient;
        _dataByPublicationByProfile[profileId][pubId].referralFee = referralFee;
        _dataByPublicationByProfile[profileId][pubId].step = step;

        return data;
    }

    function _processCollect(
        address collector,
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) internal {
        super._processCollect(collector, profileId, pubId, data);
        //Increment price of next item
        _dataByPublicationByProfile[profileId][pubId].amount += _dataByPublicationByProfile[profileId][pubId].step;
    }

    function _processCollectWithReferral(
        uint256 referrerProfileId,
        address collector,
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) internal {
        super._processCollectWithReferral(referrerProfileId, collector, profileId, pubId, data);
        //Increment price of next item
        _dataByPublicationByProfile[profileId][pubId].amount += _dataByPublicationByProfile[profileId][pubId].step;
    }
}
