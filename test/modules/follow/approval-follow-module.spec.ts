import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { getTimestamp, matchEvent, waitForTx } from '../../helpers/utils';
import {
  abiCoder,
  approvalFollowModule,
  FIRST_PROFILE_ID,
  governance,
  lensHub,
  lensHubImpl,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  user,
  userAddress,
  userTwo,
  userTwoAddress,
} from '../../__setup.spec';

makeSuiteCleanRoom('Approval Follow Module', function () {
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
      lensHub.connect(governance).allowlistFollowModule(approvalFollowModule.address, true)
    ).to.not.be.reverted;
  });

  context('Negatives', function () {
    context('Initialization', function () {
      it('Initialize call should fail when sender is not the hub', async function () {
        await expect(
          approvalFollowModule.initializeFollowModule(FIRST_PROFILE_ID, [])
        ).to.be.revertedWith(ERRORS.NOT_HUB);
      });
    });

    context('Approvals', function () {
      it('Approve should fail when calling it with addresses and toApprove params having different lengths', async function () {
        await expect(
          lensHub.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, [])
        ).to.not.be.reverted;
        await expect(
          approvalFollowModule.connect(user).approve(FIRST_PROFILE_ID, [userTwoAddress], [])
        ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
      });

      it('Approve should fail when sender differs from profile owner', async function () {
        await expect(
          lensHub.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, [])
        ).to.not.be.reverted;
        await expect(
          approvalFollowModule.connect(userTwo).approve(FIRST_PROFILE_ID, [userTwoAddress], [false])
        ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER);
      });
    });

    context('Processing follow', function () {
      it('Process follow call should fail when sender is not the hub', async function () {
        await expect(
          approvalFollowModule.processFollow(userTwoAddress, FIRST_PROFILE_ID, [])
        ).to.be.revertedWith(ERRORS.NOT_HUB);
      });

      it('Follow should fail when follower address is not approved', async function () {
        await expect(
          lensHub.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, [])
        ).to.not.be.reverted;
        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.be.revertedWith(
          ERRORS.FOLLOW_NOT_APPROVED
        );
      });

      it('Follow should fail when follower address approval is revoked after being approved', async function () {
        const data = abiCoder.encode(['address[]'], [[userTwoAddress]]);
        await expect(
          lensHub.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, data)
        ).to.not.be.reverted;
        await expect(
          approvalFollowModule.connect(user).approve(FIRST_PROFILE_ID, [userTwoAddress], [false])
        ).to.not.be.reverted;
        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.be.revertedWith(
          ERRORS.FOLLOW_NOT_APPROVED
        );
      });

      it('Follow should fail when follower address is not approved even when following itself', async function () {
        await expect(
          lensHub.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, [])
        ).to.not.be.reverted;
        await expect(lensHub.follow([FIRST_PROFILE_ID], [[]])).to.be.revertedWith(
          ERRORS.FOLLOW_NOT_APPROVED
        );
      });
    });
  });

  context('Scenarios', function () {
    context('Initialization', function () {
      it('Profile creation with initial approval data should emit expected event', async function () {
        const secondProfileId = FIRST_PROFILE_ID + 1;
        const data = abiCoder.encode(['address[]'], [[userTwoAddress]]);

        const tx = lensHub.createProfile({
          to: userAddress,
          handle: 'secondhandle',
          imageURI: MOCK_PROFILE_URI,
          followModule: approvalFollowModule.address,
          followModuleData: data,
          followNFTURI: MOCK_FOLLOW_NFT_URI,
        });

        const receipt = await waitForTx(tx);

        expect(receipt.logs.length).to.eq(2);
        matchEvent(receipt, 'Transfer', [ZERO_ADDRESS, userAddress, secondProfileId], lensHubImpl);
        matchEvent(receipt, 'ProfileCreated', [
          secondProfileId,
          userAddress,
          userAddress,
          'secondhandle',
          MOCK_PROFILE_URI,
          approvalFollowModule.address,
          data,
          MOCK_FOLLOW_NFT_URI,
          await getTimestamp(),
        ]);
      });

      it('Setting follow module with initial approval data should emit expected event', async function () {
        const data = abiCoder.encode(['address[]'], [[userTwoAddress]]);
        const tx = lensHub.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, data);

        const receipt = await waitForTx(tx);

        expect(receipt.logs.length).to.eq(1);
        matchEvent(receipt, 'FollowModuleSet', [
          FIRST_PROFILE_ID,
          approvalFollowModule.address,
          data,
          await getTimestamp(),
        ]);
      });

      it('Setting follow module should work when calling it without initial approval data', async function () {
        await expect(
          lensHub.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, [])
        ).to.not.be.reverted;
      });

      it('Setting follow module should work when calling it with initial approval data', async function () {
        const data = abiCoder.encode(['address[]'], [[userTwoAddress]]);
        await expect(
          lensHub.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, data)
        ).to.not.be.reverted;
        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
      });
    });

    context('Approvals and follows', function () {
      it('Approval should emit expected event', async function () {
        const tx = approvalFollowModule
          .connect(user)
          .approve(FIRST_PROFILE_ID, [userTwoAddress], [true]);

        const receipt = await waitForTx(tx);

        expect(receipt.logs.length).to.eq(1);
        matchEvent(receipt, 'FollowsApproved', [
          userAddress,
          FIRST_PROFILE_ID,
          [userTwoAddress],
          [true],
          await getTimestamp(),
        ]);
      });

      it('Follow call should work when address was previously approved', async function () {
        await expect(
          lensHub.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, [])
        ).to.not.be.reverted;
        await expect(
          approvalFollowModule.connect(user).approve(FIRST_PROFILE_ID, [userTwoAddress], [true])
        ).to.not.be.reverted;
        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
      });

      it('Follow call to self should work when address was previously approved', async function () {
        await expect(
          lensHub.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, [])
        ).to.not.be.reverted;
        await expect(
          approvalFollowModule.connect(user).approve(FIRST_PROFILE_ID, [userAddress], [true])
        ).to.not.be.reverted;
        await expect(lensHub.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
      });
    });

    context('View Functions', function () {
      beforeEach(async function () {
        const data = abiCoder.encode(['address[]'], [[userTwoAddress]]);
        await expect(
          lensHub.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, data)
        ).to.not.be.reverted;
      });

      it('Single approval getter should return expected values', async function () {
        expect(
          await approvalFollowModule.isApproved(userAddress, FIRST_PROFILE_ID, userTwoAddress)
        ).to.eq(true);

        expect(
          await approvalFollowModule.isApproved(userAddress, FIRST_PROFILE_ID, userAddress)
        ).to.eq(false);
      });

      it('Array approval getter should return expected values', async function () {
        const result = await approvalFollowModule.isApprovedArray(userAddress, FIRST_PROFILE_ID, [
          userTwoAddress,
          userAddress,
        ]);
        expect(result[0]).to.eq(true);
        expect(result[1]).to.eq(false);
      });
    });
  });
});
