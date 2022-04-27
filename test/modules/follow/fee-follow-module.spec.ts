import { BigNumber } from '@ethersproject/bignumber';
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
  feeFollowModule,
  FIRST_PROFILE_ID,
  governance,
  lensHub,
  lensHubImpl,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  moduleGlobals,
  treasuryAddress,
  TREASURY_FEE_BPS,
  userAddress,
  userTwo,
  userTwoAddress,
} from '../../__setup.spec';

makeSuiteCleanRoom('Fee Follow Module', function () {
  const DEFAULT_FOLLOW_PRICE = parseEther('10');

  beforeEach(async function () {
    await expect(
      lensHub.connect(governance).whitelistFollowModule(feeFollowModule.address, true)
    ).to.not.be.reverted;
    await expect(
      moduleGlobals.connect(governance).whitelistCurrency(currency.address, true)
    ).to.not.be.reverted;
  });

  context('Negatives', function () {
    context('Initialization', function () {
      it('user should fail to create a profile with fee follow module using unwhitelisted currency', async function () {
        const followModuleInitData = abiCoder.encode(
          ['uint256', 'address', 'address'],
          [DEFAULT_FOLLOW_PRICE, userTwoAddress, userAddress]
        );

        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: feeFollowModule.address,
            followModuleInitData: followModuleInitData,
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
      });

      it('user should fail to create a profile with fee follow module using zero recipient', async function () {
        const followModuleInitData = abiCoder.encode(
          ['uint256', 'address', 'address'],
          [DEFAULT_FOLLOW_PRICE, currency.address, ZERO_ADDRESS]
        );

        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: feeFollowModule.address,
            followModuleInitData: followModuleInitData,
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
      });

      it('user should fail to create a profile with fee follow module using zero amount', async function () {
        const followModuleInitData = abiCoder.encode(
          ['uint256', 'address', 'address'],
          [0, currency.address, userAddress]
        );

        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: feeFollowModule.address,
            followModuleInitData: followModuleInitData,
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
      });
    });

    context('Following', function () {
      beforeEach(async function () {
        const followModuleInitData = abiCoder.encode(
          ['uint256', 'address', 'address'],
          [DEFAULT_FOLLOW_PRICE, currency.address, userAddress]
        );
        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: feeFollowModule.address,
            followModuleInitData: followModuleInitData,
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.not.be.reverted;
      });

      it('UserTwo should fail to process follow without being the hub', async function () {
        await expect(
          feeFollowModule.connect(userTwo).processFollow(userTwoAddress, FIRST_PROFILE_ID, [])
        ).to.be.revertedWith(ERRORS.NOT_HUB);
      });

      it('Governance should set the treasury fee BPS to zero, userTwo following should not emit a transfer event to the treasury', async function () {
        await expect(moduleGlobals.connect(governance).setTreasuryFee(0)).to.not.be.reverted;
        const data = abiCoder.encode(
          ['address', 'uint256'],
          [currency.address, DEFAULT_FOLLOW_PRICE]
        );
        await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
        await expect(
          currency.connect(userTwo).approve(feeFollowModule.address, MAX_UINT256)
        ).to.not.be.reverted;

        const tx = lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data]);
        const receipt = await waitForTx(tx);

        let currencyEventCount = 0;
        for (let log of receipt.logs) {
          if (log.address == currency.address) {
            currencyEventCount++;
          }
        }
        expect(currencyEventCount).to.eq(1);
        matchEvent(
          receipt,
          'Transfer',
          [userTwoAddress, userAddress, DEFAULT_FOLLOW_PRICE],
          currency,
          currency.address
        );
      });

      it('UserTwo should fail to follow passing a different expected price in data', async function () {
        const data = abiCoder.encode(
          ['address', 'uint256'],
          [currency.address, DEFAULT_FOLLOW_PRICE.div(2)]
        );
        await expect(
          lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])
        ).to.be.revertedWith(ERRORS.MODULE_DATA_MISMATCH);
      });

      it('UserTwo should fail to follow passing a different expected currency in data', async function () {
        const data = abiCoder.encode(['address', 'uint256'], [userAddress, DEFAULT_FOLLOW_PRICE]);
        await expect(
          lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])
        ).to.be.revertedWith(ERRORS.MODULE_DATA_MISMATCH);
      });

      it('UserTwo should fail to follow without first approving module with currency', async function () {
        await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;

        const data = abiCoder.encode(
          ['address', 'uint256'],
          [currency.address, DEFAULT_FOLLOW_PRICE]
        );
        await expect(
          lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])
        ).to.be.revertedWith(ERRORS.ERC20_INSUFFICIENT_ALLOWANCE);
      });
    });
  });

  context('Scenarios', function () {
    it('User should create a profile with the fee follow module as the follow module and data, correct events should be emitted', async function () {
      const followModuleInitData = abiCoder.encode(
        ['uint256', 'address', 'address'],
        [DEFAULT_FOLLOW_PRICE, currency.address, userAddress]
      );
      const tx = lensHub.createProfile({
        to: userAddress,
        handle: MOCK_PROFILE_HANDLE,
        imageURI: MOCK_PROFILE_URI,
        followModule: feeFollowModule.address,
        followModuleInitData: followModuleInitData,
        followNFTURI: MOCK_FOLLOW_NFT_URI,
      });

      const receipt = await waitForTx(tx);

      expect(receipt.logs.length).to.eq(2);
      matchEvent(receipt, 'Transfer', [ZERO_ADDRESS, userAddress, FIRST_PROFILE_ID], lensHubImpl);
      matchEvent(receipt, 'ProfileCreated', [
        FIRST_PROFILE_ID,
        userAddress,
        userAddress,
        MOCK_PROFILE_HANDLE,
        MOCK_PROFILE_URI,
        feeFollowModule.address,
        followModuleInitData,
        MOCK_FOLLOW_NFT_URI,
        await getTimestamp(),
      ]);
    });

    it('User should create a profile then set the fee follow module as the follow module with data, correct events should be emitted', async function () {
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

      const followModuleInitData = abiCoder.encode(
        ['uint256', 'address', 'address'],
        [DEFAULT_FOLLOW_PRICE, currency.address, userAddress]
      );
      const tx = lensHub.setFollowModule(
        FIRST_PROFILE_ID,
        feeFollowModule.address,
        followModuleInitData
      );

      const receipt = await waitForTx(tx);

      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'FollowModuleSet', [
        FIRST_PROFILE_ID,
        feeFollowModule.address,
        followModuleInitData,
        await getTimestamp(),
      ]);
    });

    it('User should create a profile with the fee follow module as the follow module and data, fetched profile data should be accurate', async function () {
      const followModuleInitData = abiCoder.encode(
        ['uint256', 'address', 'address'],
        [DEFAULT_FOLLOW_PRICE, currency.address, userAddress]
      );
      await expect(
        lensHub.createProfile({
          to: userAddress,
          handle: MOCK_PROFILE_HANDLE,
          imageURI: MOCK_PROFILE_URI,
          followModule: feeFollowModule.address,
          followModuleInitData: followModuleInitData,
          followNFTURI: MOCK_FOLLOW_NFT_URI,
        })
      ).to.not.be.reverted;

      const fetchedData = await feeFollowModule.getProfileData(FIRST_PROFILE_ID);
      expect(fetchedData.amount).to.eq(DEFAULT_FOLLOW_PRICE);
      expect(fetchedData.recipient).to.eq(userAddress);
      expect(fetchedData.currency).to.eq(currency.address);
    });

    it('User should create a profile with the fee follow module as the follow module and data, user two follows, fee distribution is valid', async function () {
      const followModuleInitData = abiCoder.encode(
        ['uint256', 'address', 'address'],
        [DEFAULT_FOLLOW_PRICE, currency.address, userAddress]
      );
      await expect(
        lensHub.createProfile({
          to: userAddress,
          handle: MOCK_PROFILE_HANDLE,
          imageURI: MOCK_PROFILE_URI,
          followModule: feeFollowModule.address,
          followModuleInitData: followModuleInitData,
          followNFTURI: MOCK_FOLLOW_NFT_URI,
        })
      ).to.not.be.reverted;

      await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
      await expect(
        currency.connect(userTwo).approve(feeFollowModule.address, MAX_UINT256)
      ).to.not.be.reverted;
      const data = abiCoder.encode(
        ['address', 'uint256'],
        [currency.address, DEFAULT_FOLLOW_PRICE]
      );
      await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])).to.not.be.reverted;

      const expectedTreasuryAmount = BigNumber.from(DEFAULT_FOLLOW_PRICE)
        .mul(TREASURY_FEE_BPS)
        .div(BPS_MAX);
      const expectedRecipientAmount =
        BigNumber.from(DEFAULT_FOLLOW_PRICE).sub(expectedTreasuryAmount);

      expect(await currency.balanceOf(userTwoAddress)).to.eq(
        BigNumber.from(MAX_UINT256).sub(DEFAULT_FOLLOW_PRICE)
      );
      expect(await currency.balanceOf(userAddress)).to.eq(expectedRecipientAmount);
      expect(await currency.balanceOf(treasuryAddress)).to.eq(expectedTreasuryAmount);
    });

    it('User should create a profile with the fee follow module as the follow module and data, user two follows twice, fee distribution is valid', async function () {
      const followModuleInitData = abiCoder.encode(
        ['uint256', 'address', 'address'],
        [DEFAULT_FOLLOW_PRICE, currency.address, userAddress]
      );
      await expect(
        lensHub.createProfile({
          to: userAddress,
          handle: MOCK_PROFILE_HANDLE,
          imageURI: MOCK_PROFILE_URI,
          followModule: feeFollowModule.address,
          followModuleInitData: followModuleInitData,
          followNFTURI: MOCK_FOLLOW_NFT_URI,
        })
      ).to.not.be.reverted;

      await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
      await expect(
        currency.connect(userTwo).approve(feeFollowModule.address, MAX_UINT256)
      ).to.not.be.reverted;
      const data = abiCoder.encode(
        ['address', 'uint256'],
        [currency.address, DEFAULT_FOLLOW_PRICE]
      );
      await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])).to.not.be.reverted;
      await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])).to.not.be.reverted;

      const expectedTreasuryAmount = BigNumber.from(DEFAULT_FOLLOW_PRICE)
        .mul(TREASURY_FEE_BPS)
        .div(BPS_MAX);
      const expectedRecipientAmount =
        BigNumber.from(DEFAULT_FOLLOW_PRICE).sub(expectedTreasuryAmount);

      expect(await currency.balanceOf(userTwoAddress)).to.eq(
        BigNumber.from(MAX_UINT256).sub(BigNumber.from(DEFAULT_FOLLOW_PRICE).mul(2))
      );
      expect(await currency.balanceOf(userAddress)).to.eq(expectedRecipientAmount.mul(2));
      expect(await currency.balanceOf(treasuryAddress)).to.eq(expectedTreasuryAmount.mul(2));
    });
  });
});
