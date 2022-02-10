import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { CollectNFT, CollectNFT__factory } from '../../typechain-types';
import { ZERO_ADDRESS } from '../helpers/constants';
import { ERRORS } from '../helpers/errors';
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
  user,
  userAddress,
  userTwo,
} from '../__setup.spec';

makeSuiteCleanRoom('Collect NFT', function () {
  let collectNFT: CollectNFT;
  beforeEach(async function () {
    await expect(
      lensHub.connect(governance).allowlistCollectModule(emptyCollectModule.address, true)
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
    await expect(lensHub.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
    await expect(lensHub.collect(FIRST_PROFILE_ID, 1, [])).to.not.be.reverted;
    collectNFT = CollectNFT__factory.connect(
      await lensHub.getCollectNFT(FIRST_PROFILE_ID, 1),
      user
    );
  });

  context('Negatives', function () {
    it('User should fail to reinitialize the collect NFT', async function () {
      await expect(collectNFT.initialize(FIRST_PROFILE_ID, 1, 'name', 'symbol')).to.be.revertedWith(
        ERRORS.INITIALIZED
      );
    });

    it('User should fail to mint on the collect NFT', async function () {
      await expect(collectNFT.mint(userAddress)).to.be.revertedWith(ERRORS.NOT_HUB);
    });

    it("UserTwo should fail to burn user's collect NFT", async function () {
      await expect(collectNFT.connect(userTwo).burn(1)).to.be.revertedWith(
        ERRORS.NOT_OWNER_OR_APPROVED
      );
    });

    it('User should fail to get the URI for a token that does not exist', async function () {
      await expect(collectNFT.tokenURI(2)).to.be.revertedWith(ERRORS.TOKEN_DOES_NOT_EXIST);
    });
  });

  context('Scenarios', function () {
    it('Collect NFT URI should be valid', async function () {
      expect(await collectNFT.tokenURI(1)).to.eq(MOCK_URI);
    });

    it('Collect NFT source publication pointer should be accurate', async function () {
      const pointer = await collectNFT.getSourcePublicationPointer();
      expect(pointer[0]).to.eq(FIRST_PROFILE_ID);
      expect(pointer[1]).to.eq(1);
    });

    it('User should burn their collect NFT', async function () {
      await expect(collectNFT.burn(1)).to.not.be.reverted;
    });
  });
});
