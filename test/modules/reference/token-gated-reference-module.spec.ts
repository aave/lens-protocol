import '@nomiclabs/hardhat-ethers';
import { parseEther } from '@ethersproject/units';
import { expect } from 'chai';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { getTimestamp, matchEvent, waitForTx } from '../../helpers/utils';
import {
  abiCoder,
  emptyCollectModule,
  FIRST_PROFILE_ID,
  tokenGatedReferenceModule,
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
  userTwoAddress,
  currency
} from '../../__setup.spec';

makeSuiteCleanRoom('Token Gated Reference Module', function () {
  const DEFAULT_MINIMUM_BALANCE = parseEther('1');

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
      lensHub
        .connect(governance)
        .whitelistReferenceModule(tokenGatedReferenceModule.address, true)
    ).to.not.be.reverted;
    await expect(
      lensHub.connect(governance).whitelistCollectModule(emptyCollectModule.address, true)
    ).to.not.be.reverted;
    const referenceModuleData = abiCoder.encode(
      ['address', 'uint256'],
      [currency.address, DEFAULT_MINIMUM_BALANCE]
    );
    await expect(
      lensHub.post({
        profileId: FIRST_PROFILE_ID,
        contentURI: MOCK_URI,
        collectModule: emptyCollectModule.address,
        collectModuleData: [],
        referenceModule: tokenGatedReferenceModule.address,
        referenceModuleData: referenceModuleData,
      })
    ).to.not.be.reverted;
  });

  context('Negatives', function () {
    context('Publishing', function () {
      it('Posting with token gated reference module as reference module should fail if token address is the zero address', async function () {
        const referenceModuleData = abiCoder.encode(
          ['address', 'uint256'],
          [ZERO_ADDRESS, DEFAULT_MINIMUM_BALANCE]
        );

        await expect(
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: emptyCollectModule.address,
            collectModuleData: [],
            referenceModule: tokenGatedReferenceModule.address,
            referenceModuleData: referenceModuleData,
          })
        ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
      });
    })

    context('Commenting', function () {
      it('Commenting should fail if the commenter does not pass the token gate.', async function () {
        expect(await currency.balanceOf(userAddress)).to.eq(0);

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
        ).to.be.revertedWith(ERRORS.NOT_ENOUGH_TOKENS);
      });
    });
    context('Mirroring', function () {
      it('Mirroring should fail if publisher does not pass the token gate.', async function () {
        expect(await currency.balanceOf(userAddress)).to.eq(0);

        await expect(
          lensHub.mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.be.revertedWith(ERRORS.NOT_ENOUGH_TOKENS);
      });
    });
  });

  context('Scenarios', function () {
    context('Publishing', function () {
      it('Posting with token gated reference module as reference module should emit expected events', async function () {
        const referenceModuleData = abiCoder.encode(
          ['address', 'uint256'],
          [currency.address, DEFAULT_MINIMUM_BALANCE]
        );

        const tx = lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: emptyCollectModule.address,
          collectModuleData: [],
          referenceModule: tokenGatedReferenceModule.address,
          referenceModuleData: referenceModuleData,
        });
        const receipt = await waitForTx(tx);
        expect(receipt.logs.length).to.eq(1);

        matchEvent(receipt, 'PostCreated', [
          FIRST_PROFILE_ID,
          2,
          MOCK_URI,
          emptyCollectModule.address,
          [],
          tokenGatedReferenceModule.address,
          referenceModuleData,
          await getTimestamp(),
        ]);
      });
    });

    context('Commenting', function () {
      it('Commenting should work if the commenter passes the token gate.', async function () {
        const userBalance = DEFAULT_MINIMUM_BALANCE.add(1);
        await expect(currency.mint(userAddress, userBalance)).to.not.be.reverted;
        expect(await currency.balanceOf(userAddress)).to.eq(userBalance);

        await expect(
          lensHub.comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            collectModule: emptyCollectModule.address,
            collectModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: []
          })
        ).to.not.be.reverted;

        // balance should be the same, it is a gate, not a payment
        expect(await currency.balanceOf(userAddress)).to.eq(userBalance);
      });
    });

    context('Mirroring', function () {
      it('Mirroring should work if publisher passes the token gate', async function () {
        const userBalance = DEFAULT_MINIMUM_BALANCE.add(1);
        await expect(currency.mint(userAddress, userBalance)).to.not.be.reverted;
        expect(await currency.balanceOf(userAddress)).to.eq(userBalance);

        await expect(
          lensHub.mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.not.be.reverted;

        // balance should be the same, it is a gate, not a payment
        expect(await currency.balanceOf(userAddress)).to.eq(userBalance);
      });
    });
  });
});
