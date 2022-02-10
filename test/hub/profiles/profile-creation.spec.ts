import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { TokenDataStructOutput } from '../../../typechain-types/LensHub';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { cancelWithPermitForAll, getTimestamp } from '../../helpers/utils';
import {
  FIRST_PROFILE_ID,
  governance,
  lensHub,
  makeSuiteCleanRoom,
  mockFollowModule,
  mockModuleData,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  userAddress,
  userTwo,
  userTwoAddress,
} from '../../__setup.spec';

makeSuiteCleanRoom('Profile Creation', function () {
  context('Generic', function () {
    context('Negatives', function () {
      it('User should fail to create a profile with a handle longer than 31 bytes', async function () {
        const val = '11111111111111111111111111111111';
        expect(val.length).to.eq(32);
        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: val,
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.be.revertedWith(ERRORS.INVALID_HANDLE_LENGTH);
      });

      it('User should fail to create a profile with an empty handle (0 length bytes)', async function () {
        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: '',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.be.revertedWith(ERRORS.INVALID_HANDLE_LENGTH);
      });

      it('User should fail to create a profile with a handle with a capital letter', async function () {
        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: 'Egg',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.be.revertedWith(ERRORS.HANDLE_CONTAINS_INVALID_CHARACTERS);
      });

      it('User should fail to create a profile with a handle with an invalid character', async function () {
        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: 'egg?',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.be.revertedWith(ERRORS.HANDLE_CONTAINS_INVALID_CHARACTERS);
      });

      it('User should fail to create a profile with a unallowlisted follow module', async function () {
        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: userAddress,
            followModuleData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.be.revertedWith(ERRORS.FOLLOW_MODULE_NOT_ALLOWLISTED);
      });

      it('User should fail to create a profile with with invalid follow module data format', async function () {
        await expect(
          lensHub.connect(governance).allowlistFollowModule(mockFollowModule.address, true)
        ).to.not.be.reverted;

        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: mockFollowModule.address,
            followModuleData: [0x12, 0x34],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.be.revertedWith(ERRORS.NO_REASON_ABI_DECODE);
      });

      it('User should fail to createa a profile when they are not a allowlisted profile creator', async function () {
        await expect(
          lensHub.connect(governance).allowlistProfileCreator(userAddress, false)
        ).to.not.be.reverted;

        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.be.revertedWith(ERRORS.PROFILE_CREATOR_NOT_ALLOWLISTED);
      });
    });

    context('Scenarios', function () {
      it('User should be able to create a profile with a handle, receive an NFT and the handle should resolve to the NFT ID, userTwo should do the same', async function () {
        let timestamp: any;
        let owner: string;
        let totalSupply: BigNumber;
        let profileId: BigNumber;
        let mintTimestamp: BigNumber;
        let tokenData: TokenDataStructOutput;

        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.not.be.reverted;

        timestamp = await getTimestamp();
        owner = await lensHub.ownerOf(FIRST_PROFILE_ID);
        totalSupply = await lensHub.totalSupply();
        profileId = await lensHub.getProfileIdByHandle(MOCK_PROFILE_HANDLE);
        mintTimestamp = await lensHub.mintTimestampOf(FIRST_PROFILE_ID);
        tokenData = await lensHub.tokenDataOf(FIRST_PROFILE_ID);
        expect(owner).to.eq(userAddress);
        expect(totalSupply).to.eq(FIRST_PROFILE_ID);
        expect(profileId).to.eq(FIRST_PROFILE_ID);
        expect(mintTimestamp).to.eq(timestamp);
        expect(tokenData.owner).to.eq(userAddress);
        expect(tokenData.mintTimestamp).to.eq(timestamp);

        const secondProfileId = FIRST_PROFILE_ID + 1;
        await expect(
          lensHub.connect(userTwo).createProfile({
            to: userTwoAddress,
            handle: 'test',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.not.be.reverted;

        timestamp = await getTimestamp();
        owner = await lensHub.ownerOf(secondProfileId);
        totalSupply = await lensHub.totalSupply();
        profileId = await lensHub.getProfileIdByHandle('test');
        mintTimestamp = await lensHub.mintTimestampOf(secondProfileId);
        tokenData = await lensHub.tokenDataOf(secondProfileId);
        expect(owner).to.eq(userTwoAddress);
        expect(totalSupply).to.eq(secondProfileId);
        expect(profileId).to.eq(secondProfileId);
        expect(mintTimestamp).to.eq(timestamp);
        expect(tokenData.owner).to.eq(userTwoAddress);
        expect(tokenData.mintTimestamp).to.eq(timestamp);
      });

      it('User should be able to create a profile with a handle 16 bytes long, then fail to create with the same handle, and create again with a different handle', async function () {
        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: '123456789012345',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.not.be.reverted;
        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: '123456789012345',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.be.revertedWith(ERRORS.PROFILE_HANDLE_TAKEN);
        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: 'abcdefghijklmno',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.not.be.reverted;
      });

      it('User should be able to create a profile with a allowlisted follow module', async function () {
        await expect(
          lensHub.connect(governance).allowlistFollowModule(mockFollowModule.address, true)
        ).to.not.be.reverted;

        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: mockFollowModule.address,
            followModuleData: mockModuleData,
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.not.be.reverted;
      });

      it('User should create a profile for userTwo', async function () {
        await expect(
          lensHub.createProfile({
            to: userTwoAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.not.be.reverted;
        expect(await lensHub.ownerOf(FIRST_PROFILE_ID)).to.eq(userTwoAddress);
      });
    });
  });
});
