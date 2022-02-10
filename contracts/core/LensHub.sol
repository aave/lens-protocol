// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {ILensHub} from '../interfaces/ILensHub.sol';
import {Events} from '../libraries/Events.sol';
import {Helpers} from '../libraries/Helpers.sol';
import {DataTypes} from '../libraries/DataTypes.sol';
import {Errors} from '../libraries/Errors.sol';
import {PublishingLogic} from '../libraries/PublishingLogic.sol';
import {InteractionLogic} from '../libraries/InteractionLogic.sol';
import {LensNFTBase} from './base/LensNFTBase.sol';
import {LensMultiState} from './base/LensMultiState.sol';
import {LensHubStorage} from './storage/LensHubStorage.sol';
import {VersionedInitializable} from '../upgradeability/VersionedInitializable.sol';

/**
 * @title LensHub
 * @author Lens Protocol
 *
 * @notice This is the main entrypoint of the Lens Protocol. It contains governance functionality as well as
 * publishing and profile interaction functionality.
 *
 * NOTE: The Lens Protocol is unique in that frontend operators need to track a potentially overwhelming
 * number of NFT contracts and interactions at once. For that reason, we've made two quirky design decisions:
 *      1. Both Follow & Collect NFTs invoke an LensHub callback on transfer with the sole purpose of emitting an event.
 *      2. Almost every event in the protocol emits the current block timestamp, reducing the need to fetch it manually.
 */
contract LensHub is ILensHub, LensNFTBase, VersionedInitializable, LensMultiState, LensHubStorage {
    uint256 internal constant REVISION = 1;

    address internal immutable FOLLOW_NFT_IMPL;
    address internal immutable COLLECT_NFT_IMPL;

    /**
     * @dev This modifier reverts if the caller is not the configured governance address.
     */
    modifier onlyGov() {
        _validateCallerIsGovernance();
        _;
    }

    /**
     * @dev This modifier reverts if the caller is not a allowlisted profile creator address.
     */
    modifier onlyAllowlistedProfileCreator() {
        _validateCallerIsAllowlistedProfileCreator();
        _;
    }

    /**
     * @dev The constructor sets the immutable follow & collect NFT implementations.
     *
     * @param followNFTImpl The follow NFT implementation address.
     * @param collectNFTImpl The collect NFT implementation address.
     */
    constructor(address followNFTImpl, address collectNFTImpl) {
        FOLLOW_NFT_IMPL = followNFTImpl;
        COLLECT_NFT_IMPL = collectNFTImpl;
    }

    /// @inheritdoc ILensHub
    function initialize(
        string calldata name,
        string calldata symbol,
        address newGovernance
    ) external override initializer {
        super._initialize(name, symbol);
        _setState(DataTypes.ProtocolState.Paused);
        _setGovernance(newGovernance);
    }

    /// ***********************
    /// *****GOV FUNCTIONS*****
    /// ***********************

    /// @inheritdoc ILensHub
    function setGovernance(address newGovernance) external override onlyGov {
        _setGovernance(newGovernance);
    }

    /// @inheritdoc ILensHub
    function setEmergencyAdmin(address newEmergencyAdmin) external override onlyGov {
        address prevEmergencyAdmin = _emergencyAdmin;
        _emergencyAdmin = newEmergencyAdmin;
        emit Events.EmergencyAdminSet(
            msg.sender,
            prevEmergencyAdmin,
            newEmergencyAdmin,
            block.timestamp
        );
    }

    /// @inheritdoc ILensHub
    function setState(DataTypes.ProtocolState newState) external override {
        if (msg.sender != _governance && msg.sender != _emergencyAdmin)
            revert Errors.NotGovernanceOrEmergencyAdmin();
        _setState(newState);
    }

    ///@inheritdoc ILensHub
    function allowlistProfileCreator(address profileCreator, bool allowlist)
        external
        override
        onlyGov
    {
        _profileCreatorAllowlisted[profileCreator] = allowlist;
        emit Events.ProfileCreatorAllowlisted(profileCreator, allowlist, block.timestamp);
    }

    /// @inheritdoc ILensHub
    function allowlistFollowModule(address followModule, bool allowlist) external override onlyGov {
        _followModuleAllowlisted[followModule] = allowlist;
        emit Events.FollowModuleAllowlisted(followModule, allowlist, block.timestamp);
    }

    /// @inheritdoc ILensHub
    function allowlistReferenceModule(address referenceModule, bool allowlist)
        external
        override
        onlyGov
    {
        _referenceModuleAllowlisted[referenceModule] = allowlist;
        emit Events.ReferenceModuleAllowlisted(referenceModule, allowlist, block.timestamp);
    }

    /// @inheritdoc ILensHub
    function allowlistCollectModule(address collectModule, bool allowlist)
        external
        override
        onlyGov
    {
        _collectModuleAllowlisted[collectModule] = allowlist;
        emit Events.CollectModuleAllowlisted(collectModule, allowlist, block.timestamp);
    }

    /// *********************************
    /// *****PROFILE OWNER FUNCTIONS*****
    /// *********************************

    /// @inheritdoc ILensHub
    function createProfile(DataTypes.CreateProfileData calldata vars)
        external
        override
        whenNotPaused
        onlyAllowlistedProfileCreator
    {
        uint256 profileId = ++_profileCounter;
        _mint(vars.to, profileId);
        PublishingLogic.createProfile(
            vars,
            profileId,
            _profileIdByHandleHash,
            _profileById,
            _followModuleAllowlisted
        );
    }

    /// @inheritdoc ILensHub
    function setFollowModule(
        uint256 profileId,
        address followModule,
        bytes calldata followModuleData
    ) external override whenNotPaused {
        _validateCallerIsProfileOwner(profileId);
        PublishingLogic.setFollowModule(
            profileId,
            followModule,
            followModuleData,
            _profileById[profileId],
            _followModuleAllowlisted
        );
    }

    /// @inheritdoc ILensHub
    function setFollowModuleWithSig(DataTypes.SetFollowModuleWithSigData calldata vars)
        external
        override
        whenNotPaused
    {
        address owner = ownerOf(vars.profileId);
        bytes32 digest;
        unchecked {
            digest = keccak256(
                abi.encodePacked(
                    '\x19\x01',
                    _calculateDomainSeparator(),
                    keccak256(
                        abi.encode(
                            SET_FOLLOW_MODULE_WITH_SIG_TYPEHASH,
                            vars.profileId,
                            vars.followModule,
                            keccak256(vars.followModuleData),
                            sigNonces[owner]++,
                            vars.sig.deadline
                        )
                    )
                )
            );
        }

        _validateRecoveredAddress(digest, owner, vars.sig);
        PublishingLogic.setFollowModule(
            vars.profileId,
            vars.followModule,
            vars.followModuleData,
            _profileById[vars.profileId],
            _followModuleAllowlisted
        );
    }

    /// @inheritdoc ILensHub
    function setDispatcher(uint256 profileId, address dispatcher) external override whenNotPaused {
        _validateCallerIsProfileOwner(profileId);
        _setDispatcher(profileId, dispatcher);
    }

    /// @inheritdoc ILensHub
    function setDispatcherWithSig(DataTypes.SetDispatcherWithSigData calldata vars)
        external
        override
        whenNotPaused
    {
        address owner = ownerOf(vars.profileId);
        bytes32 digest;
        unchecked {
            digest = keccak256(
                abi.encodePacked(
                    '\x19\x01',
                    _calculateDomainSeparator(),
                    keccak256(
                        abi.encode(
                            SET_DISPATCHER_WITH_SIG_TYPEHASH,
                            vars.profileId,
                            vars.dispatcher,
                            sigNonces[owner]++,
                            vars.sig.deadline
                        )
                    )
                )
            );
        }

        _validateRecoveredAddress(digest, owner, vars.sig);
        _setDispatcher(vars.profileId, vars.dispatcher);
    }

    /// @inheritdoc ILensHub
    function setProfileImageURI(uint256 profileId, string calldata imageURI)
        external
        override
        whenNotPaused
    {
        _validateCallerIsProfileOwnerOrDispatcher(profileId);
        _setProfileImageURI(profileId, imageURI);
    }

    /// @inheritdoc ILensHub
    function setProfileImageURIWithSig(DataTypes.SetProfileImageURIWithSigData calldata vars)
        external
        override
        whenNotPaused
    {
        address owner = ownerOf(vars.profileId);
        bytes32 digest;
        unchecked {
            digest = keccak256(
                abi.encodePacked(
                    '\x19\x01',
                    _calculateDomainSeparator(),
                    keccak256(
                        abi.encode(
                            SET_PROFILE_IMAGE_URI_WITH_SIG_TYPEHASH,
                            vars.profileId,
                            keccak256(bytes(vars.imageURI)),
                            sigNonces[owner]++,
                            vars.sig.deadline
                        )
                    )
                )
            );
        }

        _validateRecoveredAddress(digest, owner, vars.sig);
        _setProfileImageURI(vars.profileId, vars.imageURI);
    }

    /// @inheritdoc ILensHub
    function setFollowNFTURI(uint256 profileId, string calldata followNFTURI)
        external
        override
        whenNotPaused
    {
        _validateCallerIsProfileOwnerOrDispatcher(profileId);
        _setFollowNFTURI(profileId, followNFTURI);
    }

    /// @inheritdoc ILensHub
    function setFollowNFTURIWithSig(DataTypes.SetFollowNFTURIWithSigData calldata vars)
        external
        override
        whenNotPaused
    {
        address owner = ownerOf(vars.profileId);
        bytes32 digest;
        unchecked {
            digest = keccak256(
                abi.encodePacked(
                    '\x19\x01',
                    _calculateDomainSeparator(),
                    keccak256(
                        abi.encode(
                            SET_FOLLOW_NFT_URI_WITH_SIG_TYPEHASH,
                            vars.profileId,
                            keccak256(bytes(vars.followNFTURI)),
                            sigNonces[owner]++,
                            vars.sig.deadline
                        )
                    )
                )
            );
        }

        _validateRecoveredAddress(digest, owner, vars.sig);
        _setFollowNFTURI(vars.profileId, vars.followNFTURI);
    }

    /// @inheritdoc ILensHub
    function post(DataTypes.PostData calldata vars) external override whenPublishingEnabled {
        _validateCallerIsProfileOwnerOrDispatcher(vars.profileId);
        _createPost(
            vars.profileId,
            vars.contentURI,
            vars.collectModule,
            vars.collectModuleData,
            vars.referenceModule,
            vars.referenceModuleData
        );
    }

    /// @inheritdoc ILensHub
    function postWithSig(DataTypes.PostWithSigData calldata vars)
        external
        override
        whenPublishingEnabled
    {
        address owner = ownerOf(vars.profileId);
        bytes32 digest;
        unchecked {
            digest = keccak256(
                abi.encodePacked(
                    '\x19\x01',
                    _calculateDomainSeparator(),
                    keccak256(
                        abi.encode(
                            POST_WITH_SIG_TYPEHASH,
                            vars.profileId,
                            keccak256(bytes(vars.contentURI)),
                            vars.collectModule,
                            keccak256(vars.collectModuleData),
                            vars.referenceModule,
                            keccak256(vars.referenceModuleData),
                            sigNonces[owner]++,
                            vars.sig.deadline
                        )
                    )
                )
            );
        }

        _validateRecoveredAddress(digest, owner, vars.sig);
        _createPost(
            vars.profileId,
            vars.contentURI,
            vars.collectModule,
            vars.collectModuleData,
            vars.referenceModule,
            vars.referenceModuleData
        );
    }

    /// @inheritdoc ILensHub
    function comment(DataTypes.CommentData calldata vars) external override whenPublishingEnabled {
        _validateCallerIsProfileOwnerOrDispatcher(vars.profileId);
        _createComment(vars);
    }

    /// @inheritdoc ILensHub
    function commentWithSig(DataTypes.CommentWithSigData calldata vars)
        external
        override
        whenPublishingEnabled
    {
        address owner = ownerOf(vars.profileId);
        bytes32 digest;
        unchecked {
            digest = keccak256(
                abi.encodePacked(
                    '\x19\x01',
                    _calculateDomainSeparator(),
                    keccak256(
                        abi.encode(
                            COMMENT_WITH_SIG_TYPEHASH,
                            vars.profileId,
                            keccak256(bytes(vars.contentURI)),
                            vars.profileIdPointed,
                            vars.pubIdPointed,
                            vars.collectModule,
                            keccak256(vars.collectModuleData),
                            vars.referenceModule,
                            keccak256(vars.referenceModuleData),
                            sigNonces[owner]++,
                            vars.sig.deadline
                        )
                    )
                )
            );
        }

        _validateRecoveredAddress(digest, owner, vars.sig);
        _createComment(
            DataTypes.CommentData(
                vars.profileId,
                vars.contentURI,
                vars.profileIdPointed,
                vars.pubIdPointed,
                vars.collectModule,
                vars.collectModuleData,
                vars.referenceModule,
                vars.referenceModuleData
            )
        );
    }

    /// @inheritdoc ILensHub
    function mirror(DataTypes.MirrorData calldata vars) external override whenPublishingEnabled {
        _validateCallerIsProfileOwnerOrDispatcher(vars.profileId);
        _createMirror(
            vars.profileId,
            vars.profileIdPointed,
            vars.pubIdPointed,
            vars.referenceModule,
            vars.referenceModuleData
        );
    }

    /// @inheritdoc ILensHub
    function mirrorWithSig(DataTypes.MirrorWithSigData calldata vars)
        external
        override
        whenPublishingEnabled
    {
        address owner = ownerOf(vars.profileId);
        bytes32 digest;
        unchecked {
            digest = keccak256(
                abi.encodePacked(
                    '\x19\x01',
                    _calculateDomainSeparator(),
                    keccak256(
                        abi.encode(
                            MIRROR_WITH_SIG_TYPEHASH,
                            vars.profileId,
                            vars.profileIdPointed,
                            vars.pubIdPointed,
                            vars.referenceModule,
                            keccak256(vars.referenceModuleData),
                            sigNonces[owner]++,
                            vars.sig.deadline
                        )
                    )
                )
            );
        }

        _validateRecoveredAddress(digest, owner, vars.sig);
        _createMirror(
            vars.profileId,
            vars.profileIdPointed,
            vars.pubIdPointed,
            vars.referenceModule,
            vars.referenceModuleData
        );
    }

    /**
     * @notice Burns a profile, this maintains the profile data struct, but deletes the
     * handle hash to profile ID mapping value.
     *
     * NOTE: This overrides the LensNFTBase contract's `burn()` function and calls it to fully burn
     * the NFT.
     */
    function burn(uint256 tokenId) public override whenNotPaused {
        super.burn(tokenId);
        _clearHandleHash(tokenId);
    }

    /**
     * @notice Burns a profile with a signature, this maintains the profile data struct, but deletes the
     * handle hash to profile ID mapping value.
     *
     * NOTE: This overrides the LensNFTBase contract's `burnWithSig()` function and calls it to fully burn
     * the NFT.
     */
    function burnWithSig(uint256 tokenId, DataTypes.EIP712Signature calldata sig)
        public
        override
        whenNotPaused
    {
        super.burnWithSig(tokenId, sig);
        _clearHandleHash(tokenId);
    }

    /// ***************************************
    /// *****PROFILE INTERACTION FUNCTIONS*****
    /// ***************************************

    /// @inheritdoc ILensHub
    function follow(uint256[] calldata profileIds, bytes[] calldata datas)
        external
        override
        whenNotPaused
    {
        InteractionLogic.follow(
            msg.sender,
            profileIds,
            datas,
            FOLLOW_NFT_IMPL,
            _profileById,
            _profileIdByHandleHash
        );
    }

    /// @inheritdoc ILensHub
    function followWithSig(DataTypes.FollowWithSigData calldata vars)
        external
        override
        whenNotPaused
    {
        bytes32[] memory dataHashes = new bytes32[](vars.datas.length);
        for (uint256 i = 0; i < vars.datas.length; ++i) {
            dataHashes[i] = keccak256(vars.datas[i]);
        }

        bytes32 digest;
        unchecked {
            digest = keccak256(
                abi.encodePacked(
                    '\x19\x01',
                    _calculateDomainSeparator(),
                    keccak256(
                        abi.encode(
                            FOLLOW_WITH_SIG_TYPEHASH,
                            keccak256(abi.encodePacked(vars.profileIds)),
                            keccak256(abi.encodePacked(dataHashes)),
                            sigNonces[vars.follower]++,
                            vars.sig.deadline
                        )
                    )
                )
            );
        }

        _validateRecoveredAddress(digest, vars.follower, vars.sig);
        InteractionLogic.follow(
            vars.follower,
            vars.profileIds,
            vars.datas,
            FOLLOW_NFT_IMPL,
            _profileById,
            _profileIdByHandleHash
        );
    }

    /// @inheritdoc ILensHub
    function collect(
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external override whenNotPaused {
        InteractionLogic.collect(
            msg.sender,
            profileId,
            pubId,
            data,
            COLLECT_NFT_IMPL,
            _pubByIdByProfile,
            _profileById
        );
    }

    /// @inheritdoc ILensHub
    function collectWithSig(DataTypes.CollectWithSigData calldata vars)
        external
        override
        whenNotPaused
    {
        bytes32 digest;
        unchecked {
            digest = keccak256(
                abi.encodePacked(
                    '\x19\x01',
                    _calculateDomainSeparator(),
                    keccak256(
                        abi.encode(
                            COLLECT_WITH_SIG_TYPEHASH,
                            vars.profileId,
                            vars.pubId,
                            keccak256(vars.data),
                            sigNonces[vars.collector]++,
                            vars.sig.deadline
                        )
                    )
                )
            );
        }

        _validateRecoveredAddress(digest, vars.collector, vars.sig);
        InteractionLogic.collect(
            vars.collector,
            vars.profileId,
            vars.pubId,
            vars.data,
            COLLECT_NFT_IMPL,
            _pubByIdByProfile,
            _profileById
        );
    }

    /// @inheritdoc ILensHub
    function emitFollowNFTTransferEvent(
        uint256 profileId,
        uint256 followNFTId,
        address from,
        address to
    ) external override {
        address expectedFollowNFT = _profileById[profileId].followNFT;
        if (msg.sender != expectedFollowNFT) revert Errors.CallerNotFollowNFT();
        emit Events.FollowNFTTransferred(profileId, followNFTId, from, to, block.timestamp);
    }

    /// @inheritdoc ILensHub
    function emitCollectNFTTransferEvent(
        uint256 profileId,
        uint256 pubId,
        uint256 collectNFTId,
        address from,
        address to
    ) external override {
        address expectedCollectNFT = _pubByIdByProfile[profileId][pubId].collectNFT;
        if (msg.sender != expectedCollectNFT) revert Errors.CallerNotCollectNFT();
        emit Events.CollectNFTTransferred(
            profileId,
            pubId,
            collectNFTId,
            from,
            to,
            block.timestamp
        );
    }

    /// *********************************
    /// *****EXTERNAL VIEW FUNCTIONS*****
    /// *********************************

    /// @inheritdoc ILensHub
    function isProfileCreatorAllowlisted(address profileCreator)
        external
        view
        override
        returns (bool)
    {
        return _profileCreatorAllowlisted[profileCreator];
    }

    /// @inheritdoc ILensHub
    function isFollowModuleAllowlisted(address followModule) external view override returns (bool) {
        return _followModuleAllowlisted[followModule];
    }

    /// @inheritdoc ILensHub
    function isReferenceModuleAllowlisted(address referenceModule)
        external
        view
        override
        returns (bool)
    {
        return _referenceModuleAllowlisted[referenceModule];
    }

    /// @inheritdoc ILensHub
    function isCollectModuleAllowlisted(address collectModule)
        external
        view
        override
        returns (bool)
    {
        return _collectModuleAllowlisted[collectModule];
    }

    /// @inheritdoc ILensHub
    function getGovernance() external view override returns (address) {
        return _governance;
    }

    /// @inheritdoc ILensHub
    function getDispatcher(uint256 profileId) external view override returns (address) {
        return _dispatcherByProfile[profileId];
    }

    /// @inheritdoc ILensHub
    function getPubCount(uint256 profileId) external view override returns (uint256) {
        return _profileById[profileId].pubCount;
    }

    /// @inheritdoc ILensHub
    function getFollowNFT(uint256 profileId) external view override returns (address) {
        return _profileById[profileId].followNFT;
    }

    /// @inheritdoc ILensHub
    function getFollowNFTURI(uint256 profileId) external view override returns (string memory) {
        return _profileById[profileId].followNFTURI;
    }

    /// @inheritdoc ILensHub
    function getCollectNFT(uint256 profileId, uint256 pubId)
        external
        view
        override
        returns (address)
    {
        return _pubByIdByProfile[profileId][pubId].collectNFT;
    }

    /// @inheritdoc ILensHub
    function getFollowModule(uint256 profileId) external view override returns (address) {
        return _profileById[profileId].followModule;
    }

    /// @inheritdoc ILensHub
    function getCollectModule(uint256 profileId, uint256 pubId)
        external
        view
        override
        returns (address)
    {
        return _pubByIdByProfile[profileId][pubId].collectModule;
    }

    /// @inheritdoc ILensHub
    function getReferenceModule(uint256 profileId, uint256 pubId)
        external
        view
        override
        returns (address)
    {
        return _pubByIdByProfile[profileId][pubId].referenceModule;
    }

    /// @inheritdoc ILensHub
    function getHandle(uint256 profileId) external view override returns (string memory) {
        return _profileById[profileId].handle;
    }

    /// @inheritdoc ILensHub
    function getPubPointer(uint256 profileId, uint256 pubId)
        external
        view
        override
        returns (uint256, uint256)
    {
        uint256 profileIdPointed = _pubByIdByProfile[profileId][pubId].profileIdPointed;
        uint256 pubIdPointed = _pubByIdByProfile[profileId][pubId].pubIdPointed;
        return (profileIdPointed, pubIdPointed);
    }

    /// @inheritdoc ILensHub
    function getContentURI(uint256 profileId, uint256 pubId)
        external
        view
        override
        returns (string memory)
    {
        (uint256 rootProfileId, uint256 rootPubId, ) = Helpers.getPointedIfMirror(
            profileId,
            pubId,
            _pubByIdByProfile
        );
        return _pubByIdByProfile[rootProfileId][rootPubId].contentURI;
    }

    /// @inheritdoc ILensHub
    function getProfileIdByHandle(string calldata handle) external view override returns (uint256) {
        bytes32 handleHash = keccak256(bytes(handle));
        return _profileIdByHandleHash[handleHash];
    }

    /// @inheritdoc ILensHub
    function getProfile(uint256 profileId)
        external
        view
        override
        returns (DataTypes.ProfileStruct memory)
    {
        return _profileById[profileId];
    }

    /// @inheritdoc ILensHub
    function getPub(uint256 profileId, uint256 pubId)
        external
        view
        override
        returns (DataTypes.PublicationStruct memory)
    {
        return _pubByIdByProfile[profileId][pubId];
    }

    /// @inheritdoc ILensHub
    function getPubType(uint256 profileId, uint256 pubId)
        external
        view
        override
        returns (DataTypes.PubType)
    {
        if (pubId == 0 || _profileById[profileId].pubCount < pubId) {
            return DataTypes.PubType.Nonexistent;
        } else if (_pubByIdByProfile[profileId][pubId].collectModule == address(0)) {
            return DataTypes.PubType.Mirror;
        } else {
            if (_pubByIdByProfile[profileId][pubId].profileIdPointed == 0) {
                return DataTypes.PubType.Post;
            } else {
                return DataTypes.PubType.Comment;
            }
        }
    }

    /**
     * @dev Overrides the ERC721 tokenURI function to return the associated URI with a given profile.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        return _profileById[tokenId].imageURI; // temp
    }

    /// ****************************
    /// *****INTERNAL FUNCTIONS*****
    /// ****************************

    function _setGovernance(address newGovernance) internal {
        address prevGovernance = _governance;
        _governance = newGovernance;
        emit Events.GovernanceSet(msg.sender, prevGovernance, newGovernance, block.timestamp);
    }

    function _createPost(
        uint256 profileId,
        string memory contentURI,
        address collectModule,
        bytes memory collectModuleData,
        address referenceModule,
        bytes memory referenceModuleData
    ) internal {
        PublishingLogic.createPost(
            profileId,
            contentURI,
            collectModule,
            collectModuleData,
            referenceModule,
            referenceModuleData,
            ++_profileById[profileId].pubCount,
            _pubByIdByProfile,
            _collectModuleAllowlisted,
            _referenceModuleAllowlisted
        );
    }

    function _createComment(DataTypes.CommentData memory vars) internal {
        PublishingLogic.createComment(
            vars,
            _profileById[vars.profileId].pubCount + 1,
            _profileById,
            _pubByIdByProfile,
            _collectModuleAllowlisted,
            _referenceModuleAllowlisted
        );
        _profileById[vars.profileId].pubCount++;
    }

    function _createMirror(
        uint256 profileId,
        uint256 profileIdPointed,
        uint256 pubIdPointed,
        address referenceModule,
        bytes calldata referenceModuleData
    ) internal {
        PublishingLogic.createMirror(
            profileId,
            profileIdPointed,
            pubIdPointed,
            referenceModule,
            referenceModuleData,
            ++_profileById[profileId].pubCount,
            _pubByIdByProfile,
            _referenceModuleAllowlisted
        );
    }

    function _setDispatcher(uint256 profileId, address dispatcher) internal {
        _dispatcherByProfile[profileId] = dispatcher;
        emit Events.DispatcherSet(profileId, dispatcher, block.timestamp);
    }

    function _setProfileImageURI(uint256 profileId, string memory imageURI) internal {
        _profileById[profileId].imageURI = imageURI;
        emit Events.ProfileImageURISet(profileId, imageURI, block.timestamp);
    }

    function _setFollowNFTURI(uint256 profileId, string memory followNFTURI) internal {
        _profileById[profileId].followNFTURI = followNFTURI;
        emit Events.FollowNFTURISet(profileId, followNFTURI, block.timestamp);
    }

    function _clearHandleHash(uint256 profileId) internal {
        bytes32 handleHash = keccak256(bytes(_profileById[profileId].handle));
        _profileIdByHandleHash[handleHash] = 0;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override {
        if (_dispatcherByProfile[tokenId] != address(0)) {
            _setDispatcher(tokenId, address(0));
        }
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _validateCallerIsProfileOwnerOrDispatcher(uint256 profileId) internal view {
        if (msg.sender != ownerOf(profileId) && msg.sender != _dispatcherByProfile[profileId])
            revert Errors.NotProfileOwnerOrDispatcher();
    }

    function _validateCallerIsProfileOwner(uint256 profileId) internal view {
        if (msg.sender != ownerOf(profileId)) revert Errors.NotProfileOwner();
    }

    function _validateCallerIsGovernance() internal view {
        if (msg.sender != _governance) revert Errors.NotGovernance();
    }

    function _validateCallerIsAllowlistedProfileCreator() internal view {
        if (!_profileCreatorAllowlisted[msg.sender]) revert Errors.ProfileCreatorNotAllowlisted();
    }

    function getRevision() internal pure virtual override returns (uint256) {
        return REVISION;
    }
}
