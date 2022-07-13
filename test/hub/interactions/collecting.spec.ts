import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { CollectNFT__factory, FollowNFT__factory } from '../../../typechain-types';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import {
  cancelWithPermitForAll,
  collectReturningTokenIds,
  getAbbreviation,
  getCollectWithSigParts,
  getTimestamp,
} from '../../helpers/utils';
import {
  lensHub,
  freeCollectModule,
  FIRST_PROFILE_ID,
  governance,
  makeSuiteCleanRoom,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  testWallet,
  userAddress,
  userTwo,
  userTwoAddress,
  MOCK_FOLLOW_NFT_URI,
  abiCoder,
  user,
} from '../../__setup.spec';

makeSuiteCleanRoom('Collecting', function () {
  beforeEach(async function () {
    await expect(
      lensHub.connect(governance).whitelistCollectModule(freeCollectModule.address, true)
    ).to.not.be.reverted;
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

  context('Generic', function () {
    context('Negatives', function () {
      it('User two should fail to collect without being a follower', async function () {
        await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, [])).to.be.revertedWith(
          ERRORS.FOLLOW_INVALID
        );
      });

      it('User two should follow, then transfer the followNFT and fail to collect', async function () {
        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const followNftAddr = await lensHub.getFollowNFT(FIRST_PROFILE_ID);
        await expect(
          FollowNFT__factory.connect(followNftAddr, userTwo).transferFrom(
            userTwoAddress,
            userAddress,
            1
          )
        ).to.not.be.reverted;
        await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, [])).to.be.revertedWith(
          ERRORS.FOLLOW_INVALID
        );
      });

      it('User two should fail to collect a nonexistent publication', async function () {
        await expect(lensHub.connect(userTwo).collect(0, 0, [])).to.be.revertedWith(
          ERRORS.PUBLICATION_DOES_NOT_EXIST
        );

      });
    });

    context('Scenarios', function () {
      it('Collecting should work if the collector is the publication owner even when he is not following himself and follow NFT was not deployed', async function () {
        await expect(lensHub.collect(FIRST_PROFILE_ID, 1, [])).to.not.be.reverted;
      });

      it('Collecting should work if the collector is the publication owner even when he is not following himself and follow NFT was deployed', async function () {
        await expect(lensHub.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const followNFT = FollowNFT__factory.connect(
          await lensHub.getFollowNFT(FIRST_PROFILE_ID),
          user
        );

        await expect(followNFT.transferFrom(userAddress, userTwoAddress, 1)).to.not.be.reverted;

        await expect(lensHub.collect(FIRST_PROFILE_ID, 1, [])).to.not.be.reverted;
      });

      it('Should return the expected token IDs when collecting publications', async function () {
        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        await expect(
          lensHub.connect(testWallet).follow([FIRST_PROFILE_ID], [[]])
        ).to.not.be.reverted;

        expect(
          await collectReturningTokenIds({
            vars: {
              profileId: FIRST_PROFILE_ID,
              pubId: 1,
              data: [],
            },
          })
        ).to.eq(1);

        expect(
          await collectReturningTokenIds({
            sender: userTwo,
            vars: {
              profileId: FIRST_PROFILE_ID,
              pubId: 1,
              data: [],
            },
          })
        ).to.eq(2);

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const { v, r, s } = await getCollectWithSigParts(
          FIRST_PROFILE_ID,
          '1',
          [],
          nonce,
          MAX_UINT256
        );
        expect(
          await collectReturningTokenIds({
            vars: {
              collector: testWallet.address,
              profileId: FIRST_PROFILE_ID,
              pubId: '1',
              data: [],
              sig: {
                v,
                r,
                s,
                deadline: MAX_UINT256,
              },
            },
          })
        ).to.eq(3);

        expect(
          await collectReturningTokenIds({
            vars: {
              profileId: FIRST_PROFILE_ID,
              pubId: 1,
              data: [],
            },
          })
        ).to.eq(4);
      });

      it('UserTwo should follow, then collect, receive a collect NFT with the expected properties', async function () {
        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, [])).to.not.be.reverted;
        const timestamp = await getTimestamp();

        const collectNFTAddr = await lensHub.getCollectNFT(FIRST_PROFILE_ID, 1);
        expect(collectNFTAddr).to.not.eq(ZERO_ADDRESS);
        const collectNFT = CollectNFT__factory.connect(collectNFTAddr, userTwo);
        const id = await collectNFT.tokenOfOwnerByIndex(userTwoAddress, 0);
        const name = await collectNFT.name();
        const symbol = await collectNFT.symbol();
        const pointer = await collectNFT.getSourcePublicationPointer();
        const owner = await collectNFT.ownerOf(id);
        const mintTimestamp = await collectNFT.mintTimestampOf(id);
        const tokenData = await collectNFT.tokenDataOf(id);

        const expectedName = MOCK_PROFILE_HANDLE + '-Collect-' + '1';
        const expectedSymbol = getAbbreviation(MOCK_PROFILE_HANDLE) + '-Cl-' + '1';

        expect(id).to.eq(1);
        expect(name).to.eq(expectedName);
        expect(symbol).to.eq(expectedSymbol);
        expect(pointer[0]).to.eq(FIRST_PROFILE_ID);
        expect(pointer[1]).to.eq(1);
        expect(owner).to.eq(userTwoAddress);
        expect(tokenData.owner).to.eq(userTwoAddress);
        expect(tokenData.mintTimestamp).to.eq(timestamp);
        expect(mintTimestamp).to.eq(timestamp);
      });

      it('UserTwo should follow, then mirror, then collect on their mirror, receive a collect NFT with expected properties', async function () {
        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const secondProfileId = FIRST_PROFILE_ID + 1;
        await expect(
          lensHub.connect(userTwo).createProfile({
            to: userTwoAddress,
            handle: 'mockhandle',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.not.be.reverted;

        await expect(
          lensHub.connect(userTwo).mirror({
            profileId: secondProfileId,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(lensHub.connect(userTwo).collect(secondProfileId, 1, [])).to.not.be.reverted;

        const collectNFTAddr = await lensHub.getCollectNFT(FIRST_PROFILE_ID, 1);
        expect(collectNFTAddr).to.not.eq(ZERO_ADDRESS);
        const collectNFT = CollectNFT__factory.connect(collectNFTAddr, userTwo);
        const id = await collectNFT.tokenOfOwnerByIndex(userTwoAddress, 0);
        const name = await collectNFT.name();
        const symbol = await collectNFT.symbol();
        const pointer = await collectNFT.getSourcePublicationPointer();

        const expectedName = MOCK_PROFILE_HANDLE + '-Collect-' + '1';
        const expectedSymbol = getAbbreviation(MOCK_PROFILE_HANDLE) + '-Cl-' + '1';
        expect(id).to.eq(1);
        expect(name).to.eq(expectedName);
        expect(symbol).to.eq(expectedSymbol);
        expect(pointer[0]).to.eq(FIRST_PROFILE_ID);
        expect(pointer[1]).to.eq(1);
      });

      it('UserTwo should follow, then mirror, mirror their mirror then collect on their latest mirror, receive a collect NFT with expected properties', async function () {
        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const secondProfileId = FIRST_PROFILE_ID + 1;
        await expect(
          lensHub.connect(userTwo).createProfile({
            to: userTwoAddress,
            handle: 'mockhandle',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.not.be.reverted;

        await expect(
          lensHub.connect(userTwo).mirror({
            profileId: secondProfileId,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(
          lensHub.connect(userTwo).mirror({
            profileId: secondProfileId,
            profileIdPointed: secondProfileId,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(lensHub.connect(userTwo).collect(secondProfileId, 2, [])).to.not.be.reverted;

        const collectNFTAddr = await lensHub.getCollectNFT(FIRST_PROFILE_ID, 1);
        expect(collectNFTAddr).to.not.eq(ZERO_ADDRESS);
        const collectNFT = CollectNFT__factory.connect(collectNFTAddr, userTwo);
        const id = await collectNFT.tokenOfOwnerByIndex(userTwoAddress, 0);
        const name = await collectNFT.name();
        const symbol = await collectNFT.symbol();
        const pointer = await collectNFT.getSourcePublicationPointer();

        const expectedName = MOCK_PROFILE_HANDLE + '-Collect-' + '1';
        const expectedSymbol = getAbbreviation(MOCK_PROFILE_HANDLE) + '-Cl-' + '1';
        expect(id).to.eq(1);
        expect(name).to.eq(expectedName);
        expect(symbol).to.eq(expectedSymbol);
        expect(pointer[0]).to.eq(FIRST_PROFILE_ID);
        expect(pointer[1]).to.eq(1);
      });
    });
  });

  context('Meta-tx', function () {
    context('Negatives', function () {
      it('TestWallet should fail to collect with sig with signature deadline mismatch', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getCollectWithSigParts(FIRST_PROFILE_ID, '1', [], nonce, '0');

        await expect(
          lensHub.collectWithSig({
            collector: testWallet.address,
            profileId: FIRST_PROFILE_ID,
            pubId: '1',
            data: [],
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('TestWallet should fail to collect with sig with invalid deadline', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getCollectWithSigParts(FIRST_PROFILE_ID, '1', [], nonce, '0');

        await expect(
          lensHub.collectWithSig({
            collector: testWallet.address,
            profileId: FIRST_PROFILE_ID,
            pubId: '1',
            data: [],
            sig: {
              v,
              r,
              s,
              deadline: '0',
            },
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_EXPIRED);
      });

      it('TestWallet should fail to collect with sig with invalid nonce', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getCollectWithSigParts(
          FIRST_PROFILE_ID,
          '1',
          [],
          nonce + 1,
          MAX_UINT256
        );

        await expect(
          lensHub.collectWithSig({
            collector: testWallet.address,
            profileId: FIRST_PROFILE_ID,
            pubId: '1',
            data: [],
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('TestWallet should fail to collect with sig without being a follower', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getCollectWithSigParts(
          FIRST_PROFILE_ID,
          '1',
          [],
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.collectWithSig({
            collector: testWallet.address,
            profileId: FIRST_PROFILE_ID,
            pubId: '1',
            data: [],
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.FOLLOW_INVALID);
      });

      it('TestWallet should sign attempt to collect with sig, cancel via empty permitForAll, fail to collect with sig', async function () {
        await expect(
          lensHub.connect(testWallet).follow([FIRST_PROFILE_ID], [[]])
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getCollectWithSigParts(
          FIRST_PROFILE_ID,
          '1',
          [],
          nonce,
          MAX_UINT256
        );

        await cancelWithPermitForAll();

        await expect(
          lensHub.collectWithSig({
            collector: testWallet.address,
            profileId: FIRST_PROFILE_ID,
            pubId: '1',
            data: [],
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
      it('TestWallet should follow, then collect with sig, receive a collect NFT with expected properties', async function () {
        await expect(
          lensHub.connect(testWallet).follow([FIRST_PROFILE_ID], [[]])
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getCollectWithSigParts(
          FIRST_PROFILE_ID,
          '1',
          [],
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.collectWithSig({
            collector: testWallet.address,
            profileId: FIRST_PROFILE_ID,
            pubId: '1',
            data: [],
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.not.be.reverted;

        const collectNFTAddr = await lensHub.getCollectNFT(FIRST_PROFILE_ID, 1);
        expect(collectNFTAddr).to.not.eq(ZERO_ADDRESS);
        const collectNFT = CollectNFT__factory.connect(collectNFTAddr, userTwo);
        const id = await collectNFT.tokenOfOwnerByIndex(testWallet.address, 0);
        const name = await collectNFT.name();
        const symbol = await collectNFT.symbol();
        const pointer = await collectNFT.getSourcePublicationPointer();

        const expectedName = MOCK_PROFILE_HANDLE + '-Collect-' + '1';
        const expectedSymbol = getAbbreviation(MOCK_PROFILE_HANDLE) + '-Cl-' + '1';
        expect(id).to.eq(1);
        expect(name).to.eq(expectedName);
        expect(symbol).to.eq(expectedSymbol);
        expect(pointer[0]).to.eq(FIRST_PROFILE_ID);
        expect(pointer[1]).to.eq(1);
      });

      it('TestWallet should follow, mirror, then collect with sig on their mirror', async function () {
        await expect(
          lensHub.connect(testWallet).follow([FIRST_PROFILE_ID], [[]])
        ).to.not.be.reverted;
        const secondProfileId = FIRST_PROFILE_ID + 1;
        await expect(
          lensHub.connect(testWallet).createProfile({
            to: testWallet.address,
            handle: 'mockhandle',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.not.be.reverted;

        await expect(
          lensHub.connect(testWallet).mirror({
            profileId: secondProfileId,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getCollectWithSigParts(
          secondProfileId.toString(),
          '1',
          [],
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.collectWithSig({
            collector: testWallet.address,
            profileId: secondProfileId,
            pubId: '1',
            data: [],
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.not.be.reverted;

        const collectNFTAddr = await lensHub.getCollectNFT(FIRST_PROFILE_ID, 1);
        expect(collectNFTAddr).to.not.eq(ZERO_ADDRESS);
        const collectNFT = CollectNFT__factory.connect(collectNFTAddr, userTwo);
        const id = await collectNFT.tokenOfOwnerByIndex(testWallet.address, 0);
        const name = await collectNFT.name();
        const symbol = await collectNFT.symbol();
        const pointer = await collectNFT.getSourcePublicationPointer();

        const expectedName = MOCK_PROFILE_HANDLE + '-Collect-' + '1';
        const expectedSymbol = getAbbreviation(MOCK_PROFILE_HANDLE) + '-Cl-' + '1';
        expect(id).to.eq(1);
        expect(name).to.eq(expectedName);
        expect(symbol).to.eq(expectedSymbol);
        expect(pointer[0]).to.eq(FIRST_PROFILE_ID);
        expect(pointer[1]).to.eq(1);
      });
    });
  });
});
