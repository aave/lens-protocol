// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import {DataTypes} from '../libraries/DataTypes.sol';

contract MockLensHubV2Storage {
    bytes32 internal constant CREATE_PROFILE_WITH_SIG_TYPEHASH =
        0x9ac3269d9abd6f8c5e850e07f21b199079e8a5cc4a55466d8c96ab0c4a5be403;
    // keccak256(
    // 'CreateProfileWithSig(string handle,string uri,address followModule,bytes followModuleData,uint256 nonce,uint256 deadline)'
    // );
    bytes32 internal constant SET_FOLLOW_MODULE_WITH_SIG_TYPEHASH =
        0x6f3f6455a608af1cc57ef3e5c0a49deeb88bba264ec8865b798ff07358859d4b;
    // keccak256(
    // 'SetFollowModuleWithSig(uint256 profileId,address followModule,bytes followModuleData,uint256 nonce,uint256 deadline)'
    // );
    bytes32 internal constant SET_DISPATCHER_WITH_SIG_TYPEHASH =
        0x77ba3e9f5fa75343bbad1241fb539a0064de97694b47d463d1eb5c54aba11f0f;
    // keccak256(
    // 'SetDispatcherWithSig(uint256 profileId,address dispatcher,uint256 nonce,uint256 deadline)'
    // );
    bytes32 internal constant SET_PROFILE_IMAGE_URI_WITH_SIG_TYPEHASH =
        0x5b9860bd835e648945b22d053515bc1f53b7d9fab4b23b1b49db15722e945d14;
    // keccak256(
    // 'SetProfileImageURIWithSig(uint256 profileId,string imageURI,uint256 nonce,uint256 deadline)'
    // );
    bytes32 internal constant POST_WITH_SIG_TYPEHASH =
        0xfb8f057542e7551386ead0b891a45f102af78c47f8cc58b4a919c7cfeccd0e1e;
    // keccak256(
    // 'PostWithSig(uint256 profileId,string contentURI,address collectModule,bytes collectModuleData,address referenceModule,bytes referenceModuleData,uint256 nonce,uint256 deadline)'
    // );
    bytes32 internal constant COMMENT_WITH_SIG_TYPEHASH =
        0xb30910150df56294e05b2d03e181803697a2b935abb1b9bdddde9310f618fe9b;
    // keccak256(
    // 'CommentWithSig(uint256 profileId,string contentURI,uint256 profileIdPointed,uint256 pubIdPointed,address collectModule,bytes collectModuleData,address referenceModule,bytes referenceModuleData,uint256 nonce,uint256 deadline)'
    // );
    bytes32 internal constant MIRROR_WITH_SIG_TYPEHASH =
        0x64f4578fc098f96a2450fbe601cb8c5318ebeb2ff72d2031a36be1ff6932d5ee;
    // keccak256(
    // 'MirrorWithSig(uint256 profileId,uint256 profileIdPointed,uint256 pubIdPointed,address referenceModule,bytes referenceModuleData,uint256 nonce,uint256 deadline)'
    // );
    bytes32 internal constant FOLLOW_WITH_SIG_TYPEHASH =
        0xfb6b7f1cd1b38daf3822aff0abbe78124db5d62a4748bcff007c15ccd6d30bc5;
    // keccak256(
    // 'FollowWithSig(uint256[] profileIds,bytes[] datas,uint256 nonce,uint256 deadline)'
    // );
    bytes32 internal constant COLLECT_WITH_SIG_TYPEHASH =
        0x7f9b4ea1fc678b4fda1611ac5cbd28f339e235d89b1540635e9b2e0223a3c101;
    // keccak256(
    // 'CollectWithSig(uint256 profileId,uint256 pubId,bytes data,uint256 nonce,uint256 deadline)'
    // );

    mapping(address => bool) internal _followModuleWhitelisted;
    mapping(address => bool) internal _collectModuleWhitelisted;
    mapping(address => bool) internal _referenceModuleWhitelisted;

    mapping(uint256 => address) internal _dispatcherByProfile;
    mapping(bytes32 => uint256) internal _profileIdByHandleHash;
    mapping(uint256 => DataTypes.ProfileStruct) internal _profileById;
    mapping(uint256 => mapping(uint256 => DataTypes.PublicationStruct)) internal _pubByIdByProfile;

    mapping(address => uint256) internal _defaultProfileByAddress;

    uint256 internal _profileCounter;
    address internal _governance;
    address internal _emergencyAdmin;
    uint256 internal _additionalValue;
}
