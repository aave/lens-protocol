import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { cancelWithPermitForAll, getPostWithSigParts } from '../../helpers/utils';
import {
  emptyCollectModule,
  FIRST_PROFILE_ID,
  governance,
  lensHub,
  makeSuiteCleanRoom,
  mockModuleData,
  mockReferenceModule,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  testWallet,
  timedFeeCollectModule,
  userAddress,
  userTwo,
} from '../../__setup.spec';

makeSuiteCleanRoom('Publishing Posts', function () {
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
      it('UserTwo should fail to post to a profile owned by User', async function () {
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

      it('User should fail to post with an unallowlisted collect module', async function () {
        await expect(
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: emptyCollectModule.address,
            collectModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.be.revertedWith(ERRORS.COLLECT_MODULE_NOT_ALLOWLISTED);
      });

      it('User should fail to post with an unallowlisted reference module', async function () {
        await expect(
          lensHub.connect(governance).allowlistCollectModule(emptyCollectModule.address, true)
        ).to.not.be.reverted;

        await expect(
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: emptyCollectModule.address,
            collectModuleData: [],
            referenceModule: userAddress,
            referenceModuleData: [],
          })
        ).to.be.revertedWith(ERRORS.REFERENCE_MODULE_NOT_ALLOWLISTED);
      });

      it('User should fail to post with invalid collect module data format', async function () {
        await expect(
          lensHub.connect(governance).allowlistCollectModule(timedFeeCollectModule.address, true)
        ).to.not.be.reverted;

        await expect(
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: timedFeeCollectModule.address,
            collectModuleData: [0x12, 0x34],
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.be.revertedWith(ERRORS.NO_REASON_ABI_DECODE);
      });

      it('User should fail to post with invalid reference module data format', async function () {
        await expect(
          lensHub.connect(governance).allowlistCollectModule(emptyCollectModule.address, true)
        ).to.not.be.reverted;

        await expect(
          lensHub.connect(governance).allowlistReferenceModule(mockReferenceModule.address, true)
        ).to.not.be.reverted;

        await expect(
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: emptyCollectModule.address,
            collectModuleData: [],
            referenceModule: mockReferenceModule.address,
            referenceModuleData: [0x12, 0x23],
          })
        ).to.be.revertedWith(ERRORS.NO_REASON_ABI_DECODE);
      });
    });

    context('Scenarios', function () {
      it('User should create a post with empty collect and reference module data, fetched post data should be accurate', async function () {
        await expect(
          lensHub.connect(governance).allowlistCollectModule(emptyCollectModule.address, true)
        ).to.not.be.reverted;

        await expect(
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: emptyCollectModule.address,
            collectModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.not.be.reverted;

        const pub = await lensHub.getPub(FIRST_PROFILE_ID, 1);
        expect(pub.profileIdPointed).to.eq(0);
        expect(pub.pubIdPointed).to.eq(0);
        expect(pub.contentURI).to.eq(MOCK_URI);
        expect(pub.collectModule).to.eq(emptyCollectModule.address);
        expect(pub.collectNFT).to.eq(ZERO_ADDRESS);
        expect(pub.referenceModule).to.eq(ZERO_ADDRESS);
      });

      it('User should create a post with a allowlisted collect and reference module', async function () {
        await expect(
          lensHub.connect(governance).allowlistReferenceModule(mockReferenceModule.address, true)
        ).to.not.be.reverted;
        await expect(
          lensHub.connect(governance).allowlistCollectModule(emptyCollectModule.address, true)
        ).to.not.be.reverted;

        await expect(
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: emptyCollectModule.address,
            collectModuleData: [],
            referenceModule: mockReferenceModule.address,
            referenceModuleData: mockModuleData,
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
    });

    context('Negatives', function () {
      it('Testwallet should fail to post with sig with signature deadline mismatch', async function () {
        await expect(
          lensHub.connect(governance).allowlistCollectModule(emptyCollectModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getPostWithSigParts(
          FIRST_PROFILE_ID,
          MOCK_URI,
          ZERO_ADDRESS,
          collectModuleData,
          ZERO_ADDRESS,
          referenceModuleData,
          nonce,
          '0'
        );

        await expect(
          lensHub.postWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: ZERO_ADDRESS,
            collectModuleData: collectModuleData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: referenceModuleData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('Testwallet should fail to post with sig with invalid deadline', async function () {
        await expect(
          lensHub.connect(governance).allowlistCollectModule(emptyCollectModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getPostWithSigParts(
          FIRST_PROFILE_ID,
          MOCK_URI,
          ZERO_ADDRESS,
          collectModuleData,
          ZERO_ADDRESS,
          referenceModuleData,
          nonce,
          '0'
        );

        await expect(
          lensHub.postWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: ZERO_ADDRESS,
            collectModuleData: collectModuleData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: referenceModuleData,
            sig: {
              v,
              r,
              s,
              deadline: '0',
            },
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_EXPIRED);
      });

      it('Testwallet should fail to post with sig with invalid nonce', async function () {
        await expect(
          lensHub.connect(governance).allowlistCollectModule(emptyCollectModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getPostWithSigParts(
          FIRST_PROFILE_ID,
          MOCK_URI,
          ZERO_ADDRESS,
          collectModuleData,
          ZERO_ADDRESS,
          referenceModuleData,
          nonce + 1,
          MAX_UINT256
        );

        await expect(
          lensHub.postWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: userAddress,
            collectModuleData: collectModuleData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: referenceModuleData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('Testwallet should fail to post with sig with an unallowlisted collect module', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getPostWithSigParts(
          FIRST_PROFILE_ID,
          MOCK_URI,
          userAddress,
          collectModuleData,
          ZERO_ADDRESS,
          referenceModuleData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.postWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: userAddress,
            collectModuleData: collectModuleData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: referenceModuleData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.COLLECT_MODULE_NOT_ALLOWLISTED);
      });

      it('Testwallet should fail to post with sig with an unallowlisted reference module', async function () {
        await expect(
          lensHub.connect(governance).allowlistCollectModule(emptyCollectModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getPostWithSigParts(
          FIRST_PROFILE_ID,
          MOCK_URI,
          emptyCollectModule.address,
          collectModuleData,
          userAddress,
          referenceModuleData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.postWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: emptyCollectModule.address,
            collectModuleData: collectModuleData,
            referenceModule: userAddress,
            referenceModuleData: referenceModuleData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.REFERENCE_MODULE_NOT_ALLOWLISTED);
      });

      it('TestWallet should sign attempt to post with sig, cancel via empty permitForAll, then fail to post with sig', async function () {
        await expect(
          lensHub.connect(governance).allowlistCollectModule(emptyCollectModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getPostWithSigParts(
          FIRST_PROFILE_ID,
          MOCK_URI,
          emptyCollectModule.address,
          collectModuleData,
          ZERO_ADDRESS,
          referenceModuleData,
          nonce,
          MAX_UINT256
        );

        await cancelWithPermitForAll();

        await expect(
          lensHub.postWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: emptyCollectModule.address,
            collectModuleData: collectModuleData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: referenceModuleData,
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
      it('TestWallet should post with sig, fetched post data should be accurate', async function () {
        await expect(
          lensHub.connect(governance).allowlistCollectModule(emptyCollectModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getPostWithSigParts(
          FIRST_PROFILE_ID,
          MOCK_URI,
          emptyCollectModule.address,
          collectModuleData,
          ZERO_ADDRESS,
          referenceModuleData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.postWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: emptyCollectModule.address,
            collectModuleData: collectModuleData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: referenceModuleData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.not.be.reverted;

        const pub = await lensHub.getPub(FIRST_PROFILE_ID, 1);
        expect(pub.profileIdPointed).to.eq(0);
        expect(pub.pubIdPointed).to.eq(0);
        expect(pub.contentURI).to.eq(MOCK_URI);
        expect(pub.collectModule).to.eq(emptyCollectModule.address);
        expect(pub.collectNFT).to.eq(ZERO_ADDRESS);
        expect(pub.referenceModule).to.eq(ZERO_ADDRESS);
      });
    });
  });
});
