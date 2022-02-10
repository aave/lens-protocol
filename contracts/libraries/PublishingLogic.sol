// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {Helpers} from './Helpers.sol';
import {DataTypes} from './DataTypes.sol';
import {Errors} from './Errors.sol';
import {Events} from './Events.sol';
import {Constants} from './Constants.sol';
import {IFollowModule} from '../interfaces/IFollowModule.sol';
import {ICollectModule} from '../interfaces/ICollectModule.sol';
import {IReferenceModule} from '../interfaces/IReferenceModule.sol';

/**
 * @title PublishingLogic
 * @author Lens Protocol
 *
 * @notice This is the library that contains the logic for profile creation & publication.
 *
 * @dev The functions are external, so they are called from the hub via `delegateCall` under the hood. Furthermore,
 * expected events are emitted from this library instead of from the hub to alleviate code size concerns.
 */
library PublishingLogic {
    /**
     * @notice Executes the logic to create a profile with the given parameters to the given address.
     *
     * @param vars The CreateProfileData struct containing the following parameters:
     *      to: The address receiving the profile.
     *      handle: The handle to set for the profile, must be unique and non-empty.
     *      imageURI: The URI to set for the profile image.
     *      followModule: The follow module to use, can be the zero address.
     *      followModuleData: The follow module initialization data, if any
     *      followNFTURI: The URI to set for the follow NFT.
     * @param profileId The profile ID to associate with this profile NFT (token ID).
     * @param _profileIdByHandleHash The storage reference to the mapping of profile IDs by handle hash.
     * @param _profileById The storage reference to the mapping of profile structs by IDs.
     * @param _followModuleAllowlisted The storage reference to the mapping of allowlist status by follow module address.
     */
    function createProfile(
        DataTypes.CreateProfileData calldata vars,
        uint256 profileId,
        mapping(bytes32 => uint256) storage _profileIdByHandleHash,
        mapping(uint256 => DataTypes.ProfileStruct) storage _profileById,
        mapping(address => bool) storage _followModuleAllowlisted
    ) external {
        _validateHandle(vars.handle);

        bytes32 handleHash = keccak256(bytes(vars.handle));

        if (_profileIdByHandleHash[handleHash] != 0) revert Errors.HandleTaken();
        _profileIdByHandleHash[handleHash] = profileId;

        _profileById[profileId].handle = vars.handle;
        _profileById[profileId].imageURI = vars.imageURI;
        _profileById[profileId].followNFTURI = vars.followNFTURI;

        if (vars.followModule != address(0)) {
            _profileById[profileId].followModule = vars.followModule;
        }

        bytes memory followModuleReturnData = _initFollowModule(
            profileId,
            vars.followModule,
            vars.followModuleData,
            _followModuleAllowlisted
        );

        _emitProfileCreated(profileId, vars, followModuleReturnData);
    }

    /**
     * @notice Sets the follow module for a given profile.
     *
     * @param profileId The profile ID to set the follow module for.
     * @param followModule The follow module to set for the given profile, if any.
     * @param followModuleData The data to pass to the follow module for profile initialization.
     * @param _profile The storage reference to the profile struct associated with the given profile ID.
     * @param _followModuleAllowlisted The storage reference to the mapping of allowlist status by follow module address.
     */
    function setFollowModule(
        uint256 profileId,
        address followModule,
        bytes calldata followModuleData,
        DataTypes.ProfileStruct storage _profile,
        mapping(address => bool) storage _followModuleAllowlisted
    ) external {
        address prevFollowModule = _profile.followModule;
        if (followModule != prevFollowModule) {
            _profile.followModule = followModule;
        }

        bytes memory followModuleReturnData = _initFollowModule(
            profileId,
            followModule,
            followModuleData,
            _followModuleAllowlisted
        );
        emit Events.FollowModuleSet(
            profileId,
            followModule,
            followModuleReturnData,
            block.timestamp
        );
    }

    /**
     * @notice Creates a post publication mapped to the given profile.
     *
     * @dev To avoid a stack too deep error, reference parameters are passed in memory rather than calldata.
     *
     * @param profileId The profile ID to associate this publication to.
     * @param contentURI The URI to set for this publication.
     * @param collectModule The collect module to set for this publication.
     * @param collectModuleData The data to pass to the collect module for publication initialization.
     * @param referenceModule The reference module to set for this publication, if any.
     * @param referenceModuleData The data to pass to the reference module for publication initialization.
     * @param pubId The publication ID to associate with this publication.
     * @param _pubByIdByProfile The storage reference to the mapping of publications by publication ID by profile ID.
     * @param _collectModuleAllowlisted The storage reference to the mapping of allowlist status by collect module address.
     * @param _referenceModuleAllowlisted The storage reference to the mapping of allowlist status by reference module address.
     */
    function createPost(
        uint256 profileId,
        string memory contentURI,
        address collectModule,
        bytes memory collectModuleData,
        address referenceModule,
        bytes memory referenceModuleData,
        uint256 pubId,
        mapping(uint256 => mapping(uint256 => DataTypes.PublicationStruct))
            storage _pubByIdByProfile,
        mapping(address => bool) storage _collectModuleAllowlisted,
        mapping(address => bool) storage _referenceModuleAllowlisted
    ) external {
        _pubByIdByProfile[profileId][pubId].contentURI = contentURI;

        // Collect module initialization
        bytes memory collectModuleReturnData = _initPubCollectModule(
            profileId,
            pubId,
            collectModule,
            collectModuleData,
            _pubByIdByProfile,
            _collectModuleAllowlisted
        );

        // Reference module initialization
        bytes memory referenceModuleReturnData = _initPubReferenceModule(
            profileId,
            pubId,
            referenceModule,
            referenceModuleData,
            _pubByIdByProfile,
            _referenceModuleAllowlisted
        );

        emit Events.PostCreated(
            profileId,
            pubId,
            contentURI,
            collectModule,
            collectModuleReturnData,
            referenceModule,
            referenceModuleReturnData,
            block.timestamp
        );
    }

    /**
     * @notice Creates a comment publication mapped to the given profile.
     *
     * @dev This function is unique in that it requires many variables, so, unlike the other publishing functions,
     * we need to pass the full CommentData struct in memory to avoid a stack too deep error.
     *
     * @param vars The CommentData struct to use to create the comment.
     * @param pubId The publication ID to associate with this publication.
     * @param _profileById The storage reference to the mapping of profile structs by IDs.
     * @param _pubByIdByProfile The storage reference to the mapping of publications by publication ID by profile ID.
     * @param _collectModuleAllowlisted The storage reference to the mapping of allowlist status by collect module address.
     * @param _referenceModuleAllowlisted The storage reference to the mapping of allowlist status by reference module address.
     */
    function createComment(
        DataTypes.CommentData memory vars,
        uint256 pubId,
        mapping(uint256 => DataTypes.ProfileStruct) storage _profileById,
        mapping(uint256 => mapping(uint256 => DataTypes.PublicationStruct))
            storage _pubByIdByProfile,
        mapping(address => bool) storage _collectModuleAllowlisted,
        mapping(address => bool) storage _referenceModuleAllowlisted
    ) external {
        // Validate existence of the pointed publication
        uint256 pubCount = _profileById[vars.profileIdPointed].pubCount;
        if (pubCount < vars.pubIdPointed || vars.pubIdPointed == 0)
            revert Errors.PublicationDoesNotExist();

        _pubByIdByProfile[vars.profileId][pubId].contentURI = vars.contentURI;
        _pubByIdByProfile[vars.profileId][pubId].profileIdPointed = vars.profileIdPointed;
        _pubByIdByProfile[vars.profileId][pubId].pubIdPointed = vars.pubIdPointed;

        // Collect Module Initialization
        bytes memory collectModuleReturnData = _initPubCollectModule(
            vars.profileId,
            pubId,
            vars.collectModule,
            vars.collectModuleData,
            _pubByIdByProfile,
            _collectModuleAllowlisted
        );

        // Reference module initialization
        bytes memory referenceModuleReturnData = _initPubReferenceModule(
            vars.profileId,
            pubId,
            vars.referenceModule,
            vars.referenceModuleData,
            _pubByIdByProfile,
            _referenceModuleAllowlisted
        );

        // Reference module validation
        address refModule = _pubByIdByProfile[vars.profileIdPointed][vars.pubIdPointed]
            .referenceModule;
        if (refModule != address(0)) {
            IReferenceModule(refModule).processComment(
                vars.profileId,
                vars.profileIdPointed,
                vars.pubIdPointed
            );
        }

        // Prevents a stack too deep error
        _emitCommentCreated(vars, pubId, collectModuleReturnData, referenceModuleReturnData);
    }

    /**
     * @notice Creates a mirror publication mapped to the given profile.
     *
     * @param profileId The profile ID to associate this publication to.
     * @param profileIdPointed The profile ID of the pointed publication's publisher.
     * @param pubIdPointed The pointed publication's publication ID.
     * @param referenceModule The reference module to set for this publication, if any.
     * @param referenceModuleData The data to pass to the reference module for publication initialization.
     * @param pubId The publication ID to associate with this publication.
     * @param _pubByIdByProfile The storage reference to the mapping of publications by publication ID by profile ID.
     * @param _referenceModuleAllowlisted The storage reference to the mapping of allowlist status by reference module address.
     */
    function createMirror(
        uint256 profileId,
        uint256 profileIdPointed,
        uint256 pubIdPointed,
        address referenceModule,
        bytes calldata referenceModuleData,
        uint256 pubId,
        mapping(uint256 => mapping(uint256 => DataTypes.PublicationStruct))
            storage _pubByIdByProfile,
        mapping(address => bool) storage _referenceModuleAllowlisted
    ) external {
        (uint256 rootProfileIdPointed, uint256 rootPubIdPointed, ) = Helpers.getPointedIfMirror(
            profileIdPointed,
            pubIdPointed,
            _pubByIdByProfile
        );

        _pubByIdByProfile[profileId][pubId].profileIdPointed = rootProfileIdPointed;
        _pubByIdByProfile[profileId][pubId].pubIdPointed = rootPubIdPointed;

        // Reference module initialization
        bytes memory referenceModuleReturnData = _initPubReferenceModule(
            profileId,
            pubId,
            referenceModule,
            referenceModuleData,
            _pubByIdByProfile,
            _referenceModuleAllowlisted
        );

        // Reference module validation
        address refModule = _pubByIdByProfile[rootProfileIdPointed][rootPubIdPointed]
            .referenceModule;
        if (refModule != address(0)) {
            IReferenceModule(refModule).processMirror(
                profileId,
                rootProfileIdPointed,
                rootPubIdPointed
            );
        }

        emit Events.MirrorCreated(
            profileId,
            pubId,
            rootProfileIdPointed,
            rootPubIdPointed,
            referenceModule,
            referenceModuleReturnData,
            block.timestamp
        );
    }

    function _initPubCollectModule(
        uint256 profileId,
        uint256 pubId,
        address collectModule,
        bytes memory collectModuleData,
        mapping(uint256 => mapping(uint256 => DataTypes.PublicationStruct))
            storage _pubByIdByProfile,
        mapping(address => bool) storage _collectModuleAllowlisted
    ) private returns (bytes memory) {
        if (!_collectModuleAllowlisted[collectModule]) revert Errors.CollectModuleNotAllowlisted();
        _pubByIdByProfile[profileId][pubId].collectModule = collectModule;
        return
            ICollectModule(collectModule).initializePublicationCollectModule(
                profileId,
                pubId,
                collectModuleData
            );
    }

    function _initPubReferenceModule(
        uint256 profileId,
        uint256 pubId,
        address referenceModule,
        bytes memory referenceModuleData,
        mapping(uint256 => mapping(uint256 => DataTypes.PublicationStruct))
            storage _pubByIdByProfile,
        mapping(address => bool) storage _referenceModuleAllowlisted
    ) private returns (bytes memory) {
        if (referenceModule != address(0)) {
            if (!_referenceModuleAllowlisted[referenceModule])
                revert Errors.ReferenceModuleNotAllowlisted();
            _pubByIdByProfile[profileId][pubId].referenceModule = referenceModule;
            return
                IReferenceModule(referenceModule).initializeReferenceModule(
                    profileId,
                    pubId,
                    referenceModuleData
                );
        } else {
            return new bytes(0);
        }
    }

    function _initFollowModule(
        uint256 profileId,
        address followModule,
        bytes memory followModuleData,
        mapping(address => bool) storage _followModuleAllowlisted
    ) private returns (bytes memory) {
        if (followModule != address(0)) {
            if (!_followModuleAllowlisted[followModule]) revert Errors.FollowModuleNotAllowlisted();
            bytes memory returnData = IFollowModule(followModule).initializeFollowModule(
                profileId,
                followModuleData
            );
            return returnData;
        } else {
            return new bytes(0);
        }
    }

    function _emitCommentCreated(
        DataTypes.CommentData memory vars,
        uint256 pubId,
        bytes memory collectModuleReturnData,
        bytes memory referenceModuleReturnData
    ) private {
        emit Events.CommentCreated(
            vars.profileId,
            pubId,
            vars.contentURI,
            vars.profileIdPointed,
            vars.pubIdPointed,
            vars.collectModule,
            collectModuleReturnData,
            vars.referenceModule,
            referenceModuleReturnData,
            block.timestamp
        );
    }

    function _emitProfileCreated(
        uint256 profileId,
        DataTypes.CreateProfileData calldata vars,
        bytes memory followModuleReturnData
    ) internal {
        emit Events.ProfileCreated(
            profileId,
            msg.sender, // Creator is always the msg sender
            vars.to,
            vars.handle,
            vars.imageURI,
            vars.followModule,
            followModuleReturnData,
            vars.followNFTURI,
            block.timestamp
        );
    }

    function _validateHandle(string calldata handle) private pure {
        bytes memory byteHandle = bytes(handle);
        if (byteHandle.length == 0 || byteHandle.length > Constants.MAX_HANDLE_LENGTH)
            revert Errors.HandleLengthInvalid();

        for (uint256 i = 0; i < byteHandle.length; ++i) {
            if (
                (byteHandle[i] < '0' ||
                    byteHandle[i] > 'z' ||
                    (byteHandle[i] > '9' && byteHandle[i] < 'a')) && byteHandle[i] != '.'
            ) revert Errors.HandleContainsInvalidCharacters();
        }
    }
}
