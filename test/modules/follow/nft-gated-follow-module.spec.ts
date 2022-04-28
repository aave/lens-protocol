import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { NftCollection, NftCollection__factory } from '../../../typechain-types';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { getTimestamp, matchEvent, waitForTx } from '../../helpers/utils';
import {
  abiCoder,
  FIRST_PROFILE_ID,
  governance,
  lensHubImpl,
  lensHub,
  nftGatedFollowModule,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  accounts,
  userAddress,
  deployer,
} from '../../__setup.spec';

makeSuiteCleanRoom('NFT Gated Follow Module', function () {
  let nft: NftCollection;
  const WHITELIST_NFT_ID_SET = [1, 5, 6, 7];
  beforeEach(async function () {
    nft = await new NftCollection__factory(deployer).deploy();
    for (const tokenId of [1, 2, 3, 4, 5, 6, 7]) {
      const account = accounts[tokenId];
      await nft.mint(await account.getAddress(), tokenId);
    }

    await expect(
      lensHub.connect(governance).whitelistFollowModule(nftGatedFollowModule.address, true)
    ).to.not.be.reverted;
  });

  context('Negatives', function () {
    context('Initialization', function () {
      it('User should fail to create a profile with NFT Gated Follow Module using zero address as the nft address', async function () {
        const followModuleData = abiCoder.encode(
          ['address', 'uint256[]'],
          [ZERO_ADDRESS, WHITELIST_NFT_ID_SET]
        );
        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: nftGatedFollowModule.address,
            followModuleData: followModuleData,
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
      });
      it('User should fail to create a profile with NFT Gated Follow Module using empty whitelistNftIdSet', async function () {
        const followModuleData = abiCoder.encode(['address', 'uint256[]'], [nft.address, []]);
        await expect(
          lensHub.createProfile({
            to: userAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: nftGatedFollowModule.address,
            followModuleData: followModuleData,
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
      });
      it('repeated ids in whitelistNftIdSet should be ignored', async function () {
        const followModuleData = abiCoder.encode(
          ['address', 'uint256[]'],
          [nft.address, [...WHITELIST_NFT_ID_SET, ...WHITELIST_NFT_ID_SET, ...WHITELIST_NFT_ID_SET]]
        );
        await lensHub.createProfile({
          to: userAddress,
          handle: MOCK_PROFILE_HANDLE,
          imageURI: MOCK_PROFILE_URI,
          followModule: nftGatedFollowModule.address,
          followModuleData: followModuleData,
          followNFTURI: MOCK_FOLLOW_NFT_URI,
        });

        const fetchedData = await nftGatedFollowModule.getProfileData(FIRST_PROFILE_ID);
        expect(fetchedData.nftToken).to.eq(nft.address);
        expectBigNumberListEqualTo(fetchedData.whitelistNftIdSet, WHITELIST_NFT_ID_SET);
      });
    });
    context('Following', function () {
      beforeEach(async function () {
        const followModuleData = abiCoder.encode(
          ['address', 'uint256[]'],
          [nft.address, WHITELIST_NFT_ID_SET]
        );
        await lensHub.createProfile({
          to: userAddress,
          handle: MOCK_PROFILE_HANDLE,
          imageURI: MOCK_PROFILE_URI,
          followModule: nftGatedFollowModule.address,
          followModuleData: followModuleData,
          followNFTURI: MOCK_FOLLOW_NFT_URI,
        });
      });

      it('User 3 should fail to follow without whitelist NFT token', async function () {
        const followModuleData = abiCoder.encode(
          ['address', 'uint256[]'],
          [nft.address, WHITELIST_NFT_ID_SET]
        );
        await expect(
          lensHub.connect(accounts[3]).follow([FIRST_PROFILE_ID], [followModuleData])
        ).to.be.revertedWith(ERRORS.NOT_HAVE_WHITELIST_NFT_TOKEN);
      });

      it('User 7 should can follow with whitelist NFT token', async function () {
        const followModuleData = abiCoder.encode(
          ['address', 'uint256[]'],
          [nft.address, WHITELIST_NFT_ID_SET]
        );
        await expect(
          lensHub.connect(accounts[7]).follow([FIRST_PROFILE_ID], [followModuleData])
        ).to.not.be.reverted;
      });

      it('after burned User 7 should fail to follow without whitelist NFT token', async function () {
        const followModuleData = abiCoder.encode(
          ['address', 'uint256[]'],
          [nft.address, WHITELIST_NFT_ID_SET]
        );
        await nft.burn(7);
        await expect(
          lensHub.connect(accounts[3]).follow([FIRST_PROFILE_ID], [followModuleData])
        ).to.be.revertedWith(ERRORS.NOT_HAVE_WHITELIST_NFT_TOKEN);
      });

      it('skip burned nft token id and check others whitelist NFT token id', async function () {
        const followModuleData = abiCoder.encode(
          ['address', 'uint256[]'],
          [nft.address, WHITELIST_NFT_ID_SET]
        );
        for (const tokenId of [1, 2, 3, 4, 5]) {
          await nft.burn(tokenId);
        }
        for (const tokenId of [6, 7]) {
          await expect(
            lensHub.connect(accounts[tokenId]).follow([FIRST_PROFILE_ID], [followModuleData])
          ).to.not.be.reverted;
        }
      });
    });
  });

  context('Scenarios', function () {
    it('User should create a profile with the NFT Gated Follow Module as the follow module and data, correct events should be emitted', async function () {
      const followModuleData = abiCoder.encode(
        ['address', 'uint256[]'],
        [nft.address, WHITELIST_NFT_ID_SET]
      );
      const tx = lensHub.createProfile({
        to: userAddress,
        handle: MOCK_PROFILE_HANDLE,
        imageURI: MOCK_PROFILE_URI,
        followModule: nftGatedFollowModule.address,
        followModuleData: followModuleData,
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
        nftGatedFollowModule.address,
        followModuleData,
        MOCK_FOLLOW_NFT_URI,
        await getTimestamp(),
      ]);
    });

    it('User should create a profile then set the NFT Gated Follow Module as the follow module with data, correct events should be emitted', async function () {
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

      const followModuleData = abiCoder.encode(
        ['address', 'uint256[]'],
        [nft.address, WHITELIST_NFT_ID_SET]
      );
      const tx = lensHub.setFollowModule(
        FIRST_PROFILE_ID,
        nftGatedFollowModule.address,
        followModuleData
      );

      const receipt = await waitForTx(tx);

      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'FollowModuleSet', [
        FIRST_PROFILE_ID,
        nftGatedFollowModule.address,
        followModuleData,
        await getTimestamp(),
      ]);
    });

    it('User should create a profile with the NFT Gated Follow Module as the follow module and data, fetched profile data should be accurate', async function () {
      const followModuleData = abiCoder.encode(
        ['address', 'uint256[]'],
        [nft.address, WHITELIST_NFT_ID_SET]
      );
      await expect(
        lensHub.createProfile({
          to: userAddress,
          handle: MOCK_PROFILE_HANDLE,
          imageURI: MOCK_PROFILE_URI,
          followModule: nftGatedFollowModule.address,
          followModuleData: followModuleData,
          followNFTURI: MOCK_FOLLOW_NFT_URI,
        })
      ).to.not.be.reverted;

      const fetchedData = await nftGatedFollowModule.getProfileData(FIRST_PROFILE_ID);
      expectBigNumberListEqualTo(fetchedData.whitelistNftIdSet, WHITELIST_NFT_ID_SET);
      expect(fetchedData.nftToken).to.eq(nft.address);
    });

    it('User should create a profile with the NFT Gated Follow Module as the follow module and data, user 5 with whitelist NFT token id should not revert', async function () {
      const followModuleData = abiCoder.encode(
        ['address', 'uint256[]'],
        [nft.address, WHITELIST_NFT_ID_SET]
      );
      await expect(
        lensHub.createProfile({
          to: userAddress,
          handle: MOCK_PROFILE_HANDLE,
          imageURI: MOCK_PROFILE_URI,
          followModule: nftGatedFollowModule.address,
          followModuleData: followModuleData,
          followNFTURI: MOCK_FOLLOW_NFT_URI,
        })
      ).to.not.be.reverted;

      await expect(
        lensHub.connect(accounts[5]).follow([FIRST_PROFILE_ID], [followModuleData])
      ).to.not.be.reverted;
    });
    it('User should create a profile with the NFT Gated Follow Module as the follow module and data, user 4 without whitelist NFT token id, should revert', async function () {
      const followModuleData = abiCoder.encode(
        ['address', 'uint256[]'],
        [nft.address, WHITELIST_NFT_ID_SET]
      );
      await expect(
        lensHub.createProfile({
          to: userAddress,
          handle: MOCK_PROFILE_HANDLE,
          imageURI: MOCK_PROFILE_URI,
          followModule: nftGatedFollowModule.address,
          followModuleData: followModuleData,
          followNFTURI: MOCK_FOLLOW_NFT_URI,
        })
      ).to.not.be.reverted;

      await expect(
        lensHub.connect(accounts[4]).follow([FIRST_PROFILE_ID], [followModuleData])
      ).to.be.reverted;
    });
  });
});

function expectBigNumberListEqualTo(bigNumberListVal: BigNumber[], expected: number[]) {
  expect(bigNumberListVal.length).to.eq(expected.length);
  bigNumberListVal.forEach((item, index) => expect(item).to.eq(expected[index]));
}
