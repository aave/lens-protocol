import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import {
  getCollectWithSigParts,
  getCommentWithSigParts,
  getFollowWithSigParts,
  getMirrorWithSigParts,
  getPostWithSigParts,
  getSetDispatcherWithSigParts,
  getSetFollowModuleWithSigParts,
  getSetFollowNFTURIWithSigParts,
  getSetProfileImageURIWithSigParts,
  ProtocolState,
} from '../../helpers/utils';
import {
  freeCollectModule,
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
  userTwoAddress,
  abiCoder,
} from '../../__setup.spec';

makeSuiteCleanRoom('Multi-State Hub', function () {
  context('Common', function () {
    context('Negatives', function () {
      it('User should fail to set the state on the hub', async function () {
        await expect(lensHub.setState(ProtocolState.Paused)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE_OR_EMERGENCY_ADMIN
        );
        await expect(lensHub.setState(ProtocolState.Unpaused)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE_OR_EMERGENCY_ADMIN
        );
        await expect(lensHub.setState(ProtocolState.PublishingPaused)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE_OR_EMERGENCY_ADMIN
        );
      });

      it('User should fail to set the emergency admin', async function () {
        await expect(lensHub.setEmergencyAdmin(userAddress)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE
        );
      });

      it('Governance should set user as emergency admin, user should fail to set protocol state to Unpaused', async function () {
        await expect(lensHub.connect(governance).setEmergencyAdmin(userAddress)).to.not.be.reverted;
        await expect(lensHub.setState(ProtocolState.Unpaused)).to.be.revertedWith(
          ERRORS.EMERGENCY_ADMIN_CAN_ONLY_PAUSE_FURTHER
        );
      });

      it('Governance should set user as emergency admin, user should fail to set protocol state to PublishingPaused or Paused from Paused', async function () {
        await expect(lensHub.connect(governance).setEmergencyAdmin(userAddress)).to.not.be.reverted;
        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;
        await expect(lensHub.setState(ProtocolState.PublishingPaused)).to.be.revertedWith(
          ERRORS.EMERGENCY_ADMIN_CAN_ONLY_PAUSE_FURTHER
        );
        await expect(lensHub.setState(ProtocolState.Paused)).to.be.revertedWith(
          ERRORS.EMERGENCY_ADMIN_CAN_ONLY_PAUSE_FURTHER
        );
      });
    });

    context('Scenarios', function () {
      it('Governance should set user as emergency admin, user sets protocol state but fails to set emergency admin, governance sets emergency admin to the zero address, user fails to set protocol state', async function () {
        await expect(lensHub.connect(governance).setEmergencyAdmin(userAddress)).to.not.be.reverted;

        await expect(lensHub.setState(ProtocolState.PublishingPaused)).to.not.be.reverted;
        await expect(lensHub.setState(ProtocolState.Paused)).to.not.be.reverted;
        await expect(lensHub.setEmergencyAdmin(ZERO_ADDRESS)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE
        );

        await expect(
          lensHub.connect(governance).setEmergencyAdmin(ZERO_ADDRESS)
        ).to.not.be.reverted;

        await expect(lensHub.setState(ProtocolState.Paused)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE_OR_EMERGENCY_ADMIN
        );
        await expect(lensHub.setState(ProtocolState.PublishingPaused)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE_OR_EMERGENCY_ADMIN
        );
        await expect(lensHub.setState(ProtocolState.Unpaused)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE_OR_EMERGENCY_ADMIN
        );
      });

      it('Governance should set the protocol state, fetched protocol state should be accurate', async function () {
        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;
        expect(await lensHub.getState()).to.eq(ProtocolState.Paused);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;
        expect(await lensHub.getState()).to.eq(ProtocolState.PublishingPaused);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;
        expect(await lensHub.getState()).to.eq(ProtocolState.Unpaused);
      });

      it('Governance should set user as emergency admin, user should set protocol state to PublishingPaused, then Paused, then fail to set it to PublishingPaused', async function () {
        await expect(lensHub.connect(governance).setEmergencyAdmin(userAddress)).to.not.be.reverted;

        await expect(lensHub.setState(ProtocolState.PublishingPaused)).to.not.be.reverted;
        await expect(lensHub.setState(ProtocolState.Paused)).to.not.be.reverted;
        await expect(lensHub.setState(ProtocolState.PublishingPaused)).to.be.revertedWith(
          ERRORS.EMERGENCY_ADMIN_CAN_ONLY_PAUSE_FURTHER
        );
      });
    });
  });

  context('Paused State', function () {
    context('Scenarios', async function () {
      it('User should create a profile, governance should pause the hub, transferring the profile should fail', async function () {
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

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(
          lensHub.transferFrom(userAddress, userTwoAddress, FIRST_PROFILE_ID)
        ).to.be.revertedWith(ERRORS.PAUSED);
      });

      it('Governance should pause the hub, profile creation should fail, then governance unpauses the hub and profile creation should work', async function () {
        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.be.revertedWith(ERRORS.PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
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
      });

      it('Governance should pause the hub, setting follow module should fail, then governance unpauses the hub and setting follow module should work', async function () {
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

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(
          lensHub.setFollowModule(FIRST_PROFILE_ID, ZERO_ADDRESS, [])
        ).to.be.revertedWith(ERRORS.PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(
          lensHub.setFollowModule(FIRST_PROFILE_ID, ZERO_ADDRESS, [])
        ).to.not.be.reverted;
      });

      it('Governance should pause the hub, setting follow module with sig should fail, then governance unpauses the hub and setting follow module with sig should work', async function () {
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

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getSetFollowModuleWithSigParts(
          FIRST_PROFILE_ID,
          ZERO_ADDRESS,
          [],
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.setFollowModuleWithSig({
            profileId: FIRST_PROFILE_ID,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(
          lensHub.setFollowModuleWithSig({
            profileId: FIRST_PROFILE_ID,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.not.be.reverted;
      });

      it('Governance should pause the hub, setting dispatcher should fail, then governance unpauses the hub and setting dispatcher should work', async function () {
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

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(lensHub.setDispatcher(FIRST_PROFILE_ID, userTwoAddress)).to.be.revertedWith(
          ERRORS.PAUSED
        );

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(lensHub.setDispatcher(FIRST_PROFILE_ID, userTwoAddress)).to.not.be.reverted;
      });

      it('Governance should pause the hub, setting dispatcher with sig should fail, then governance unpauses the hub and setting dispatcher with sig should work', async function () {
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

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

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
        ).to.be.revertedWith(ERRORS.PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

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
      });

      it('Governance should pause the hub, setting profile URI should fail, then governance unpauses the hub and setting profile URI should work', async function () {
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

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(lensHub.setProfileImageURI(FIRST_PROFILE_ID, MOCK_URI)).to.be.revertedWith(
          ERRORS.PAUSED
        );

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(lensHub.setProfileImageURI(FIRST_PROFILE_ID, MOCK_URI)).to.not.be.reverted;
      });

      it('Governance should pause the hub, setting profile URI with sig should fail, then governance unpauses the hub and setting profile URI should work', async function () {
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

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const { v, r, s } = await getSetProfileImageURIWithSigParts(
          FIRST_PROFILE_ID,
          MOCK_URI,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.setProfileImageURIWithSig({
            profileId: FIRST_PROFILE_ID,
            imageURI: MOCK_URI,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(
          lensHub.setProfileImageURIWithSig({
            profileId: FIRST_PROFILE_ID,
            imageURI: MOCK_URI,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.not.be.reverted;
      });

      it('Governance should pause the hub, setting follow NFT URI should fail, then governance unpauses the hub and setting follow NFT URI should work', async function () {
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

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(lensHub.setFollowNFTURI(FIRST_PROFILE_ID, MOCK_URI)).to.be.revertedWith(
          ERRORS.PAUSED
        );

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(lensHub.setFollowNFTURI(FIRST_PROFILE_ID, MOCK_URI)).to.not.be.reverted;
      });

      it('Governance should pause the hub, setting follow NFT URI with sig should fail, then governance unpauses the hub and setting follow NFT URI should work', async function () {
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

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const { v, r, s } = await getSetFollowNFTURIWithSigParts(
          FIRST_PROFILE_ID,
          MOCK_URI,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.setFollowNFTURIWithSig({
            profileId: FIRST_PROFILE_ID,
            followNFTURI: MOCK_URI,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(
          lensHub.setFollowNFTURIWithSig({
            profileId: FIRST_PROFILE_ID,
            followNFTURI: MOCK_URI,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.not.be.reverted;
      });

      it('Governance should pause the hub, posting should fail, then governance unpauses the hub and posting should work', async function () {
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

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(
          lensHub.connect(governance).whitelistCollectModule(freeCollectModule.address, true)
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
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
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

      it('Governance should pause the hub, posting with sig should fail, then governance unpauses the hub and posting with sig should work', async function () {
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

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(
          lensHub.connect(governance).whitelistCollectModule(freeCollectModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleInitData = abiCoder.encode(['bool'], [true]);
        const referenceModuleInitData = [];
        const referenceModuleData = [];
        const { v, r, s } = await getPostWithSigParts(
          FIRST_PROFILE_ID,
          MOCK_URI,
          freeCollectModule.address,
          collectModuleInitData,
          ZERO_ADDRESS,
          referenceModuleInitData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.postWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
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
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(
          lensHub.postWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
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
      });

      it('Governance should pause the hub, commenting should fail, then governance unpauses the hub and commenting should work', async function () {
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
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: freeCollectModule.address,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

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
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

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
      });

      it('Governance should pause the hub, commenting with sig should fail, then governance unpauses the hub and commenting with sig should work', async function () {
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

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

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
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(
          lensHub.commentWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
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
      });

      it('Governance should pause the hub, mirroring should fail, then governance unpauses the hub and mirroring should work', async function () {
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
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: freeCollectModule.address,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(
          lensHub.mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(
          lensHub.mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      });

      it('Governance should pause the hub, mirroring with sig should fail, then governance unpauses the hub and mirroring with sig should work', async function () {
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

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const referenceModuleInitData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getMirrorWithSigParts(
          FIRST_PROFILE_ID,
          FIRST_PROFILE_ID,
          '1',
          referenceModuleData,
          ZERO_ADDRESS,
          referenceModuleInitData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.mirrorWithSig({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '1',
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: referenceModuleInitData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(
          lensHub.mirrorWithSig({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '1',
            referenceModuleData: [],
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
      });

      it('Governance should pause the hub, burning should fail, then governance unpauses the hub and burning should work', async function () {
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

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(lensHub.burn(FIRST_PROFILE_ID)).to.be.revertedWith(ERRORS.PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(lensHub.burn(FIRST_PROFILE_ID)).to.not.be.reverted;
      });

      it('Governance should pause the hub, following should fail, then governance unpauses the hub and following should work', async function () {
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

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(lensHub.follow([FIRST_PROFILE_ID], [[]])).to.be.revertedWith(ERRORS.PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(lensHub.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
      });

      it('Governance should pause the hub, following with sig should fail, then governance unpauses the hub and following with sig should work', async function () {
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

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getFollowWithSigParts(
          [FIRST_PROFILE_ID],
          [[]],
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.followWithSig({
            follower: testWallet.address,
            profileIds: [FIRST_PROFILE_ID],
            datas: [[]],
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(
          lensHub.followWithSig({
            follower: testWallet.address,
            profileIds: [FIRST_PROFILE_ID],
            datas: [[]],
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.not.be.reverted;
      });

      it('Governance should pause the hub, collecting should fail, then governance unpauses the hub and collecting should work', async function () {
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
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: freeCollectModule.address,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(lensHub.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(lensHub.collect(FIRST_PROFILE_ID, 1, [])).to.be.revertedWith(ERRORS.PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(lensHub.collect(FIRST_PROFILE_ID, 1, [])).to.not.be.reverted;
      });

      it('Governance should pause the hub, collecting with sig should fail, then governance unpauses the hub and collecting with sig should work', async function () {
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

        await expect(
          lensHub.connect(testWallet).follow([FIRST_PROFILE_ID], [[]])
        ).to.not.be.reverted;

        await expect(lensHub.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

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
        ).to.be.revertedWith(ERRORS.PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

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
      });
    });
  });

  context('PublishingPaused State', function () {
    context('Scenarios', async function () {
      it('Governance should pause publishing, profile creation should work', async function () {
        await expect(
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
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
      });

      it('Governance should pause publishing, setting follow module should work', async function () {
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
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        await expect(
          lensHub.setFollowModule(FIRST_PROFILE_ID, ZERO_ADDRESS, [])
        ).to.not.be.reverted;
      });

      it('Governance should pause publishing, setting follow module with sig should work', async function () {
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
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getSetFollowModuleWithSigParts(
          FIRST_PROFILE_ID,
          ZERO_ADDRESS,
          [],
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.setFollowModuleWithSig({
            profileId: FIRST_PROFILE_ID,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.not.be.reverted;
      });

      it('Governance should pause publishing, setting dispatcher should work', async function () {
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
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        await expect(lensHub.setDispatcher(FIRST_PROFILE_ID, userTwoAddress)).to.not.be.reverted;
      });

      it('Governance should pause publishing, setting dispatcher with sig should work', async function () {
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
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

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
      });

      it('Governance should pause publishing, setting profile URI should work', async function () {
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
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        await expect(lensHub.setProfileImageURI(FIRST_PROFILE_ID, MOCK_URI)).to.not.be.reverted;
      });

      it('Governance should pause publishing, setting profile URI with sig should work', async function () {
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
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const { v, r, s } = await getSetProfileImageURIWithSigParts(
          FIRST_PROFILE_ID,
          MOCK_URI,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.setProfileImageURIWithSig({
            profileId: FIRST_PROFILE_ID,
            imageURI: MOCK_URI,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.not.be.reverted;
      });

      it('Governance should pause publishing, posting should fail, then governance unpauses the hub and posting should work', async function () {
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
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
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
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
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

      it('Governance should pause publishing, posting with sig should fail, then governance unpauses the hub and posting with sig should work', async function () {
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
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        await expect(
          lensHub.connect(governance).whitelistCollectModule(freeCollectModule.address, true)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const collectModuleInitData = abiCoder.encode(['bool'], [true]);
        const referenceModuleInitData = [];
        const referenceModuleData = [];
        const { v, r, s } = await getPostWithSigParts(
          FIRST_PROFILE_ID,
          MOCK_URI,
          freeCollectModule.address,
          collectModuleInitData,
          ZERO_ADDRESS,
          referenceModuleInitData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.postWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
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
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(
          lensHub.postWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
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
      });

      it('Governance should pause publishing, commenting should fail, then governance unpauses the hub and commenting should work', async function () {
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
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: freeCollectModule.address,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

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
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

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
      });

      it('Governance should pause publishing, commenting with sig should fail, then governance unpauses the hub and commenting with sig should work', async function () {
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

        await expect(
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
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
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(
          lensHub.commentWithSig({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
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
      });

      it('Governance should pause publishing, mirroring should fail, then governance unpauses the hub and mirroring should work', async function () {
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
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: freeCollectModule.address,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        await expect(
          lensHub.mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(
          lensHub.mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      });

      it('Governance should pause publishing, mirroring with sig should fail, then governance unpauses the hub and mirroring with sig should work', async function () {
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

        await expect(
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const referenceModuleInitData = [];
        const referenceModuleData = [];

        const { v, r, s } = await getMirrorWithSigParts(
          FIRST_PROFILE_ID,
          FIRST_PROFILE_ID,
          '1',
          referenceModuleData,
          ZERO_ADDRESS,
          referenceModuleInitData,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.mirrorWithSig({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '1',
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: referenceModuleInitData,
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          lensHub.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(
          lensHub.mirrorWithSig({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: '1',
            referenceModuleData: [],
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
      });

      it('Governance should pause publishing, burning should work', async function () {
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
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        await expect(lensHub.burn(FIRST_PROFILE_ID)).to.not.be.reverted;
      });

      it('Governance should pause publishing, following should work', async function () {
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
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        await expect(lensHub.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
      });

      it('Governance should pause publishing, following with sig should work', async function () {
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
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getFollowWithSigParts(
          [FIRST_PROFILE_ID],
          [[]],
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.followWithSig({
            follower: testWallet.address,
            profileIds: [FIRST_PROFILE_ID],
            datas: [[]],
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.not.be.reverted;
      });

      it('Governance should pause publishing, collecting should work', async function () {
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
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: freeCollectModule.address,
            collectModuleInitData: abiCoder.encode(['bool'], [true]),
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(lensHub.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

        await expect(
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        await expect(lensHub.collect(FIRST_PROFILE_ID, 1, [])).to.not.be.reverted;
      });

      it('Governance should pause publishing, collecting with sig should work', async function () {
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

        await expect(
          lensHub.connect(testWallet).follow([FIRST_PROFILE_ID], [[]])
        ).to.not.be.reverted;

        await expect(
          lensHub.connect(governance).setState(ProtocolState.PublishingPaused)
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
      });
    });
  });
});
