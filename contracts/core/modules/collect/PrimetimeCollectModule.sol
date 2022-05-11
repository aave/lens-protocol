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
import "hardhat/console.sol";

/**
 * @notice A struct containing the necessary data to execute collect actions on a publication.
 *
 * @param stakingAmount The staking cost associated with this meeting.
 * @param currency The currency associated with this publication.
 * @param meetingTime The time of the meeting.
 * @param maxLateTime Maximum number of seconds someone can come late to still get back a fraction of the stake.
 * @param meetingName Name of the meeting.
 * @param participants Participants who staked to enter the meeting.
 * @param hasBeenDistributed Whether the rewards have been distributed already.
 */
    struct ProfilePublicationData {
        uint256 stakingAmount;
        address currency;
        uint256 meetingTime;
        uint256 maxLateTime;
        string meetingName;
        address[] participants;
        bool hasBeenDistributed;
    }

/**
 * @title PrimetimeCollectModule
 * @author koalabs.eth
 *
 * @notice This is a Lens CollectModule implementation for meetings with staking, inheriting from the ICollectModule
 * interface and the FeeCollectModuleBase abstract contract.
 *
 * This module requires meeting participants to stake some amount they get back if they show up on time.
 */
contract PrimetimeCollectModule is FeeModuleBase, FollowValidationModuleBase, ICollectModule {
    using SafeERC20 for IERC20;

    mapping(uint256 => mapping(uint256 => ProfilePublicationData)) internal _dataByPublicationByProfile;
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) internal _checkinTime;
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) internal _rewards;

    constructor(address hub, address moduleGlobals) FeeModuleBase(moduleGlobals) ModuleBase(hub) {}

    /**
     * @notice This collect module levies a fee on collects and supports referrals. Thus, we need to decode data.
     *
     * @param profileId The token ID of the profile of the publisher, passed by the hub.
     * @param pubId The publication ID of the newly created publication, passed by the hub.
     * @param data The arbitrary data parameter, decoded into:
     *      uint256 stakingAmount: The currency total amount to stake.
     *      address currency: The currency address, must be internally whitelisted.
     *      uint256 meetingTime: Unix timestamp of the meeting start time.
     *      uint256 maxLateTime: Maximum number of seconds someone can come late to still get back a fraction of the stake.
     *      string meetingName: The name of the meeting.
     *
     * @return bytes An abi encoded bytes parameter, which is the same as the passed data parameter.
     */
    function initializePublicationCollectModule(
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external override onlyHub returns (bytes memory) {
        (uint256 stakingAmount,
        address currency,
        uint256 meetingTime,
        uint256 maxLateTime,
        string memory meetingName
        ) = abi.decode(data, (uint256, address, uint256, uint256, string));
        if (!_currencyWhitelisted(currency) || stakingAmount == 0) revert Errors.InitParamsInvalid();

        _dataByPublicationByProfile[profileId][pubId].stakingAmount = stakingAmount;
        _dataByPublicationByProfile[profileId][pubId].currency = currency;
        _dataByPublicationByProfile[profileId][pubId].meetingTime = meetingTime;
        _dataByPublicationByProfile[profileId][pubId].maxLateTime = maxLateTime;
        _dataByPublicationByProfile[profileId][pubId].meetingName = meetingName;

        return data;
    }

    /**
     * @dev Processes a collect
     */
    function processCollect(
        uint256 referrerProfileId,
        address collector,
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external virtual override onlyHub {
        _processCollect(collector, profileId, pubId, data);
    }

    /**
     * @notice Returns the publication data for a given publication, or an empty struct if that publication was not
     * initialized with this module.
     *
     * @param profileId The token ID of the profile mapped to the publication to query.
     * @param pubId The publication ID of the publication to query.
     *
     * @return ProfilePublicationData The ProfilePublicationData struct mapped to that publication.
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
        // transfer stake to the collect module (allowance has to be set in a previous call)
        uint256 stakingAmount = _dataByPublicationByProfile[profileId][pubId].stakingAmount;
        address currency = _dataByPublicationByProfile[profileId][pubId].currency;
        _validateDataIsExpected(data, currency, stakingAmount);
        IERC20(currency).safeTransferFrom(collector, address(this), stakingAmount);
        _dataByPublicationByProfile[profileId][pubId].participants.push(collector);
    }

    function checkin(
        uint256 profileId,
        uint256 pubId
    ) external {
        int256 timeSinceMeetingStart = int256(block.timestamp) - int256(_dataByPublicationByProfile[profileId][pubId].meetingTime);
        // only allow checkin 5 minutes prior to meeting start time
        if (timeSinceMeetingStart >= - 5 minutes) {
            _checkinTime[profileId][pubId][msg.sender] = block.timestamp;
        }
    }

    function getParticipants(
        uint256 profileId,
        uint256 pubId
    ) external view returns (address[] memory) {
        return _dataByPublicationByProfile[profileId][pubId].participants;
    }

    function distributeStake(
        uint256 profileId,
        uint256 pubId
    ) external {
        ProfilePublicationData memory meeting = _dataByPublicationByProfile[profileId][pubId];
        if (block.timestamp >= meeting.meetingTime + meeting.maxLateTime && !meeting.hasBeenDistributed) {
            uint256 stakedAmount = meeting.stakingAmount;
            int256 adjustedAmount = int256(stakedAmount);

            int256 totalLateTime = 0;
            for (uint256 i = 0; i < meeting.participants.length; i++) {
                int256 lateTime = int256(_checkinTime[profileId][pubId][meeting.participants[i]]) - int256(meeting.meetingTime);
                if (_checkinTime[profileId][pubId][meeting.participants[i]] == 0) {
                    lateTime = int256(meeting.maxLateTime);
                }
                if (lateTime < 0) {
                    lateTime = 0;
                }
                totalLateTime += lateTime;
            }

            for (uint256 i = 0; i < meeting.participants.length; i++) {
                int256 reward = adjustedAmount;
                if (totalLateTime > 0 && meeting.participants.length > 1) {
                    int256 lateTime = int256(_checkinTime[profileId][pubId][meeting.participants[i]]) - int256(meeting.meetingTime);
                    if (_checkinTime[profileId][pubId][meeting.participants[i]] == 0) {
                        lateTime = int256(meeting.maxLateTime);
                    }
                    if (lateTime < 0) {
                        lateTime = 0;
                    }

                    reward = adjustedAmount - adjustedAmount * lateTime / int256(meeting.maxLateTime) * int256(meeting.participants.length) / int256(meeting.participants.length - 1);
                    reward += adjustedAmount * totalLateTime / int256(meeting.maxLateTime) / int256(meeting.participants.length - 1);
                }
                _rewards[profileId][pubId][meeting.participants[i]] = uint256(reward);
                if (reward > 0) {
                    IERC20(meeting.currency).safeTransfer(meeting.participants[i], uint256(reward));
                }
            }

            _dataByPublicationByProfile[profileId][pubId].hasBeenDistributed = true;
        }
    }

    function getCheckinTime(
        uint256 profileId,
        uint256 pubId,
        address participant
    ) external view returns (uint256) {
        return _checkinTime[profileId][pubId][participant];
    }

    function getReward(
        uint256 profileId,
        uint256 pubId,
        address participant
    ) external view returns (uint256) {
        console.log(participant);
        return _rewards[profileId][pubId][participant];
    }


}

