import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { cancelWithPermitForAll, getMirrorWithSigParts } from '../../helpers/utils';
import {
  abiCoder,
  emptyCollectModule,
  FIRST_PROFILE_ID,
  governance,
  lensHub,
  makeSuiteCleanRoom,
  mockReferenceModule,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  testWallet,
  userAddress,
  userTwo,
} from '../../__setup.spec';

makeSuiteCleanRoom('Publishing mirrors', function () {
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

      await expect(
        lensHub.connect(governance).allowlistReferenceModule(mockReferenceModule.address, true)
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
    });

    context('Negatives', function () {
      it('UserTwo should fail to publish a mirror to a profile owned by User', async function () {
        await expect(
          lensHub.connect(userTwo).mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER_OR_DISPATCHER);
      });

      it('User should fail to mirror with an unallowlisted reference module', async function () {
        await expect(
          lensHub.mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModule: userAddress,
            referenceModuleData: [],
          })
        ).to.be.revertedWith(ERRORS.REFERENCE_MODULE_NOT_ALLOWLISTED);
      });

      it('User should fail to mirror with invalid reference module data format', async function () {
        await expect(
          lensHub.mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModule: mockReferenceModule.address,
            referenceModuleData: [0x12, 0x23],
          })
        ).to.be.revertedWith(ERRORS.NO_REASON_ABI_DECODE);
      });

      it('User should fail to mirror a publication that does not exist', async function () {
        await expect(
          lensHub.mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 2,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.be.revertedWith(ERRORS.PUBLICATION_DOES_NOT_EXIST);
      });
    });

    context('Scenarios', function () {
      it('User should create a mirror with empty reference module and reference module data, fetched mirror data should be accurate', async function () {
        await expect(
          lensHub.mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.not.be.reverted;

        const pub = await lensHub.getPub(FIRST_PROFILE_ID, 2);
        expect(pub.profileIdPointed).to.eq(FIRST_PROFILE_ID);
        expect(pub.pubIdPointed).to.eq(1);
        expect(pub.contentURI).to.eq('');
        expect(pub.collectModule).to.eq(ZERO_ADDRESS);
        expect(pub.collectNFT).to.eq(ZERO_ADDRESS);
        expect(pub.referenceModule).to.eq(ZERO_ADDRESS);
      });

      it('User should mirror a mirror with empty reference module and reference module data, fetched mirror data should be accurate and point to the original post', async function () {
        await expect(
          lensHub.mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.not.be.reverted;

        await expect(
          lensHub.mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 2,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.not.be.reverted;

        const pub = await lensHub.getPub(FIRST_PROFILE_ID, 3);
        expect(pub.profileIdPointed).to.eq(FIRST_PROFILE_ID);
        expect(pub.pubIdPointed).to.eq(1);
        expect(pub.contentURI).to.eq('');
        expect(pub.collectModule).to.eq(ZERO_ADDRESS);
        expect(pub.collectNFT).to.eq(ZERO_ADDRESS);
        expect(pub.referenceModule).to.eq(ZERO_ADDRESS);
      });

      it('User should create a post using the mock reference module as reference module, then mirror that post', async function () {
        const data = abiCoder.encode(['uint256'], ['1']);
        await expect(
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: emptyCollectModule.address,
            collectModuleData: [],
            referenceModule: mockReferenceModule.address,
            referenceModuleData: data,
          })
        ).to.not.be.reverted;

        await expect(
          lensHub.mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 2,
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

      await expect(
        lensHub.connect(testWallet).post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: emptyCollectModule.address,
          collectModuleData: [],
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;
    });

    context('Negatives', function () {
      it('Testwallet should fail to mirror with sig with signature deadline mismatch', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const referenceModuleData = [];

        const { v, r, s } = await getMirrorWithSigParts(
          FIRST_PROFILE_ID,
          FIRST_PROFILE_ID,
          '1',
          ZERO_ADDRESS,
          referenceModuleData,
          nonce,
          '0'
        );

        await expect(
          lensHub.mirrorWithSig({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '1',
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

      it('Testwallet should fail to mirror with sig with invalid deadline', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const referenceModuleData = [];

        const { v, r, s } = await getMirrorWithSigParts(
          FIRST_PROFILE_ID,
          FIRST_PROFILE_ID,
          '1',
          ZERO_ADDRESS,
          referenceModuleData,
          nonce,
          '0'
        );

        await expect(
          lensHub.mirrorWithSig({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '1',
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

      it('Testwallet should fail to mirror with sig with invalid deadline', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const referenceModuleData = [];

        const { v, r, s } = await getMirrorWithSigParts(
          FIRST_PROFILE_ID,
          FIRST_PROFILE_ID,
          '1',
          ZERO_ADDRESS,
          referenceModuleData,
          nonce + 1,
          MAX_UINT256
        );

        await expect(
          lensHub.mirrorWithSig({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '1',
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

      it('Testwallet should fail to mirror with sig with unallowlisted reference module', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const referenceModuleData = [];

        const { v, r, s } = await getMirrorWithSigParts(
          FIRST_PROFILE_ID,
          FIRST_PROFILE_ID,
          '1',
          userAddress,
          referenceModuleData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.mirrorWithSig({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '1',
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

      it('TestWallet should fail to mirror a publication with sig that does not exist yet', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const referenceModuleData = [];

        const { v, r, s } = await getMirrorWithSigParts(
          FIRST_PROFILE_ID,
          FIRST_PROFILE_ID,
          '2',
          ZERO_ADDRESS,
          referenceModuleData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.mirrorWithSig({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '2',
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: referenceModuleData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.PUBLICATION_DOES_NOT_EXIST);
      });

      it('TestWallet should sign attempt to mirror with sig, cancel via empty permitForAll, then fail to mirror with sig', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const referenceModuleData = [];

        const { v, r, s } = await getMirrorWithSigParts(
          FIRST_PROFILE_ID,
          FIRST_PROFILE_ID,
          '1',
          ZERO_ADDRESS,
          referenceModuleData,
          nonce,
          MAX_UINT256
        );

        await cancelWithPermitForAll();

        await expect(
          lensHub.mirrorWithSig({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '1',
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
      it('Testwallet should mirror with sig, fetched mirror data should be accurate', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const referenceModuleData = [];

        const { v, r, s } = await getMirrorWithSigParts(
          FIRST_PROFILE_ID,
          FIRST_PROFILE_ID,
          '1',
          ZERO_ADDRESS,
          referenceModuleData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.mirrorWithSig({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '1',
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

        const pub = await lensHub.getPub(FIRST_PROFILE_ID, 2);
        expect(pub.profileIdPointed).to.eq(FIRST_PROFILE_ID);
        expect(pub.pubIdPointed).to.eq(1);
        expect(pub.contentURI).to.eq('');
        expect(pub.collectModule).to.eq(ZERO_ADDRESS);
        expect(pub.collectNFT).to.eq(ZERO_ADDRESS);
        expect(pub.referenceModule).to.eq(ZERO_ADDRESS);
      });

      it('TestWallet should mirror a mirror with sig, fetched mirror data should be accurate', async function () {
        await expect(
          lensHub.connect(testWallet).mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const referenceModuleData = [];

        const { v, r, s } = await getMirrorWithSigParts(
          FIRST_PROFILE_ID,
          FIRST_PROFILE_ID,
          '2',
          ZERO_ADDRESS,
          referenceModuleData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.mirrorWithSig({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '2',
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

        const pub = await lensHub.getPub(FIRST_PROFILE_ID, 3);
        expect(pub.profileIdPointed).to.eq(FIRST_PROFILE_ID);
        expect(pub.pubIdPointed).to.eq(1);
        expect(pub.contentURI).to.eq('');
        expect(pub.collectModule).to.eq(ZERO_ADDRESS);
        expect(pub.collectNFT).to.eq(ZERO_ADDRESS);
        expect(pub.referenceModule).to.eq(ZERO_ADDRESS);
      });
    });
  });
});
