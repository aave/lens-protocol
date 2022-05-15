import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { FollowNFT__factory, Mock1155Collection__factory, Mock721Collection__factory, Mock1155Collection, Mock721Collection } from '../../../typechain-types';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { getTimestamp, matchEvent, waitForTx } from '../../helpers/utils';
import {
  freeCollectModule,
  FIRST_PROFILE_ID,
  collectionGatedReferenceModule,
  governance,
  lensHub,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  user,
  userAddress,
  userThreeAddress,
  userTwo,
  userTwoAddress,
  abiCoder,
  deployer,
  deployerAddress,
  userThree
} from '../../__setup.spec';

makeSuiteCleanRoom('Collection Gated Reference Module', function () {
  const SECOND_PROFILE_ID = FIRST_PROFILE_ID + 1;
  const THIRD_PROFILE_ID = SECOND_PROFILE_ID + 1;
  let mock1155Collection: Mock1155Collection;
  let mock721Collection: Mock721Collection;
  let erc1155TokenId;
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
      lensHub.createProfile({
        to: userTwoAddress,
        handle: 'user2',
        imageURI: MOCK_PROFILE_URI,
        followModule: ZERO_ADDRESS,
        followModuleInitData: [],
        followNFTURI: MOCK_FOLLOW_NFT_URI,
      })
    ).to.not.be.reverted;
    await expect(
      lensHub.createProfile({
        to: userThreeAddress,
        handle: 'user3',
        imageURI: MOCK_PROFILE_URI,
        followModule: ZERO_ADDRESS,
        followModuleInitData: [],
        followNFTURI: MOCK_FOLLOW_NFT_URI,
      })
    ).to.not.be.reverted;
    await expect(
      lensHub
        .connect(governance)
        .whitelistReferenceModule(collectionGatedReferenceModule.address, true)
    ).to.not.be.reverted;
    await expect(
      lensHub.connect(governance).whitelistCollectModule(freeCollectModule.address, true)
    ).to.not.be.reverted;
    await expect(
      lensHub.post({
        profileId: FIRST_PROFILE_ID,
        contentURI: MOCK_URI,
        collectModule: freeCollectModule.address,
        collectModuleInitData: abiCoder.encode(['bool'], [true]),
        referenceModule: collectionGatedReferenceModule.address,
        referenceModuleInitData: [],
      })
    ).to.not.be.reverted;

    mock1155Collection = await new Mock1155Collection__factory(deployer).deploy();
    mock721Collection = await new Mock721Collection__factory(deployer).deploy();
    erc1155TokenId = 1111;
    await mock1155Collection.create(userAddress, erc1155TokenId, 1000, ethers.utils.toUtf8Bytes('0x00'));
    await mock721Collection.mint(userThreeAddress);

  });

  context('Negatives', function () {
    // We don't need a `publishing` or `initialization` context because initialization never reverts in the CollectionGatedReferenceModule.
    context('Commenting', function () {
      it('Commenting should fail if commenter is not an owner of the given collection', async function () {
        await expect(
          lensHub.connect(userTwo).comment({
            profileId: SECOND_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            collectModule: freeCollectModule.address,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            referenceModuleData: abiCoder.encode(['address', 'uint256[]'], [mock1155Collection.address, [erc1155TokenId]]),
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.NOT_COLLECTION_OWNER);

        await expect(
          lensHub.connect(userTwo).comment({
            profileId: SECOND_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            collectModule: freeCollectModule.address,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            referenceModuleData: abiCoder.encode(['address', 'uint256[]'], [mock721Collection.address, []]),
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.NOT_COLLECTION_OWNER);
      });
    });

    context('Mirroring', function () {
      it('Mirroring should fail if mirrorer is not an owner of the given collection', async function () {
        await expect(
          lensHub.connect(userTwo).mirror({
            profileId: SECOND_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: abiCoder.encode(['address', 'uint256[]'], [mock1155Collection.address, [erc1155TokenId]]),
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.NOT_COLLECTION_OWNER);
        await expect(
          lensHub.connect(userTwo).mirror({
            profileId: SECOND_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: abiCoder.encode(['address', 'uint256[]'], [mock721Collection.address, []]),
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.NOT_COLLECTION_OWNER);

      });

      it('Mirroring should fail if mirrorer owns an NFT collection, then transfers the NFT before attempting to mirror', async function () {
        await expect(
          mock721Collection.connect(userThree).transferFrom(userThreeAddress, userTwoAddress, 1)
        ).to.not.be.reverted;
        await expect(
          lensHub.connect(user).mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: abiCoder.encode(['address', 'uint256[]'], [mock721Collection.address, []]),
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.NOT_COLLECTION_OWNER);
      });
    });
  });

  context('Scenarios', function () {
    context('Publishing', function () {
      it('Posting with collection gated reference module as reference module should emit expected events', async function () {
        const tx = lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: freeCollectModule.address,
          collectModuleInitData: abiCoder.encode(['bool'], [true]),
          referenceModule: collectionGatedReferenceModule.address,
          referenceModuleInitData: [],
        });
        const receipt = await waitForTx(tx);

        expect(receipt.logs.length).to.eq(1);
        matchEvent(receipt, 'PostCreated', [
          FIRST_PROFILE_ID,
          2,
          MOCK_URI,
          freeCollectModule.address,
          abiCoder.encode(['bool'], [true]),
          collectionGatedReferenceModule.address,
          [],
          await getTimestamp(),
        ]);
      });
    });

    context('Commenting', function () {
      it('Commenting should work if the commenter is a collection NFT owner', async function () {

        await expect(
          lensHub.connect(userThree).comment({
            profileId: THIRD_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            collectModule: freeCollectModule.address,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            referenceModuleData: abiCoder.encode(['address', 'uint256[]'], [mock721Collection.address, []]),
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      });
    });

    context('Mirroring', function () {
      it('Mirroring should work if mirrorer is a collection NFT owner', async function () {
        await expect(
          lensHub.connect(userThree).mirror({
            profileId: THIRD_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: abiCoder.encode(['address', 'uint256[]'], [mock721Collection.address, []]),
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      });

      it('Mirroring should work if mirrorer follows, transfers the follow NFT then receives it back before attempting to mirror', async function () {

        await expect(
          mock721Collection.connect(userThree).transferFrom(userThreeAddress, userTwoAddress, 1)
        ).to.not.be.reverted;

        await expect(mock721Collection.connect(userTwo).transferFrom(userTwoAddress, userThreeAddress, 1)).to.not.be.reverted;

        await expect(
          lensHub.connect(userThree).mirror({
            profileId: THIRD_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: abiCoder.encode(['address', 'uint256[]'], [mock721Collection.address, []]),
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      });

    });
  });
});
