import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { FollowNFT__factory } from '../../../typechain-types';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import {
  cancelWithPermitForAll,
  expectEqualArrays,
  followReturningTokenIds,
  getAbbreviation,
  getFollowWithSigParts,
  getTimestamp,
} from '../../helpers/utils';
import {
  lensHub,
  FIRST_PROFILE_ID,
  makeSuiteCleanRoom,
  MOCK_PROFILE_HANDLE,
  testWallet,
  user,
  userTwo,
  userTwoAddress,
  MOCK_PROFILE_URI,
  userAddress,
  MOCK_FOLLOW_NFT_URI,
} from '../../__setup.spec';

makeSuiteCleanRoom('Following', function () {
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
  });
  context('Generic', function () {
    context('Negatives', function () {
      it('UserTwo should fail to follow a nonexistent profile', async function () {
        await expect(
          lensHub.connect(userTwo).follow([FIRST_PROFILE_ID + 1], [[]])
        ).to.be.revertedWith(ERRORS.TOKEN_DOES_NOT_EXIST);
      });

      it('UserTwo should fail to follow with array mismatch', async function () {
        await expect(
          lensHub.connect(userTwo).follow([FIRST_PROFILE_ID, FIRST_PROFILE_ID], [[]])
        ).to.be.revertedWith(ERRORS.ARRAY_MISMATCH);
      });

      it('UserTwo should fail to follow a profile that has been burned', async function () {
        await expect(lensHub.burn(FIRST_PROFILE_ID)).to.not.be.reverted;
        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.be.revertedWith(
          ERRORS.TOKEN_DOES_NOT_EXIST
        );
      });

      it('UserTwo should fail to follow profile with id 0', async function () {
        await expect(lensHub.connect(userTwo).follow([0], [[]])).to.be.revertedWith(
          ERRORS.TOKEN_DOES_NOT_EXIST
        );
      });
    });

    context('Scenarios', function () {
      it('UserTwo should follow profile 1, receive a followNFT with ID 1, followNFT properties should be correct', async function () {
        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const timestamp = await getTimestamp();

        const followNFTAddress = await lensHub.getFollowNFT(FIRST_PROFILE_ID);
        const followNFT = FollowNFT__factory.connect(followNFTAddress, user);
        expect(followNFT.address).to.not.eq(ZERO_ADDRESS);
        const id = await followNFT.tokenOfOwnerByIndex(userTwoAddress, 0);
        const name = await followNFT.name();
        const symbol = await followNFT.symbol();
        const owner = await followNFT.ownerOf(id);
        const mintTimestamp = await followNFT.mintTimestampOf(id);
        const followNFTURI = await followNFT.tokenURI(id);
        const tokenData = await followNFT.tokenDataOf(id);

        expect(id).to.eq(1);
        expect(name).to.eq(MOCK_PROFILE_HANDLE + '-Follower');
        expect(symbol).to.eq(getAbbreviation(MOCK_PROFILE_HANDLE) + '-Fl');
        expect(owner).to.eq(userTwoAddress);
        expect(tokenData.owner).to.eq(userTwoAddress);
        expect(tokenData.mintTimestamp).to.eq(timestamp);
        expect(followNFTURI).to.eq(MOCK_FOLLOW_NFT_URI);
        expect(mintTimestamp).to.eq(timestamp);
      });

      it('UserTwo should follow profile 1 twice, receiving followNFTs with IDs 1 and 2', async function () {
        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const followNFTAddress = await lensHub.getFollowNFT(FIRST_PROFILE_ID);
        const followNFT = FollowNFT__factory.connect(followNFTAddress, user);
        const idOne = await followNFT.tokenOfOwnerByIndex(userTwoAddress, 0);
        const idTwo = await followNFT.tokenOfOwnerByIndex(userTwoAddress, 1);
        expect(idOne).to.eq(1);
        expect(idTwo).to.eq(2);
      });

      it('UserTwo should follow profile 1 3 times in the same call, receive IDs 1,2 and 3', async function () {
        await expect(
          lensHub
            .connect(userTwo)
            .follow([FIRST_PROFILE_ID, FIRST_PROFILE_ID, FIRST_PROFILE_ID], [[], [], []])
        ).to.not.be.reverted;
        const followNFTAddress = await lensHub.getFollowNFT(FIRST_PROFILE_ID);
        const followNFT = FollowNFT__factory.connect(followNFTAddress, user);
        const idOne = await followNFT.tokenOfOwnerByIndex(userTwoAddress, 0);
        const idTwo = await followNFT.tokenOfOwnerByIndex(userTwoAddress, 1);
        const idThree = await followNFT.tokenOfOwnerByIndex(userTwoAddress, 2);
        expect(idOne).to.eq(1);
        expect(idTwo).to.eq(2);
        expect(idThree).to.eq(3);
      });

      it('Should return the expected token IDs when following profiles', async function () {
        expectEqualArrays(
          await followReturningTokenIds({
            vars: {
              profileIds: [FIRST_PROFILE_ID, FIRST_PROFILE_ID],
              datas: [[], []],
            },
          }),
          [1, 2]
        );

        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();
        const { v, r, s } = await getFollowWithSigParts(
          [FIRST_PROFILE_ID],
          [[]],
          nonce,
          MAX_UINT256
        );
        expectEqualArrays(
          await followReturningTokenIds({
            vars: {
              follower: testWallet.address,
              profileIds: [FIRST_PROFILE_ID],
              datas: [[]],
              sig: {
                v,
                r,
                s,
                deadline: MAX_UINT256,
              },
            },
          }),
          [3]
        );

        expectEqualArrays(
          await followReturningTokenIds({
            sender: userTwo,
            vars: {
              profileIds: [FIRST_PROFILE_ID],
              datas: [[]],
            },
          }),
          [4]
        );

        expectEqualArrays(
          await followReturningTokenIds({
            vars: {
              profileIds: [FIRST_PROFILE_ID],
              datas: [[]],
            },
          }),
          [5]
        );
      });
    });
  });

  context('Meta-tx', function () {
    context('Negatives', function () {
      it('TestWallet should fail to follow with sig with signature deadline mismatch', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getFollowWithSigParts([FIRST_PROFILE_ID], [[]], nonce, '0');
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
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('TestWallet should fail to follow with sig with invalid deadline', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getFollowWithSigParts([FIRST_PROFILE_ID], [[]], nonce, '0');
        await expect(
          lensHub.followWithSig({
            follower: testWallet.address,
            profileIds: [FIRST_PROFILE_ID],
            datas: [[]],
            sig: {
              v,
              r,
              s,
              deadline: '0',
            },
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_EXPIRED);
      });

      it('TestWallet should fail to follow with sig with invalid nonce', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getFollowWithSigParts(
          [FIRST_PROFILE_ID],
          [[]],
          nonce + 1,
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
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('TestWallet should fail to follow a nonexistent profile with sig', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getFollowWithSigParts(
          [FIRST_PROFILE_ID + 1],
          [[]],
          nonce,
          MAX_UINT256
        );
        await expect(
          lensHub.followWithSig({
            follower: testWallet.address,
            profileIds: [FIRST_PROFILE_ID + 1],
            datas: [[]],
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.be.revertedWith(ERRORS.TOKEN_DOES_NOT_EXIST);
      });

      it('TestWallet should sign attempt to follow with sig, cancel with empty permitForAll, then fail to follow with sig', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getFollowWithSigParts(
          [FIRST_PROFILE_ID],
          [[]],
          nonce,
          MAX_UINT256
        );

        await cancelWithPermitForAll();

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
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });
    });

    context('Scenarios', function () {
      it('TestWallet should follow profile 1 with sig, receive a follow NFT with ID 1, follow NFT name and symbol should be correct', async function () {
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

        const followNFTAddress = await lensHub.getFollowNFT(FIRST_PROFILE_ID);
        const followNFT = FollowNFT__factory.connect(followNFTAddress, user);
        const id = await followNFT.tokenOfOwnerByIndex(testWallet.address, 0);
        expect(id).to.eq(1);
        const name = await followNFT.name();
        const symbol = await followNFT.symbol();
        expect(name).to.eq(MOCK_PROFILE_HANDLE + '-Follower');
        expect(symbol).to.eq(getAbbreviation(MOCK_PROFILE_HANDLE) + '-Fl');
      });

      it('TestWallet should follow profile 1 with sig twice in the same call, receive follow NFTs with IDs 1 and 2', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getFollowWithSigParts(
          [FIRST_PROFILE_ID, FIRST_PROFILE_ID],
          [[], []],
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.followWithSig({
            follower: testWallet.address,
            profileIds: [FIRST_PROFILE_ID, FIRST_PROFILE_ID],
            datas: [[], []],
            sig: {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
          })
        ).to.not.be.reverted;

        const followNFTAddress = await lensHub.getFollowNFT(FIRST_PROFILE_ID);
        const followNFT = FollowNFT__factory.connect(followNFTAddress, user);
        const idOne = await followNFT.tokenOfOwnerByIndex(testWallet.address, 0);
        const idTwo = await followNFT.tokenOfOwnerByIndex(testWallet.address, 1);
        expect(idOne).to.eq(1);
        expect(idTwo).to.eq(2);
        const name = await followNFT.name();
        const symbol = await followNFT.symbol();
        expect(name).to.eq(MOCK_PROFILE_HANDLE + '-Follower');
        expect(symbol).to.eq(getAbbreviation(MOCK_PROFILE_HANDLE) + '-Fl');
      });
    });
  });
});
