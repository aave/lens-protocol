import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { cancelWithPermitForAll, getSetDispatcherWithSigParts } from '../../helpers/utils';
import {
  emptyCollectModule,
  FIRST_PROFILE_ID,
  governance,
  lensHub,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  testWallet,
  userAddress,
  userTwo,
  userTwoAddress,
} from '../../__setup.spec';

makeSuiteCleanRoom('Dispatcher Functionality', function () {
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
      await expect(
        lensHub.connect(governance).allowlistCollectModule(emptyCollectModule.address, true)
      ).to.not.be.reverted;
    });

    context('Negatives', function () {
      it('UserTwo should fail to set dispatcher on profile owned by user 1', async function () {
        await expect(
          lensHub.connect(userTwo).setDispatcher(FIRST_PROFILE_ID, userTwoAddress)
        ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER);
      });

      it('UserTwo should fail to publish on profile owned by user 1 without being a dispatcher', async function () {
        await expect(
          lensHub.connect(userTwo).post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: emptyCollectModule.address,
            collectModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER_OR_DISPATCHER);
      });

      it("User should set userTwo as dispatcher, userTwo should fail to set follow module on user's profile", async function () {
        await expect(lensHub.setDispatcher(FIRST_PROFILE_ID, userTwoAddress)).to.not.be.reverted;
        await expect(
          lensHub.connect(userTwo).setFollowModule(FIRST_PROFILE_ID, ZERO_ADDRESS, [])
        ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER);
      });
    });

    context('Scenarios', function () {
      it('User should set user two as a dispatcher on their profile, user two should post, comment and mirror', async function () {
        await expect(lensHub.setDispatcher(FIRST_PROFILE_ID, userTwoAddress)).to.not.be.reverted;

        await expect(
          lensHub.connect(userTwo).post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: emptyCollectModule.address,
            collectModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.not.be.reverted;

        await expect(
          lensHub.connect(userTwo).comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            collectModule: emptyCollectModule.address,
            collectModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.not.be.reverted;

        await expect(
          lensHub.connect(userTwo).mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.not.be.reverted;
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
      await expect(
        lensHub.connect(governance).allowlistCollectModule(emptyCollectModule.address, true)
      ).to.not.be.reverted;
    });

    context('Negatives', function () {
      it('TestWallet should fail to set dispatcher with sig with signature deadline mismatch', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const { v, r, s } = await getSetDispatcherWithSigParts(
          FIRST_PROFILE_ID,
          userTwoAddress,
          nonce,
          '0'
        );

        await expect(
          lensHub.setDispatcherWithSig({
            profileId: FIRST_PROFILE_ID,
            dispatcher: userTwoAddress,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('TestWallet should fail to set dispatcher with sig with invalid deadline', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const { v, r, s } = await getSetDispatcherWithSigParts(
          FIRST_PROFILE_ID,
          userTwoAddress,
          nonce,
          '0'
        );

        await expect(
          lensHub.setDispatcherWithSig({
            profileId: FIRST_PROFILE_ID,
            dispatcher: userTwoAddress,
            sig: {
              v,
              r,
              s,
              deadline: '0',
            },
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_EXPIRED);
      });

      it('TestWallet should fail to set dispatcher with sig with invalid nonce', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const { v, r, s } = await getSetDispatcherWithSigParts(
          FIRST_PROFILE_ID,
          userTwoAddress,
          nonce + 1,
          MAX_UINT256
        );

        await expect(
          lensHub.setDispatcherWithSig({
            profileId: FIRST_PROFILE_ID,
            dispatcher: userTwoAddress,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('TestWallet should sign attempt to set dispatcher with sig, cancel via empty permitForAll, fail to set dispatcher with sig', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const { v, r, s } = await getSetDispatcherWithSigParts(
          FIRST_PROFILE_ID,
          userTwoAddress,
          nonce,
          MAX_UINT256
        );

        await cancelWithPermitForAll();

        await expect(
          lensHub.setDispatcherWithSig({
            profileId: FIRST_PROFILE_ID,
            dispatcher: userTwoAddress,
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
      it('TestWallet should set user two as dispatcher for their profile, user two should post, comment and mirror', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const { v, r, s } = await getSetDispatcherWithSigParts(
          FIRST_PROFILE_ID,
          userTwoAddress,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.setDispatcherWithSig({
            profileId: FIRST_PROFILE_ID,
            dispatcher: userTwoAddress,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.not.be.reverted;

        await expect(
          lensHub.connect(userTwo).post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: emptyCollectModule.address,
            collectModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.not.be.reverted;

        await expect(
          lensHub.connect(userTwo).comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            collectModule: emptyCollectModule.address,
            collectModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.not.be.reverted;

        await expect(
          lensHub.connect(userTwo).mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.not.be.reverted;
      });
    });
  });
});
