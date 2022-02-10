import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { cancelWithPermitForAll, getSetFollowModuleWithSigParts } from '../../helpers/utils';
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
  testWallet,
  userAddress,
  userTwo,
} from '../../__setup.spec';

makeSuiteCleanRoom('Setting Follow Module', function () {
  context('Generic', function () {
    beforeEach(async function () {
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
    });

    context('Negatives', function () {
      it('UserTwo should fail to set the follow module for the profile owned by User', async function () {
        await expect(
          lensHub.connect(userTwo).setFollowModule(FIRST_PROFILE_ID, userAddress, [])
        ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER);
      });

      it('User should fail to set a follow module that is not allowlisted', async function () {
        await expect(lensHub.setFollowModule(FIRST_PROFILE_ID, userAddress, [])).to.be.revertedWith(
          ERRORS.FOLLOW_MODULE_NOT_ALLOWLISTED
        );
      });

      it('User should fail to set a follow module with invalid follow module data format', async function () {
        await expect(
          lensHub.connect(governance).allowlistFollowModule(mockFollowModule.address, true)
        ).to.not.be.reverted;

        await expect(
          lensHub.setFollowModule(FIRST_PROFILE_ID, mockFollowModule.address, [0x12, 0x34])
        ).to.be.revertedWith(ERRORS.NO_REASON_ABI_DECODE);
      });
    });

    context('Scenarios', function () {
      it('User should set a allowlisted follow module, fetching the profile follow module should return the correct address, user then sets it to the zero address and fetching returns the zero address', async function () {
        await expect(
          lensHub.connect(governance).allowlistFollowModule(mockFollowModule.address, true)
        ).to.not.be.reverted;

        await expect(
          lensHub.setFollowModule(FIRST_PROFILE_ID, mockFollowModule.address, mockModuleData)
        ).to.not.be.reverted;
        expect(await lensHub.getFollowModule(FIRST_PROFILE_ID)).to.eq(mockFollowModule.address);

        await expect(
          lensHub.setFollowModule(FIRST_PROFILE_ID, ZERO_ADDRESS, [])
        ).to.not.be.reverted;
        expect(await lensHub.getFollowModule(FIRST_PROFILE_ID)).to.eq(ZERO_ADDRESS);
      });
    });
  });

  context('Meta-tx', function () {
    beforeEach(async function () {
      await expect(
        lensHub.connect(testWallet).createProfile({
          to: testWallet.address,
          handle: MOCK_PROFILE_HANDLE,
          imageURI: MOCK_PROFILE_URI,
          followModule: ZERO_ADDRESS,
          followModuleData: [],
          followNFTURI: MOCK_FOLLOW_NFT_URI,
        })
      ).to.not.be.reverted;
    });

    context('Negatives', function () {
      it('TestWallet should fail to set a follow module with sig with signature deadline mismatch', async function () {
        await expect(
          lensHub.connect(governance).allowlistFollowModule(mockFollowModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const followModuleData = [];

        const { v, r, s } = await getSetFollowModuleWithSigParts(
          FIRST_PROFILE_ID,
          mockFollowModule.address,
          followModuleData,
          nonce,
          '0'
        );

        await expect(
          lensHub.setFollowModuleWithSig({
            profileId: FIRST_PROFILE_ID,
            followModule: mockFollowModule.address,
            followModuleData: followModuleData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('TestWallet should fail to set a follow module with sig with invalid deadline', async function () {
        await expect(
          lensHub.connect(governance).allowlistFollowModule(mockFollowModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const followModuleData = [];

        const { v, r, s } = await getSetFollowModuleWithSigParts(
          FIRST_PROFILE_ID,
          mockFollowModule.address,
          followModuleData,
          nonce,
          '0'
        );

        await expect(
          lensHub.setFollowModuleWithSig({
            profileId: FIRST_PROFILE_ID,
            followModule: mockFollowModule.address,
            followModuleData: followModuleData,
            sig: {
              v,
              r,
              s,
              deadline: '0',
            },
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_EXPIRED);
      });

      it('TestWallet should fail to set a follow module with sig with invalid nonce', async function () {
        await expect(
          lensHub.connect(governance).allowlistFollowModule(mockFollowModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const followModuleData = [];

        const { v, r, s } = await getSetFollowModuleWithSigParts(
          FIRST_PROFILE_ID,
          mockFollowModule.address,
          followModuleData,
          nonce + 1,
          MAX_UINT256
        );

        await expect(
          lensHub.setFollowModuleWithSig({
            profileId: FIRST_PROFILE_ID,
            followModule: mockFollowModule.address,
            followModuleData: followModuleData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('TestWallet should fail to set a follow module with sig with an unallowlisted follow module', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const followModuleData = [];

        const { v, r, s } = await getSetFollowModuleWithSigParts(
          FIRST_PROFILE_ID,
          mockFollowModule.address,
          followModuleData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.setFollowModuleWithSig({
            profileId: FIRST_PROFILE_ID,
            followModule: mockFollowModule.address,
            followModuleData: followModuleData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.FOLLOW_MODULE_NOT_ALLOWLISTED);
      });

      it('TestWallet should sign attempt to set follow module with sig, then cancel with empty permitForAll, then fail to set follow module with sig', async function () {
        await expect(
          lensHub.connect(governance).allowlistFollowModule(mockFollowModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getSetFollowModuleWithSigParts(
          FIRST_PROFILE_ID,
          mockFollowModule.address,
          mockModuleData,
          nonce,
          MAX_UINT256
        );

        await cancelWithPermitForAll();

        await expect(
          lensHub.setFollowModuleWithSig({
            profileId: FIRST_PROFILE_ID,
            followModule: mockFollowModule.address,
            followModuleData: mockModuleData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });
    });

    context('Scenarios', function () {
      it('TestWallet should set a allowlisted follow module with sig, fetching the profile follow module should return the correct address', async function () {
        await expect(
          lensHub.connect(governance).allowlistFollowModule(mockFollowModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getSetFollowModuleWithSigParts(
          FIRST_PROFILE_ID,
          mockFollowModule.address,
          mockModuleData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.setFollowModuleWithSig({
            profileId: FIRST_PROFILE_ID,
            followModule: mockFollowModule.address,
            followModuleData: mockModuleData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.not.be.reverted;

        expect(await lensHub.getFollowModule(FIRST_PROFILE_ID)).to.eq(mockFollowModule.address);
      });
    });
  });
});
