// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import 'forge-std/Test.sol';

import {BaseTest} from './BaseTest.t.sol';
import {DataTypes} from '../../contracts/libraries/DataTypes.sol';
import {Errors} from '../../contracts/libraries/Errors.sol';

contract FreeCollectModule is BaseTest {
    function setUp() public override {
        super.setUp();
        vm.prank(user);
        contracts.lensHub.createProfile(
            DataTypes.CreateProfileData({
                to: user,
                handle: MOCK_PROFILE_HANDLE,
                imageURI: MOCK_PROFILE_URI,
                followModule: address(0),
                followModuleInitData: '',
                followNFTURI: MOCK_FOLLOW_NFT_URI
            })
        );
    }

    function testCannotCollectWithoutFollowing() public {
        vm.prank(user);
        contracts.lensHub.post(
            DataTypes.PostData({
                profileId: FIRST_PROFILE_ID,
                contentURI: MOCK_URI,
                collectModule: address(contracts.freeCollectModule),
                collectModuleInitData: abi.encode(true),
                referenceModule: address(0),
                referenceModuleInitData: ''
            })
        );

        vm.prank(userTwo);
        vm.expectRevert(Errors.FollowInvalid.selector);
        contracts.lensHub.collect(FIRST_PROFILE_ID, 1, '');
    }

    function testCannotCollectAfterMirroring() public {
        vm.prank(user);
        contracts.lensHub.post(
            DataTypes.PostData({
                profileId: FIRST_PROFILE_ID,
                contentURI: MOCK_URI,
                collectModule: address(contracts.freeCollectModule),
                collectModuleInitData: abi.encode(true),
                referenceModule: address(0),
                referenceModuleInitData: ''
            })
        );

        uint256 secondProfileId = FIRST_PROFILE_ID + 1;
        vm.startPrank(userTwo);
        contracts.lensHub.createProfile(
            DataTypes.CreateProfileData({
                to: userTwo,
                handle: 'usertwo',
                imageURI: MOCK_PROFILE_URI,
                followModule: address(0),
                followModuleInitData: '',
                followNFTURI: MOCK_FOLLOW_NFT_URI
            })
        );

        contracts.lensHub.mirror(
            DataTypes.MirrorData({
                profileId: secondProfileId,
                profileIdPointed: FIRST_PROFILE_ID,
                pubIdPointed: 1,
                referenceModuleData: '',
                referenceModule: address(0),
                referenceModuleInitData: ''
            })
        );

        vm.expectRevert(Errors.FollowInvalid.selector);
        contracts.lensHub.collect(secondProfileId, 1, '');

        vm.stopPrank();
    }

    function testCanCollectWithoutFollowing() public {
        vm.prank(user);
        contracts.lensHub.post(
            DataTypes.PostData({
                profileId: FIRST_PROFILE_ID,
                contentURI: MOCK_URI,
                collectModule: address(contracts.freeCollectModule),
                collectModuleInitData: abi.encode(false),
                referenceModule: address(0),
                referenceModuleInitData: ''
            })
        );

        vm.prank(userTwo);
        contracts.lensHub.collect(FIRST_PROFILE_ID, 1, '');
    }

    function testCanCollectWhenFollowingAndRequired() public {
        vm.prank(user);
        contracts.lensHub.post(
            DataTypes.PostData({
                profileId: FIRST_PROFILE_ID,
                contentURI: MOCK_URI,
                collectModule: address(contracts.freeCollectModule),
                collectModuleInitData: abi.encode(true),
                referenceModule: address(0),
                referenceModuleInitData: ''
            })
        );

        uint256[] memory profileIds = new uint256[](1);
        profileIds[0] = FIRST_PROFILE_ID;

        bytes[] memory data = new bytes[](1);
        data[0] = '';

        vm.startPrank(userTwo);
        contracts.lensHub.follow(profileIds, data);
        contracts.lensHub.collect(FIRST_PROFILE_ID, 1, '');
        vm.stopPrank();
    }

    function testCanCollectWhenFollowingAccordingToFollowModuleSet() public {
        vm.startPrank(user);
        contracts.lensHub.post(
            DataTypes.PostData({
                profileId: FIRST_PROFILE_ID,
                contentURI: MOCK_URI,
                collectModule: address(contracts.freeCollectModule),
                collectModuleInitData: abi.encode(true),
                referenceModule: address(0),
                referenceModuleInitData: ''
            })
        );

        contracts.lensHub.setFollowModule(
            FIRST_PROFILE_ID,
            address(contracts.approvalFollowModule),
            ''
        );

        address[] memory addresses = new address[](1);
        addresses[0] = userTwo;

        bool[] memory toApprove = new bool[](1);
        toApprove[0] = true;

        contracts.approvalFollowModule.approve(FIRST_PROFILE_ID, addresses, toApprove);

        vm.stopPrank();

        uint256[] memory profileIds = new uint256[](1);
        profileIds[0] = FIRST_PROFILE_ID;

        bytes[] memory data = new bytes[](1);
        data[0] = '';

        vm.startPrank(userTwo);
        contracts.lensHub.follow(profileIds, data);
        contracts.lensHub.collect(FIRST_PROFILE_ID, 1, '');
        vm.stopPrank();
    }

    function testCanMirrorAndCollectWhenFollowing() public {
        vm.prank(user);
        contracts.lensHub.post(
            DataTypes.PostData({
                profileId: FIRST_PROFILE_ID,
                contentURI: MOCK_URI,
                collectModule: address(contracts.freeCollectModule),
                collectModuleInitData: abi.encode(true),
                referenceModule: address(0),
                referenceModuleInitData: ''
            })
        );

        uint256[] memory profileIds = new uint256[](1);
        profileIds[0] = FIRST_PROFILE_ID;

        bytes[] memory data = new bytes[](1);
        data[0] = '';

        uint256 secondProfileId = FIRST_PROFILE_ID + 1;
        vm.startPrank(userTwo);
        contracts.lensHub.follow(profileIds, data);
        contracts.lensHub.createProfile(
            DataTypes.CreateProfileData({
                to: userTwo,
                handle: 'usertwo',
                imageURI: MOCK_PROFILE_URI,
                followModule: address(0),
                followModuleInitData: '',
                followNFTURI: MOCK_FOLLOW_NFT_URI
            })
        );

        contracts.lensHub.mirror(
            DataTypes.MirrorData({
                profileId: secondProfileId,
                profileIdPointed: FIRST_PROFILE_ID,
                pubIdPointed: 1,
                referenceModuleData: '',
                referenceModule: address(0),
                referenceModuleInitData: ''
            })
        );

        contracts.lensHub.collect(secondProfileId, 1, '');

        vm.stopPrank();
    }
}
