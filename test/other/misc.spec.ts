import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { UIDataProvider__factory } from '../../typechain-types';
import { ZERO_ADDRESS } from '../helpers/constants';
import { ERRORS } from '../helpers/errors';
import {
  approvalFollowModule,
  deployer,
  emptyCollectModule,
  FIRST_PROFILE_ID,
  followerOnlyReferenceModule,
  governance,
  governanceAddress,
  lensHub,
  makeSuiteCleanRoom,
  mockFollowModule,
  mockModuleData,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  moduleGlobals,
  OTHER_MOCK_URI,
  timedFeeCollectModule,
  treasuryAddress,
  TREASURY_FEE_BPS,
  user,
  userAddress,
  userTwo,
  userTwoAddress,
} from '../__setup.spec';

/**
 * @dev Some of these tests may be redundant, but are still present to ensure an isolated environment,
 * in particular if other test files are changed.
 */
makeSuiteCleanRoom('Misc', function () {
  context('NFT Transfer Emitters', function () {
    it('User should not be able to call the follow NFT transfer event emitter function', async function () {
      await expect(
        lensHub.emitFollowNFTTransferEvent(FIRST_PROFILE_ID, 1, userAddress, userTwoAddress)
      ).to.be.revertedWith(ERRORS.NOT_FOLLOW_NFT);
    });

    it('User should not be able to call the collect NFT transfer event emitter function', async function () {
      await expect(
        lensHub.emitCollectNFTTransferEvent(FIRST_PROFILE_ID, 1, 1, userAddress, userTwoAddress)
      ).to.be.revertedWith(ERRORS.NOT_COLLECT_NFT);
    });
  });

  context('Lens Hub Misc', function () {
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

    it('UserTwo should fail to burn profile owned by user without being approved', async function () {
      await expect(lensHub.connect(userTwo).burn(FIRST_PROFILE_ID)).to.be.revertedWith(
        ERRORS.NOT_OWNER_OR_APPROVED
      );
    });

    it('User should burn profile owned by user', async function () {
      await expect(lensHub.burn(FIRST_PROFILE_ID)).to.not.be.reverted;
    });

    it('UserTwo should burn profile owned by user if approved', async function () {
      await expect(lensHub.approve(userTwoAddress, FIRST_PROFILE_ID)).to.not.be.reverted;
      await expect(lensHub.connect(userTwo).burn(FIRST_PROFILE_ID)).to.not.be.reverted;
    });

    it('Governance getter should return proper address', async function () {
      expect(await lensHub.getGovernance()).to.eq(governanceAddress);
    });

    it('Profile handle getter should return the correct handle', async function () {
      expect(await lensHub.getHandle(FIRST_PROFILE_ID)).to.eq(MOCK_PROFILE_HANDLE);
    });

    it('Profile dispatcher getter should return the zero address when no dispatcher is set', async function () {
      expect(await lensHub.getDispatcher(FIRST_PROFILE_ID)).to.eq(ZERO_ADDRESS);
    });

    it('Profile creator allowlist getter should return expected values', async function () {
      expect(await lensHub.isProfileCreatorAllowlisted(userAddress)).to.eq(true);
      await expect(
        lensHub.connect(governance).allowlistProfileCreator(userAddress, false)
      ).to.not.be.reverted;
      expect(await lensHub.isProfileCreatorAllowlisted(userAddress)).to.eq(false);
    });

    it('Profile dispatcher getter should return the correct dispatcher address when it is set, then zero after it is transferred', async function () {
      await expect(lensHub.setDispatcher(FIRST_PROFILE_ID, userTwoAddress)).to.not.be.reverted;
      expect(await lensHub.getDispatcher(FIRST_PROFILE_ID)).to.eq(userTwoAddress);

      await expect(
        lensHub.transferFrom(userAddress, userTwoAddress, FIRST_PROFILE_ID)
      ).to.not.be.reverted;
      expect(await lensHub.getDispatcher(FIRST_PROFILE_ID)).to.eq(ZERO_ADDRESS);
    });

    it('Profile follow NFT getter should return the zero address before the first follow, then the correct address afterwards', async function () {
      expect(await lensHub.getFollowNFT(FIRST_PROFILE_ID)).to.eq(ZERO_ADDRESS);

      await expect(lensHub.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

      expect(await lensHub.getFollowNFT(FIRST_PROFILE_ID)).to.not.eq(ZERO_ADDRESS);
    });

    it('Profile follow module getter should return the zero address, then the correct follow module after it is set', async function () {
      expect(await lensHub.getFollowModule(FIRST_PROFILE_ID)).to.eq(ZERO_ADDRESS);

      await expect(
        lensHub.connect(governance).allowlistFollowModule(mockFollowModule.address, true)
      ).to.not.be.reverted;

      await expect(
        lensHub.setFollowModule(FIRST_PROFILE_ID, mockFollowModule.address, mockModuleData)
      ).to.not.be.reverted;
      expect(await lensHub.getFollowModule(FIRST_PROFILE_ID)).to.eq(mockFollowModule.address);
    });

    it('Profile publication count getter should return zero, then the correct amount after some publications', async function () {
      expect(await lensHub.getPubCount(FIRST_PROFILE_ID)).to.eq(0);

      await expect(
        lensHub.connect(governance).allowlistCollectModule(emptyCollectModule.address, true)
      ).to.not.be.reverted;

      const expectedCount = 5;
      for (let i = 0; i < expectedCount; i++) {
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
      }
      expect(await lensHub.getPubCount(FIRST_PROFILE_ID)).to.eq(expectedCount);
    });

    it('Profile tokenURI should return the accurate URI', async function () {
      expect(await lensHub.tokenURI(FIRST_PROFILE_ID)).to.eq(MOCK_PROFILE_URI);
    });

    it('Publication reference module getter should return the correct reference module (or zero in case of no reference module)', async function () {
      await expect(
        lensHub.connect(governance).allowlistCollectModule(emptyCollectModule.address, true)
      ).to.not.be.reverted;

      await expect(
        lensHub
          .connect(governance)
          .allowlistReferenceModule(followerOnlyReferenceModule.address, true)
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
      expect(await lensHub.getReferenceModule(FIRST_PROFILE_ID, 1)).to.eq(ZERO_ADDRESS);

      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: emptyCollectModule.address,
          collectModuleData: [],
          referenceModule: followerOnlyReferenceModule.address,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;
      expect(await lensHub.getReferenceModule(FIRST_PROFILE_ID, 2)).to.eq(
        followerOnlyReferenceModule.address
      );
    });

    it('Publication pointer getter should return an empty pointer for posts', async function () {
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

      const pointer = await lensHub.getPubPointer(FIRST_PROFILE_ID, 1);
      expect(pointer[0]).to.eq(0);
      expect(pointer[1]).to.eq(0);
    });

    it('Publication pointer getter should return the correct pointer for comments', async function () {
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

      await expect(
        lensHub.comment({
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

      const pointer = await lensHub.getPubPointer(FIRST_PROFILE_ID, 2);
      expect(pointer[0]).to.eq(FIRST_PROFILE_ID);
      expect(pointer[1]).to.eq(1);
    });

    it('Publication pointer getter should return the correct pointer for mirrors', async function () {
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

      await expect(
        lensHub.mirror({
          profileId: FIRST_PROFILE_ID,
          profileIdPointed: FIRST_PROFILE_ID,
          pubIdPointed: 1,
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;

      const pointer = await lensHub.getPubPointer(FIRST_PROFILE_ID, 2);
      expect(pointer[0]).to.eq(FIRST_PROFILE_ID);
      expect(pointer[1]).to.eq(1);
    });

    it('Publication content URI getter should return the correct URI for posts', async function () {
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

      expect(await lensHub.getContentURI(FIRST_PROFILE_ID, 1)).to.eq(MOCK_URI);
    });

    it('Publication content URI getter should return the correct URI for comments', async function () {
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

      await expect(
        lensHub.comment({
          profileId: FIRST_PROFILE_ID,
          contentURI: OTHER_MOCK_URI,
          profileIdPointed: FIRST_PROFILE_ID,
          pubIdPointed: 1,
          collectModule: emptyCollectModule.address,
          collectModuleData: [],
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;

      expect(await lensHub.getContentURI(FIRST_PROFILE_ID, 2)).to.eq(OTHER_MOCK_URI);
    });

    it('Publication content URI getter should return the correct URI for mirrors', async function () {
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

      await expect(
        lensHub.mirror({
          profileId: FIRST_PROFILE_ID,
          profileIdPointed: FIRST_PROFILE_ID,
          pubIdPointed: 1,
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;
      expect(await lensHub.getContentURI(FIRST_PROFILE_ID, 2)).to.eq(MOCK_URI);
    });

    it('Publication collect module getter should return the correct collectModule for posts', async function () {
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

      expect(await lensHub.getCollectModule(FIRST_PROFILE_ID, 1)).to.eq(emptyCollectModule.address);
    });

    it('Publication collect module getter should return the correct collectModule for comments', async function () {
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
        lensHub.comment({
          profileId: FIRST_PROFILE_ID,
          contentURI: OTHER_MOCK_URI,
          profileIdPointed: FIRST_PROFILE_ID,
          pubIdPointed: 2,
          collectModule: emptyCollectModule.address,
          collectModuleData: [],
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;

      expect(await lensHub.getCollectModule(FIRST_PROFILE_ID, 3)).to.eq(emptyCollectModule.address);
    });

    it('Publication collect module getter should return the zero address for mirrors', async function () {
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

      await expect(
        lensHub.mirror({
          profileId: FIRST_PROFILE_ID,
          profileIdPointed: FIRST_PROFILE_ID,
          pubIdPointed: 1,
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;

      expect(await lensHub.getCollectModule(FIRST_PROFILE_ID, 2)).to.eq(ZERO_ADDRESS);
    });

    it('Publication type getter should return the correct publication type for all publication types, or nonexistent', async function () {
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

      await expect(
        lensHub.comment({
          profileId: FIRST_PROFILE_ID,
          contentURI: OTHER_MOCK_URI,
          profileIdPointed: FIRST_PROFILE_ID,
          pubIdPointed: 1,
          collectModule: emptyCollectModule.address,
          collectModuleData: [],
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;

      await expect(
        lensHub.mirror({
          profileId: FIRST_PROFILE_ID,
          profileIdPointed: FIRST_PROFILE_ID,
          pubIdPointed: 1,
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;

      expect(await lensHub.getPubType(FIRST_PROFILE_ID, 1)).to.eq(0);
      expect(await lensHub.getPubType(FIRST_PROFILE_ID, 2)).to.eq(1);
      expect(await lensHub.getPubType(FIRST_PROFILE_ID, 3)).to.eq(2);
      expect(await lensHub.getPubType(FIRST_PROFILE_ID, 4)).to.eq(3);
    });

    it('Profile getter should return accurate profile parameters', async function () {
      const fetchedProfile = await lensHub.getProfile(FIRST_PROFILE_ID);
      expect(fetchedProfile.pubCount).to.eq(0);
      expect(fetchedProfile.handle).to.eq(MOCK_PROFILE_HANDLE);
      expect(fetchedProfile.followModule).to.eq(ZERO_ADDRESS);
      expect(fetchedProfile.followNFT).to.eq(ZERO_ADDRESS);
    });
  });

  context('Follow Module Misc', function () {
    beforeEach(async function () {
      await expect(
        lensHub.connect(governance).allowlistFollowModule(approvalFollowModule.address, true)
      ).to.not.be.reverted;

      await expect(
        lensHub.createProfile({
          to: userAddress,
          handle: MOCK_PROFILE_HANDLE,
          imageURI: MOCK_PROFILE_URI,
          followModule: approvalFollowModule.address,
          followModuleData: [],
          followNFTURI: MOCK_FOLLOW_NFT_URI,
        })
      ).to.not.be.reverted;
    });

    it('User should fail to call processFollow directly on a follow module inheriting from the FollowValidatorFollowModuleBase', async function () {
      await expect(approvalFollowModule.processFollow(ZERO_ADDRESS, 0, [])).to.be.revertedWith(
        ERRORS.NOT_HUB
      );
    });

    it('Follow module follow validation when there are no follows, and thus no deployed Follow NFT should revert', async function () {
      await expect(
        approvalFollowModule.validateFollow(FIRST_PROFILE_ID, userTwoAddress, 0)
      ).to.be.revertedWith(ERRORS.FOLLOW_INVALID);
    });

    it('Follow module follow validation with zero ID input should revert after another address follows, but not the queried address', async function () {
      await expect(
        approvalFollowModule.connect(user).approve(FIRST_PROFILE_ID, [userAddress], [true])
      ).to.not.be.reverted;
      await expect(lensHub.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

      await expect(
        approvalFollowModule.validateFollow(FIRST_PROFILE_ID, userTwoAddress, 0)
      ).to.be.revertedWith(ERRORS.FOLLOW_INVALID);
    });

    it('Follow module follow validation with specific ID input should revert after following, but the specific ID does not exist yet', async function () {
      await expect(
        approvalFollowModule.connect(user).approve(FIRST_PROFILE_ID, [userAddress], [true])
      ).to.not.be.reverted;
      await expect(lensHub.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

      await expect(
        approvalFollowModule.validateFollow(FIRST_PROFILE_ID, userAddress, 2)
      ).to.be.revertedWith(ERRORS.ERC721_QUERY_FOR_NONEXISTENT_TOKEN);
    });

    it('Follow module follow validation with specific ID input should revert if another address owns the specified follow NFT', async function () {
      await expect(
        approvalFollowModule.connect(user).approve(FIRST_PROFILE_ID, [userAddress], [true])
      ).to.not.be.reverted;
      await expect(lensHub.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

      await expect(
        approvalFollowModule.validateFollow(FIRST_PROFILE_ID, userTwoAddress, 1)
      ).to.be.revertedWith(ERRORS.FOLLOW_INVALID);
    });

    it('Follow module follow validation with specific ID input should work if the queried address owns the specified follow NFT', async function () {
      await expect(
        approvalFollowModule.connect(user).approve(FIRST_PROFILE_ID, [userAddress], [true])
      ).to.not.be.reverted;
      await expect(lensHub.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

      await expect(
        approvalFollowModule.validateFollow(FIRST_PROFILE_ID, userAddress, 1)
      ).to.not.be.reverted;
    });
  });

  context('Collect Module Misc', function () {
    it('Should fail to call processCollect directly on a collect module inheriting from the FollowValidationModuleBase contract', async function () {
      await expect(
        timedFeeCollectModule.processCollect(0, ZERO_ADDRESS, 0, 0, [])
      ).to.be.revertedWith(ERRORS.NOT_HUB);
    });
  });

  context('Module Globals', function () {
    context('Negatives', function () {
      it('User should fail to set the governance address on the module globals', async function () {
        await expect(moduleGlobals.connect(user).setGovernance(ZERO_ADDRESS)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE
        );
      });

      it('User should fail to set the treasury on the module globals', async function () {
        await expect(moduleGlobals.connect(user).setTreasury(ZERO_ADDRESS)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE
        );
      });

      it('User should fail to set the treasury fee on the module globals', async function () {
        await expect(moduleGlobals.connect(user).setTreasuryFee(0)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE
        );
      });
    });

    context('Scenarios', function () {
      it('Governance should set the governance address on the module globals', async function () {
        await expect(
          moduleGlobals.connect(governance).setGovernance(userAddress)
        ).to.not.be.reverted;
      });

      it('Governance should set the treasury on the module globals', async function () {
        await expect(moduleGlobals.connect(governance).setTreasury(userAddress)).to.not.be.reverted;
      });

      it('Governance should set the treasury fee on the module globals', async function () {
        await expect(moduleGlobals.connect(governance).setTreasuryFee(0)).to.not.be.reverted;
      });

      it('Governance should fail to allowlist the zero address as a currency', async function () {
        await expect(
          moduleGlobals.connect(governance).allowlistCurrency(ZERO_ADDRESS, true)
        ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
      });

      it('Governance getter should return expected address', async function () {
        expect(await moduleGlobals.getGovernance()).to.eq(governanceAddress);
      });

      it('Treasury getter should return expected address', async function () {
        expect(await moduleGlobals.getTreasury()).to.eq(treasuryAddress);
      });

      it('Treasury fee getter should return the expected fee', async function () {
        expect(await moduleGlobals.getTreasuryFee()).to.eq(TREASURY_FEE_BPS);
      });
    });
  });

  context('UI Data Provider', function () {
    it('UI Data Provider should return expected values', async function () {
      // First, create a profile,
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

      // Then, whitelist a collect module
      await expect(
        lensHub.connect(governance).whitelistCollectModule(emptyCollectModule.address, true)
      ).to.not.be.reverted;

      // Then, publish twice
      const firstURI = 'first publication';
      const secondURI = 'second publication';
      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: firstURI,
          collectModule: emptyCollectModule.address,
          collectModuleData: [],
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;

      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: secondURI,
          collectModule: emptyCollectModule.address,
          collectModuleData: [],
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;

      // Then, deploy the data provider
      const dataProvider = await new UIDataProvider__factory(deployer).deploy(lensHub.address);

      // Lastly, validate the result from the data provider
      const result = await dataProvider.getLatestData(FIRST_PROFILE_ID);
      const pubStruct = result.publicationStruct;
      const profileStruct = result.profileStruct;

      expect(profileStruct.pubCount).to.eq(2);
      expect(profileStruct.followModule).to.eq(ZERO_ADDRESS);
      expect(profileStruct.followNFT).to.eq(ZERO_ADDRESS);
      expect(profileStruct.handle).to.eq(MOCK_PROFILE_HANDLE);
      expect(profileStruct.imageURI).to.eq(MOCK_PROFILE_URI);
      expect(profileStruct.followNFTURI).to.eq(MOCK_FOLLOW_NFT_URI);

      expect(pubStruct.profileIdPointed).to.eq(0);
      expect(pubStruct.pubIdPointed).to.eq(0);
      expect(pubStruct.contentURI).to.eq(secondURI);
      expect(pubStruct.referenceModule).to.eq(ZERO_ADDRESS);
      expect(pubStruct.collectModule).to.eq(emptyCollectModule.address);
      expect(pubStruct.collectNFT).to.eq(ZERO_ADDRESS);
    });
  });
});
