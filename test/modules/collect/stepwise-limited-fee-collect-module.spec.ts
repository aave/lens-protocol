import { BigNumber } from '@ethersproject/contracts/node_modules/@ethersproject/bignumber';
import { parseEther } from '@ethersproject/units';
import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { getTimestamp, matchEvent, waitForTx } from '../../helpers/utils';
import {
  abiCoder,
  BPS_MAX,
  currency,
  FIRST_PROFILE_ID,
  governance,
  lensHub,
  stepwiseLimitedFeeCollectModule,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  moduleGlobals,
  REFERRAL_FEE_BPS,
  treasuryAddress,
  TREASURY_FEE_BPS,
  userAddress,
  userTwo,
  userTwoAddress,
} from '../../__setup.spec';

makeSuiteCleanRoom('Stepwise Limited Fee Collect Module', function () {
  const DEFAULT_COLLECT_PRICE = parseEther('10');
  const DEFAULT_COLLECT_STEP = parseEther('1');
  const DEFAULT_COLLECT_LIMIT = 3;

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
      lensHub.connect(governance).whitelistCollectModule(stepwiseLimitedFeeCollectModule.address, true)
    ).to.not.be.reverted;
    await expect(
      moduleGlobals.connect(governance).whitelistCurrency(currency.address, true)
    ).to.not.be.reverted;
  });

  context('Negatives', function () {
    context('Publication Creation', function () {
      it('user should fail to post with limited fee collect module using zero collect limit', async function () {
        const collectModuleData = abiCoder.encode(
          ['uint256', 'uint256', 'uint256', 'address', 'address', 'uint16'],
          [0, DEFAULT_COLLECT_PRICE, DEFAULT_COLLECT_STEP, currency.address, userAddress, REFERRAL_FEE_BPS]
        );
        await expect(
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: stepwiseLimitedFeeCollectModule.address,
            collectModuleData: collectModuleData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
      });

      it('user should fail to post with limited fee collect module using unwhitelisted currency', async function () {
        const collectModuleData = abiCoder.encode(
          ['uint256', 'uint256', 'uint256', 'address', 'address', 'uint16'],
          [
            DEFAULT_COLLECT_LIMIT,
            DEFAULT_COLLECT_PRICE,
            DEFAULT_COLLECT_STEP,
            userTwoAddress,
            userAddress,
            REFERRAL_FEE_BPS,
          ]
        );
        await expect(
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: stepwiseLimitedFeeCollectModule.address,
            collectModuleData: collectModuleData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
      });

      it('user should fail to post with limited fee collect module using zero recipient', async function () {
        const collectModuleData = abiCoder.encode(
          ['uint256', 'uint256', 'uint256', 'address', 'address', 'uint16'],
          [
            DEFAULT_COLLECT_LIMIT,
            DEFAULT_COLLECT_PRICE,
            DEFAULT_COLLECT_STEP,
            currency.address,
            ZERO_ADDRESS,
            REFERRAL_FEE_BPS,
          ]
        );
        await expect(
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: stepwiseLimitedFeeCollectModule.address,
            collectModuleData: collectModuleData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
      });

      it('user should fail to post with limited fee collect module using referral fee greater than max BPS', async function () {
        const collectModuleData = abiCoder.encode(
          ['uint256', 'uint256', 'uint256', 'address', 'address', 'uint16'],
          [DEFAULT_COLLECT_LIMIT, DEFAULT_COLLECT_PRICE, DEFAULT_COLLECT_STEP, currency.address, userAddress, 10001]
        );
        await expect(
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: stepwiseLimitedFeeCollectModule.address,
            collectModuleData: collectModuleData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
      });

      it('user should fail to post with limited fee collect module using amount lower than max BPS', async function () {
        const collectModuleData = abiCoder.encode(
          ['uint256', 'uint256', 'uint256', 'address', 'address', 'uint16'],
          [DEFAULT_COLLECT_LIMIT, 9999, DEFAULT_COLLECT_PRICE, currency.address, userAddress, REFERRAL_FEE_BPS]
        );
        await expect(
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: stepwiseLimitedFeeCollectModule.address,
            collectModuleData: collectModuleData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
      });
    });

    context('Collecting', function () {
      beforeEach(async function () {
        const collectModuleData = abiCoder.encode(
          ['uint256', 'uint256', 'uint256', 'address', 'address', 'uint16'],
          [
            DEFAULT_COLLECT_LIMIT,
            DEFAULT_COLLECT_PRICE,
            DEFAULT_COLLECT_STEP,
            currency.address,
            userAddress,
            REFERRAL_FEE_BPS,
          ]
        );
        await expect(
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: stepwiseLimitedFeeCollectModule.address,
            collectModuleData: collectModuleData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.not.be.reverted;
      });

      it('UserTwo should fail to collect without following', async function () {
        const data = abiCoder.encode(
          ['address', 'uint256'],
          [currency.address, DEFAULT_COLLECT_PRICE]
        );
        await expect(
          lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data)
        ).to.be.revertedWith(ERRORS.FOLLOW_INVALID);
      });

      it('UserTwo should fail to collect passing a different expected price in data', async function () {
        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

        const data = abiCoder.encode(
          ['address', 'uint256'],
          [currency.address, DEFAULT_COLLECT_PRICE.div(2)]
        );
        await expect(
          lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data)
        ).to.be.revertedWith(ERRORS.MODULE_DATA_MISMATCH);
      });

      it('UserTwo should fail to collect passing a different expected currency in data', async function () {
        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

        const data = abiCoder.encode(['address', 'uint256'], [userAddress, DEFAULT_COLLECT_PRICE]);
        await expect(
          lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data)
        ).to.be.revertedWith(ERRORS.MODULE_DATA_MISMATCH);
      });

      it('UserTwo should fail to collect without first approving module with currency', async function () {
        await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;

        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

        const data = abiCoder.encode(
          ['address', 'uint256'],
          [currency.address, DEFAULT_COLLECT_PRICE]
        );
        await expect(
          lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data)
        ).to.be.revertedWith(ERRORS.ERC20_TRANSFER_EXCEEDS_ALLOWANCE);
      });

      it('UserTwo should mirror the original post, fail to collect from their mirror without following the original profile', async function () {
        const secondProfileId = FIRST_PROFILE_ID + 1;
        await expect(
          lensHub.connect(userTwo).createProfile({
            to: userTwoAddress,
            handle: 'usertwo',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.not.be.reverted;
        await expect(
          lensHub.connect(userTwo).mirror({
            profileId: secondProfileId,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.not.be.reverted;

        const data = abiCoder.encode(
          ['address', 'uint256'],
          [currency.address, DEFAULT_COLLECT_PRICE]
        );
        await expect(lensHub.connect(userTwo).collect(secondProfileId, 1, data)).to.be.revertedWith(
          ERRORS.FOLLOW_INVALID
        );
      });

      it('UserTwo should mirror the original post, fail to collect from their mirror passing a different expected price in data', async function () {
        const secondProfileId = FIRST_PROFILE_ID + 1;
        await expect(
          lensHub.connect(userTwo).createProfile({
            to: userTwoAddress,
            handle: 'usertwo',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.not.be.reverted;
        await expect(
          lensHub.connect(userTwo).mirror({
            profileId: secondProfileId,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.not.be.reverted;

        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const data = abiCoder.encode(
          ['address', 'uint256'],
          [currency.address, DEFAULT_COLLECT_PRICE.div(2)]
        );
        await expect(lensHub.connect(userTwo).collect(secondProfileId, 1, data)).to.be.revertedWith(
          ERRORS.MODULE_DATA_MISMATCH
        );
      });

      it('UserTwo should mirror the original post, fail to collect from their mirror passing a different expected currency in data', async function () {
        const secondProfileId = FIRST_PROFILE_ID + 1;
        await expect(
          lensHub.connect(userTwo).createProfile({
            to: userTwoAddress,
            handle: 'usertwo',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.not.be.reverted;
        await expect(
          lensHub.connect(userTwo).mirror({
            profileId: secondProfileId,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModule: ZERO_ADDRESS,
            referenceModuleData: [],
          })
        ).to.not.be.reverted;

        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const data = abiCoder.encode(['address', 'uint256'], [userAddress, DEFAULT_COLLECT_PRICE]);
        await expect(lensHub.connect(userTwo).collect(secondProfileId, 1, data)).to.be.revertedWith(
          ERRORS.MODULE_DATA_MISMATCH
        );
      });
    });
  });

  context('Scenarios', function () {
    it('User should post with stepwise limited fee collect module as the collect module and data, correct events should be emitted', async function () {
      const collectModuleData = abiCoder.encode(
        ['uint256', 'uint256', 'uint256', 'address', 'address', 'uint16'],
        [
          DEFAULT_COLLECT_LIMIT,
          DEFAULT_COLLECT_PRICE,
          DEFAULT_COLLECT_STEP,
          currency.address,
          userAddress,
          REFERRAL_FEE_BPS,
        ]
      );
      const tx = lensHub.post({
        profileId: FIRST_PROFILE_ID,
        contentURI: MOCK_URI,
        collectModule: stepwiseLimitedFeeCollectModule.address,
        collectModuleData: collectModuleData,
        referenceModule: ZERO_ADDRESS,
        referenceModuleData: [],
      });

      const receipt = await waitForTx(tx);

      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'PostCreated', [
        FIRST_PROFILE_ID,
        1,
        MOCK_URI,
        stepwiseLimitedFeeCollectModule.address,
        collectModuleData,
        ZERO_ADDRESS,
        [],
        await getTimestamp(),
      ]);
    });

    it('User should post with stepwise limited fee collect module as the collect module and data, fetched publication data should be accurate', async function () {
      const collectModuleData = abiCoder.encode(
        ['uint256', 'uint256', 'uint256', 'address', 'address', 'uint16'],
        [
          DEFAULT_COLLECT_LIMIT,
          DEFAULT_COLLECT_PRICE,
          DEFAULT_COLLECT_STEP,
          currency.address,
          userAddress,
          REFERRAL_FEE_BPS,
        ]
      );
      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: stepwiseLimitedFeeCollectModule.address,
          collectModuleData: collectModuleData,
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;

      const fetchedData = await stepwiseLimitedFeeCollectModule.getPublicationData(FIRST_PROFILE_ID, 1);
      expect(fetchedData.collectLimit).to.eq(DEFAULT_COLLECT_LIMIT);
      expect(fetchedData.amount).to.eq(DEFAULT_COLLECT_PRICE);
      expect(fetchedData.step).to.eq(DEFAULT_COLLECT_STEP);
      expect(fetchedData.recipient).to.eq(userAddress);
      expect(fetchedData.currency).to.eq(currency.address);
      expect(fetchedData.referralFee).to.eq(REFERRAL_FEE_BPS);
    });

    it('User should post with stepwise limited fee collect module as the collect module and data, user two follows, then collects and pays fee, fee distribution is valid', async function () {
      const collectModuleData = abiCoder.encode(
        ['uint256', 'uint256', 'uint256', 'address', 'address', 'uint16'],
        [
          DEFAULT_COLLECT_LIMIT,
          DEFAULT_COLLECT_PRICE,
          DEFAULT_COLLECT_STEP,
          currency.address,
          userAddress,
          REFERRAL_FEE_BPS,
        ]
      );
      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: stepwiseLimitedFeeCollectModule.address,
          collectModuleData: collectModuleData,
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;

      await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
      await expect(
        currency.connect(userTwo).approve(stepwiseLimitedFeeCollectModule.address, MAX_UINT256)
      ).to.not.be.reverted;
      await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
      const data = abiCoder.encode(
        ['address', 'uint256'],
        [currency.address, DEFAULT_COLLECT_PRICE]
      );
      await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data)).to.not.be.reverted;

      const expectedTreasuryAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
        .mul(TREASURY_FEE_BPS)
        .div(BPS_MAX);
      const expectedRecipientAmount =
        BigNumber.from(DEFAULT_COLLECT_PRICE).sub(expectedTreasuryAmount);

      expect(await currency.balanceOf(userTwoAddress)).to.eq(
        BigNumber.from(MAX_UINT256).sub(DEFAULT_COLLECT_PRICE)
      );
      expect(await currency.balanceOf(userAddress)).to.eq(expectedRecipientAmount);
      expect(await currency.balanceOf(treasuryAddress)).to.eq(expectedTreasuryAmount);
    });

    it('User should post with stepwise limited fee collect module as the collect module and data, user two follows, then collects twice, fee distribution is valid', async function () {
      const collectModuleData = abiCoder.encode(
        ['uint256', 'uint256', 'uint256', 'address', 'address', 'uint16'],
        [
          DEFAULT_COLLECT_LIMIT,
          DEFAULT_COLLECT_PRICE,
          DEFAULT_COLLECT_STEP,
          currency.address,
          userAddress,
          REFERRAL_FEE_BPS,
        ]
      );
      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: stepwiseLimitedFeeCollectModule.address,
          collectModuleData: collectModuleData,
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;

      await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
      await expect(
        currency.connect(userTwo).approve(stepwiseLimitedFeeCollectModule.address, MAX_UINT256)
      ).to.not.be.reverted;
      await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

      const data1 = abiCoder.encode(
        ['address', 'uint256'],
        [currency.address, DEFAULT_COLLECT_PRICE]
      );
      await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data1)).to.not.be.reverted;
      const data2 = abiCoder.encode(
        ['address', 'uint256'],
        [currency.address, DEFAULT_COLLECT_PRICE.add(DEFAULT_COLLECT_STEP)]
      );
      await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data2)).to.not.be.reverted;

      const expectedTreasuryAmount1 = BigNumber.from(DEFAULT_COLLECT_PRICE)
        .mul(TREASURY_FEE_BPS)
        .div(BPS_MAX);
      const expectedTreasuryAmount2 = BigNumber.from(DEFAULT_COLLECT_PRICE.add(DEFAULT_COLLECT_STEP))
        .mul(TREASURY_FEE_BPS)
        .div(BPS_MAX);
      const expectedRecipientAmount1 =
        BigNumber.from(DEFAULT_COLLECT_PRICE).sub(expectedTreasuryAmount1);
      const expectedRecipientAmount2 =
        BigNumber.from(DEFAULT_COLLECT_PRICE.add(DEFAULT_COLLECT_STEP)).sub(expectedTreasuryAmount2);
      expect(await currency.balanceOf(userTwoAddress)).to.eq(
        BigNumber.from(MAX_UINT256).sub(BigNumber.from(DEFAULT_COLLECT_PRICE).mul(2).add(DEFAULT_COLLECT_STEP))
      );
      expect(await currency.balanceOf(userAddress)).to.eq(expectedRecipientAmount1.add(expectedRecipientAmount2));
      expect(await currency.balanceOf(treasuryAddress)).to.eq(expectedTreasuryAmount1.add(expectedTreasuryAmount2));
    });

    it('User should post with stepwise limited fee collect module as the collect module and data, user two mirrors, follows, then collects from their mirror and pays fee, fee distribution is valid', async function () {
      const secondProfileId = FIRST_PROFILE_ID + 1;
      const collectModuleData = abiCoder.encode(
        ['uint256', 'uint256', 'uint256', 'address', 'address', 'uint16'],
        [
          DEFAULT_COLLECT_LIMIT,
          DEFAULT_COLLECT_PRICE,
          DEFAULT_COLLECT_STEP,
          currency.address,
          userAddress,
          REFERRAL_FEE_BPS,
        ]
      );
      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: stepwiseLimitedFeeCollectModule.address,
          collectModuleData: collectModuleData,
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;

      await expect(
        lensHub.connect(userTwo).createProfile({
          to: userTwoAddress,
          handle: 'usertwo',
          imageURI: MOCK_PROFILE_URI,
          followModule: ZERO_ADDRESS,
          followModuleData: [],
          followNFTURI: MOCK_FOLLOW_NFT_URI,
        })
      ).to.not.be.reverted;
      await expect(
        lensHub.connect(userTwo).mirror({
          profileId: secondProfileId,
          profileIdPointed: FIRST_PROFILE_ID,
          pubIdPointed: 1,
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;

      await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
      await expect(
        currency.connect(userTwo).approve(stepwiseLimitedFeeCollectModule.address, MAX_UINT256)
      ).to.not.be.reverted;
      await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
      const data = abiCoder.encode(
        ['address', 'uint256'],
        [currency.address, DEFAULT_COLLECT_PRICE]
      );
      await expect(lensHub.connect(userTwo).collect(secondProfileId, 1, data)).to.not.be.reverted;

      const expectedTreasuryAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
        .mul(TREASURY_FEE_BPS)
        .div(BPS_MAX);
      const expectedReferralAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
        .sub(expectedTreasuryAmount)
        .mul(REFERRAL_FEE_BPS)
        .div(BPS_MAX);
      const expectedReferrerAmount = BigNumber.from(MAX_UINT256)
        .sub(DEFAULT_COLLECT_PRICE)
        .add(expectedReferralAmount);
      const expectedRecipientAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
        .sub(expectedTreasuryAmount)
        .sub(expectedReferralAmount);

      expect(await currency.balanceOf(userTwoAddress)).to.eq(expectedReferrerAmount);
      expect(await currency.balanceOf(userAddress)).to.eq(expectedRecipientAmount);
      expect(await currency.balanceOf(treasuryAddress)).to.eq(expectedTreasuryAmount);
    });

    it('User should post with stepwise limited fee collect module as the collect module and data, with no referral fee, user two mirrors, follows, then collects from their mirror and pays fee, fee distribution is valid', async function () {
      const secondProfileId = FIRST_PROFILE_ID + 1;
      const collectModuleData = abiCoder.encode(
        ['uint256', 'uint256', 'uint256', 'address', 'address', 'uint16'],
        [DEFAULT_COLLECT_LIMIT, DEFAULT_COLLECT_PRICE, DEFAULT_COLLECT_STEP, currency.address, userAddress, 0]
      );
      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: stepwiseLimitedFeeCollectModule.address,
          collectModuleData: collectModuleData,
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;

      await expect(
        lensHub.connect(userTwo).createProfile({
          to: userTwoAddress,
          handle: 'usertwo',
          imageURI: MOCK_PROFILE_URI,
          followModule: ZERO_ADDRESS,
          followModuleData: [],
          followNFTURI: MOCK_FOLLOW_NFT_URI,
        })
      ).to.not.be.reverted;
      await expect(
        lensHub.connect(userTwo).mirror({
          profileId: secondProfileId,
          profileIdPointed: FIRST_PROFILE_ID,
          pubIdPointed: 1,
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;

      await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
      await expect(
        currency.connect(userTwo).approve(stepwiseLimitedFeeCollectModule.address, MAX_UINT256)
      ).to.not.be.reverted;
      await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
      const data = abiCoder.encode(
        ['address', 'uint256'],
        [currency.address, DEFAULT_COLLECT_PRICE]
      );
      await expect(lensHub.connect(userTwo).collect(secondProfileId, 1, data)).to.not.be.reverted;

      const expectedTreasuryAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
        .mul(TREASURY_FEE_BPS)
        .div(BPS_MAX);
      const expectedRecipientAmount =
        BigNumber.from(DEFAULT_COLLECT_PRICE).sub(expectedTreasuryAmount);

      expect(await currency.balanceOf(userTwoAddress)).to.eq(
        BigNumber.from(MAX_UINT256).sub(DEFAULT_COLLECT_PRICE)
      );
      expect(await currency.balanceOf(userAddress)).to.eq(expectedRecipientAmount);
      expect(await currency.balanceOf(treasuryAddress)).to.eq(expectedTreasuryAmount);
    });

    it('User should post with stepwise limited fee collect module as the collect module and data, user two mirrors, follows, then collects once from the original, twice from the mirror, and fails to collect a third time from either the mirror or the original', async function () {
      const secondProfileId = FIRST_PROFILE_ID + 1;
      const collectModuleData = abiCoder.encode(
        ['uint256', 'uint256', 'uint256', 'address', 'address', 'uint16'],
        [
          DEFAULT_COLLECT_LIMIT,
          DEFAULT_COLLECT_PRICE,
          DEFAULT_COLLECT_STEP,
          currency.address,
          userAddress,
          REFERRAL_FEE_BPS,
        ]
      );
      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: stepwiseLimitedFeeCollectModule.address,
          collectModuleData: collectModuleData,
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;

      await expect(
        lensHub.connect(userTwo).createProfile({
          to: userTwoAddress,
          handle: 'usertwo',
          imageURI: MOCK_PROFILE_URI,
          followModule: ZERO_ADDRESS,
          followModuleData: [],
          followNFTURI: MOCK_FOLLOW_NFT_URI,
        })
      ).to.not.be.reverted;
      await expect(
        lensHub.connect(userTwo).mirror({
          profileId: secondProfileId,
          profileIdPointed: FIRST_PROFILE_ID,
          pubIdPointed: 1,
          referenceModule: ZERO_ADDRESS,
          referenceModuleData: [],
        })
      ).to.not.be.reverted;

      await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
      await expect(
        currency.connect(userTwo).approve(stepwiseLimitedFeeCollectModule.address, MAX_UINT256)
      ).to.not.be.reverted;
      await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
      const data1 = abiCoder.encode(
        ['address', 'uint256'],
        [currency.address, DEFAULT_COLLECT_PRICE]
      );
      await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data1)).to.not.be.reverted;
      const data2 = abiCoder.encode(
        ['address', 'uint256'],
        [currency.address, DEFAULT_COLLECT_PRICE.add(DEFAULT_COLLECT_STEP)]
      );
      await expect(lensHub.connect(userTwo).collect(secondProfileId, 1, data2)).to.not.be.reverted;
      const data3 = abiCoder.encode(
        ['address', 'uint256'],
        [currency.address, DEFAULT_COLLECT_PRICE.add(DEFAULT_COLLECT_STEP).add(DEFAULT_COLLECT_STEP)]
      );
      await expect(lensHub.connect(userTwo).collect(secondProfileId, 1, data3)).to.not.be.reverted;

      const data4 = abiCoder.encode(
        ['address', 'uint256'],
        [currency.address, DEFAULT_COLLECT_PRICE.add(DEFAULT_COLLECT_STEP).add(DEFAULT_COLLECT_STEP).add(DEFAULT_COLLECT_STEP).add(DEFAULT_COLLECT_STEP)]
      );
      await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data4)).to.be.revertedWith(
        ERRORS.MINT_LIMIT_EXCEEDED
      );
      await expect(lensHub.connect(userTwo).collect(secondProfileId, 1, data4)).to.be.revertedWith(
        ERRORS.MINT_LIMIT_EXCEEDED
      );
    });
  });
});
