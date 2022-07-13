import '@nomiclabs/hardhat-ethers';
import hre from 'hardhat';
import { expect } from 'chai';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import {
  cancelWithPermitForAll,
  commentReturningTokenId,
  getCommentWithSigParts,
} from '../../helpers/utils';
import {
  abiCoder,
  freeCollectModule,
  FIRST_PROFILE_ID,
  governance,
  lensHub,
  makeSuiteCleanRoom,
  mockReferenceModule,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  OTHER_MOCK_URI,
  testWallet,
  timedFeeCollectModule,
  userAddress,
  userTwo,
  userTwoAddress,
} from '../../__setup.spec';

makeSuiteCleanRoom('Publishing Comments', function () {
  context('Generic', function () {
    beforeEach(async function () {
      await expect(
        lensHub.createProfile({
          to: userAddress,
          handle: MOCK_PROFILE_HANDLE,
          imageURI: MOCK_PROFILE_URI,
          followModule: ZERO_ADDRESS,
          followModuleInitData: [],
          followNFTURI: MOCK_FOLLOW_NFT_URI,
        })
      ).to.not.be.reverted;

      await expect(
        lensHub.connect(governance).whitelistCollectModule(freeCollectModule.address, true)
      ).to.not.be.reverted;

      await expect(
        lensHub.connect(governance).whitelistCollectModule(timedFeeCollectModule.address, true)
      ).to.not.be.reverted;

      await expect(
        lensHub.connect(governance).whitelistReferenceModule(mockReferenceModule.address, true)
      ).to.not.be.reverted;

      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: freeCollectModule.address,
          collectModuleInitData: abiCoder.encode(['bool'], [true]),
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;
    });

    context('Negatives', function () {
      it('UserTwo should fail to publish a comment to a profile owned by User', async function () {
        await expect(
          lensHub.connect(userTwo).comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            collectModule: ZERO_ADDRESS,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER_OR_DISPATCHER);
      });

      it('User should fail to comment with an unwhitelisted collect module', async function () {
        await expect(
          lensHub.comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            collectModule: ZERO_ADDRESS,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.COLLECT_MODULE_NOT_WHITELISTED);
      });

      it('User should fail to comment with an unwhitelisted reference module', async function () {
        await expect(
          lensHub.comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            collectModule: freeCollectModule.address,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            referenceModule: userAddress,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.REFERENCE_MODULE_NOT_WHITELISTED);
      });

      it('User should fail to comment with invalid collect module data format', async function () {
        await expect(
          lensHub.comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            collectModule: timedFeeCollectModule.address,
            collectModuleInitData: [0x2, 0x12, 0x20],
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.NO_REASON_ABI_DECODE);
      });

      it('User should fail to comment with invalid reference module data format', async function () {
        await expect(
          lensHub.comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            collectModule: freeCollectModule.address,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            referenceModule: mockReferenceModule.address,
            referenceModuleInitData: [0x12, 0x23],
          })
        ).to.be.revertedWith(ERRORS.NO_REASON_ABI_DECODE);
      });

      it('User should fail to comment on a publication that does not exist', async function () {
        await expect(
          lensHub.comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 3,
            collectModule: freeCollectModule.address,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.PUBLICATION_DOES_NOT_EXIST);
      });

      it('User should fail to comment on the same comment they are creating (pubId = 2, commentCeption)', async function () {
        await expect(
          lensHub.comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 2,
            collectModule: freeCollectModule.address,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.CANNOT_COMMENT_ON_SELF);
      });
    });

    context('Scenarios', function () {
      it('User should create a comment with empty collect module data, reference module, and reference module data, fetched comment data should be accurate', async function () {
        await expect(
          lensHub.comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            collectModule: freeCollectModule.address,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        const pub = await lensHub.getPub(FIRST_PROFILE_ID, 2);
        expect(pub.profileIdPointed).to.eq(FIRST_PROFILE_ID);
        expect(pub.pubIdPointed).to.eq(1);
        expect(pub.contentURI).to.eq(MOCK_URI);
        expect(pub.collectModule).to.eq(freeCollectModule.address);
        expect(pub.collectNFT).to.eq(ZERO_ADDRESS);
        expect(pub.referenceModule).to.eq(ZERO_ADDRESS);
      });

      it('Should return the expected token IDs when commenting publications', async function () {
        await expect(
          lensHub.connect(testWallet).createProfile({
            to: testWallet.address,
            handle: 'testwallet',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.not.be.reverted;
        await expect(
          lensHub.connect(testWallet).createProfile({
            to: userTwoAddress,
            handle: 'usertwo',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleInitData = abiCoder.encode(['bool'], [true]);
        const referenceModuleInitData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getCommentWithSigParts(
          FIRST_PROFILE_ID + 1,
          OTHER_MOCK_URI,
          FIRST_PROFILE_ID,
          '1',
          referenceModuleData,
          freeCollectModule.address,
          collectModuleInitData,
          ZERO_ADDRESS,
          referenceModuleInitData,
          nonce,
          MAX_UINT256
        );
        expect(
          await commentReturningTokenId({
            vars: {
              profileId: FIRST_PROFILE_ID + 1,
              contentURI: OTHER_MOCK_URI,
              profileIdPointed: FIRST_PROFILE_ID,
              pubIdPointed: '1',
              collectModule: freeCollectModule.address,
              collectModuleInitData: collectModuleInitData,
              referenceModuleData: [],
              referenceModule: ZERO_ADDRESS,
              referenceModuleInitData: referenceModuleInitData,
              sig: {
                v,
                r,
                s,
                deadline: MAX_UINT256,
              },
            },
          })
        ).to.eq(1);

        expect(
          await commentReturningTokenId({
            sender: userTwo,
            vars: {
              profileId: FIRST_PROFILE_ID + 2,
              contentURI: MOCK_URI,
              profileIdPointed: FIRST_PROFILE_ID,
              pubIdPointed: 1,
              collectModule: freeCollectModule.address,
              collectModuleInitData: collectModuleInitData,
              referenceModuleData: [],
              referenceModule: ZERO_ADDRESS,
              referenceModuleInitData: referenceModuleInitData,
            },
          })
        ).to.eq(1);

        expect(
          await commentReturningTokenId({
            sender: testWallet,
            vars: {
              profileId: FIRST_PROFILE_ID + 1,
              contentURI: MOCK_URI,
              profileIdPointed: FIRST_PROFILE_ID,
              pubIdPointed: 1,
              collectModule: freeCollectModule.address,
              collectModuleInitData: collectModuleInitData,
              referenceModuleData: [],
              referenceModule: ZERO_ADDRESS,
              referenceModuleInitData: referenceModuleInitData,
            },
          })
        ).to.eq(2);

        expect(
          await commentReturningTokenId({
            vars: {
              profileId: FIRST_PROFILE_ID,
              contentURI: MOCK_URI,
              profileIdPointed: FIRST_PROFILE_ID,
              pubIdPointed: 1,
              collectModule: freeCollectModule.address,
              collectModuleInitData: collectModuleInitData,
              referenceModuleData: [],
              referenceModule: ZERO_ADDRESS,
              referenceModuleInitData: referenceModuleInitData,
            },
          })
        ).to.eq(2);
      });

      it('User should create a post using the mock reference module as reference module, then comment on that post', async function () {
        const data = abiCoder.encode(['uint256'], ['1']);
        await expect(
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: freeCollectModule.address,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            referenceModule: mockReferenceModule.address,
            referenceModuleInitData: data,
          })
        ).to.not.be.reverted;

        await expect(
          lensHub.comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: freeCollectModule.address,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 2,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
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
          followModuleInitData: [],
          followNFTURI: MOCK_FOLLOW_NFT_URI,
        })
      ).to.not.be.reverted;

      await expect(
        lensHub.connect(governance).whitelistCollectModule(freeCollectModule.address, true)
      ).to.not.be.reverted;

      await expect(
        lensHub.connect(testWallet).post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: freeCollectModule.address,
          collectModuleInitData: abiCoder.encode(['bool'], [true]),
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;
    });

    context('Negatives', function () {
      it('Testwallet should fail to comment with sig with signature deadline mismatch', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleInitData = abiCoder.encode(['bool'], [true]);
        const referenceModuleInitData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getCommentWithSigParts(
          FIRST_PROFILE_ID,
          MOCK_URI,
          FIRST_PROFILE_ID,
          '1',
          referenceModuleData,
          ZERO_ADDRESS,
          collectModuleInitData,
          ZERO_ADDRESS,
          referenceModuleInitData,
          nonce,
          '0'
        );

        await expect(
          lensHub.commentWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '1',
            referenceModuleData: referenceModuleData,
            collectModule: ZERO_ADDRESS,
            collectModuleInitData: collectModuleInitData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: referenceModuleInitData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('Testwallet should fail to comment with sig with invalid deadline', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleInitData = [];
        const referenceModuleInitData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getCommentWithSigParts(
          FIRST_PROFILE_ID,
          MOCK_URI,
          FIRST_PROFILE_ID,
          '1',
          referenceModuleData,
          ZERO_ADDRESS,
          collectModuleInitData,
          ZERO_ADDRESS,
          referenceModuleInitData,
          nonce,
          '0'
        );

        await expect(
          lensHub.commentWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '1',
            referenceModuleData: referenceModuleData,
            collectModule: ZERO_ADDRESS,
            collectModuleInitData: collectModuleInitData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: referenceModuleInitData,
            sig: {
              v,
              r,
              s,
              deadline: '0',
            },
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_EXPIRED);
      });

      it('Testwallet should fail to comment with sig with invalid nonce', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleInitData = [];
        const referenceModuleInitData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getCommentWithSigParts(
          FIRST_PROFILE_ID,
          MOCK_URI,
          FIRST_PROFILE_ID,
          '1',
          referenceModuleData,
          ZERO_ADDRESS,
          collectModuleInitData,
          ZERO_ADDRESS,
          referenceModuleInitData,
          nonce + 1,
          MAX_UINT256
        );

        await expect(
          lensHub.commentWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '1',
            referenceModuleData: referenceModuleData,
            collectModule: ZERO_ADDRESS,
            collectModuleInitData: collectModuleInitData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: referenceModuleInitData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('Testwallet should fail to comment with sig with unwhitelisted collect module', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleInitData = [];
        const referenceModuleInitData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getCommentWithSigParts(
          FIRST_PROFILE_ID,
          MOCK_URI,
          FIRST_PROFILE_ID,
          '1',
          referenceModuleData,
          userAddress,
          collectModuleInitData,
          ZERO_ADDRESS,
          referenceModuleInitData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.commentWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '1',
            referenceModuleData: referenceModuleData,
            collectModule: userAddress,
            collectModuleInitData: collectModuleInitData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: referenceModuleInitData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.COLLECT_MODULE_NOT_WHITELISTED);
      });

      it('TestWallet should fail to comment with sig with unwhitelisted reference module', async function () {
        await expect(
          lensHub.connect(governance).whitelistCollectModule(freeCollectModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleInitData = abiCoder.encode(['bool'], [true]);
        const referenceModuleInitData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getCommentWithSigParts(
          FIRST_PROFILE_ID,
          MOCK_URI,
          FIRST_PROFILE_ID,
          '1',
          referenceModuleData,
          freeCollectModule.address,
          collectModuleInitData,
          mockReferenceModule.address,
          referenceModuleInitData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.commentWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '1',
            referenceModuleData,
            collectModule: freeCollectModule.address,
            collectModuleInitData: collectModuleInitData,
            referenceModule: mockReferenceModule.address,
            referenceModuleInitData: referenceModuleInitData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.REFERENCE_MODULE_NOT_WHITELISTED);
      });

      it('TestWallet should fail to comment with sig on a publication that does not exist', async function () {
        await expect(
          lensHub.connect(governance).whitelistCollectModule(freeCollectModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleInitData = abiCoder.encode(['bool'], [true]);
        const referenceModuleInitData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getCommentWithSigParts(
          FIRST_PROFILE_ID,
          OTHER_MOCK_URI,
          FIRST_PROFILE_ID,
          '3',
          referenceModuleData,
          freeCollectModule.address,
          collectModuleInitData,
          ZERO_ADDRESS,
          referenceModuleInitData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.commentWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: OTHER_MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '3',
            referenceModuleData: referenceModuleData,
            collectModule: freeCollectModule.address,
            collectModuleInitData: collectModuleInitData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: referenceModuleInitData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.PUBLICATION_DOES_NOT_EXIST);
      });

      it('TestWallet should fail to comment with sig on the comment they are creating (commentCeption)', async function () {
        await expect(
          lensHub.connect(governance).whitelistCollectModule(freeCollectModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleInitData = [];
        const referenceModuleInitData = [];
        const referenceModuleData = [];
        const { v, r, s } = await getCommentWithSigParts(
          FIRST_PROFILE_ID,
          OTHER_MOCK_URI,
          FIRST_PROFILE_ID,
          '2',
          referenceModuleData,
          freeCollectModule.address,
          collectModuleInitData,
          ZERO_ADDRESS,
          referenceModuleInitData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.commentWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: OTHER_MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '2',
            referenceModuleData: referenceModuleData,
            collectModule: freeCollectModule.address,
            collectModuleInitData: collectModuleInitData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: referenceModuleInitData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.CANNOT_COMMENT_ON_SELF);
      });

      it('TestWallet should sign attempt to comment with sig, cancel via empty permitForAll, then fail to comment with sig', async function () {
        await expect(
          lensHub.connect(governance).whitelistCollectModule(freeCollectModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleInitData = abiCoder.encode(['bool'], [true]);
        const referenceModuleInitData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getCommentWithSigParts(
          FIRST_PROFILE_ID,
          OTHER_MOCK_URI,
          FIRST_PROFILE_ID,
          '1',
          referenceModuleData,
          freeCollectModule.address,
          collectModuleInitData,
          ZERO_ADDRESS,
          referenceModuleInitData,
          nonce,
          MAX_UINT256
        );

        // hre.tracer.enabled = true;
        // hre.tracer.sloads = true;
        // hre.tracer.sstores = true;
        await cancelWithPermitForAll();

        await expect(
          lensHub.commentWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: OTHER_MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '1',
            referenceModuleData: referenceModuleData,
            collectModule: freeCollectModule.address,
            collectModuleInitData: collectModuleInitData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: referenceModuleInitData,
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
      it('TestWallet should comment with sig, fetched comment data should be accurate', async function () {
        await expect(
          lensHub.connect(governance).whitelistCollectModule(freeCollectModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleInitData = abiCoder.encode(['bool'], [true]);
        const referenceModuleInitData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getCommentWithSigParts(
          FIRST_PROFILE_ID,
          OTHER_MOCK_URI,
          FIRST_PROFILE_ID,
          '1',
          referenceModuleData,
          freeCollectModule.address,
          collectModuleInitData,
          ZERO_ADDRESS,
          referenceModuleInitData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.commentWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: OTHER_MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '1',
            referenceModuleData: referenceModuleData,
            collectModule: freeCollectModule.address,
            collectModuleInitData: collectModuleInitData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: referenceModuleInitData,
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
        expect(pub.contentURI).to.eq(OTHER_MOCK_URI);
        expect(pub.collectModule).to.eq(freeCollectModule.address);
        expect(pub.collectNFT).to.eq(ZERO_ADDRESS);
        expect(pub.referenceModule).to.eq(ZERO_ADDRESS);
      });
    });
  });
});
