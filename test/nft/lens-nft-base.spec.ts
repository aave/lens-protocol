import '@nomiclabs/hardhat-ethers';
import hre from 'hardhat';
import { expect } from 'chai';
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils';
import { MAX_UINT256, ZERO_ADDRESS } from '../helpers/constants';
import { ERRORS } from '../helpers/errors';
import {
  cancelWithPermitForAll,
  getBurnWithSigparts,
  getChainId,
  getPermitForAllParts,
  getPermitParts,
} from '../helpers/utils';
import {
  abiCoder,
  FIRST_PROFILE_ID,
  lensHub,
  LENS_HUB_NFT_NAME,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  testWallet,
  user,
  userAddress,
} from '../__setup.spec';
import { hardhatArguments } from 'hardhat';

makeSuiteCleanRoom('Lens NFT Base Functionality', function () {
  context('generic', function () {
    it('Domain separator fetched from contract should be accurate', async function () {
      const expectedDomainSeparator = keccak256(
        abiCoder.encode(
          ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
          [
            keccak256(
              toUtf8Bytes(
                'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
              )
            ),
            keccak256(toUtf8Bytes(LENS_HUB_NFT_NAME)),
            keccak256(toUtf8Bytes('1')),
            getChainId(),
            lensHub.address,
          ]
        )
      );

      expect(await lensHub.getDomainSeparator()).to.eq(expectedDomainSeparator);
    });
  });

  context('meta-tx', function () {
    beforeEach(async function () {
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
    });

    context('Negatives', function () {
      it('TestWallet should fail to permit with zero spender', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getPermitParts(
          lensHub.address,
          await lensHub.name(),
          ZERO_ADDRESS,
          FIRST_PROFILE_ID,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.permit(ZERO_ADDRESS, FIRST_PROFILE_ID, {
            v,
            r,
            s,
            deadline: MAX_UINT256,
          })
        ).to.be.revertedWith(ERRORS.ZERO_SPENDER);
      });

      it('TestWallet should fail to permit with invalid token ID', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getPermitParts(
          lensHub.address,
          await lensHub.name(),
          userAddress,
          0,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.permit(userAddress, 0, {
            v,
            r,
            s,
            deadline: MAX_UINT256,
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('TestWallet should fail to permit with signature deadline mismatch', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getPermitParts(
          lensHub.address,
          await lensHub.name(),
          userAddress,
          FIRST_PROFILE_ID,
          nonce,
          '0'
        );

        await expect(
          lensHub.permit(userAddress, FIRST_PROFILE_ID, {
            v,
            r,
            s,
            deadline: MAX_UINT256,
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('TestWallet should fail to permit with invalid deadline', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getPermitParts(
          lensHub.address,
          await lensHub.name(),
          userAddress,
          FIRST_PROFILE_ID,
          nonce,
          '0'
        );

        await expect(
          lensHub.permit(userAddress, FIRST_PROFILE_ID, {
            v,
            r,
            s,
            deadline: '0',
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_EXPIRED);
      });

      it('TestWallet should fail to permit with invalid nonce', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getPermitParts(
          lensHub.address,
          LENS_HUB_NFT_NAME,
          userAddress,
          FIRST_PROFILE_ID,
          nonce + 1,
          MAX_UINT256
        );

        await expect(
          lensHub.permit(userAddress, FIRST_PROFILE_ID, {
            v,
            r,
            s,
            deadline: MAX_UINT256,
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('TestWallet should sign attempt to permit, cancel with empty permitForAll, then fail to permit', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getPermitParts(
          lensHub.address,
          LENS_HUB_NFT_NAME,
          userAddress,
          FIRST_PROFILE_ID,
          nonce,
          MAX_UINT256
        );

        await cancelWithPermitForAll();

        await expect(
          lensHub.permit(userAddress, FIRST_PROFILE_ID, {
            v,
            r,
            s,
            deadline: MAX_UINT256,
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('TestWallet should fail to permitForAll with zero spender', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getPermitForAllParts(
          lensHub.address,
          LENS_HUB_NFT_NAME,
          testWallet.address,
          ZERO_ADDRESS,
          true,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.permitForAll(testWallet.address, ZERO_ADDRESS, true, {
            v,
            r,
            s,
            deadline: MAX_UINT256,
          })
        ).to.be.revertedWith(ERRORS.ZERO_SPENDER);
      });

      it('TestWallet should fail to permitForAll with signature deadline mismatch', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getPermitForAllParts(
          lensHub.address,
          LENS_HUB_NFT_NAME,
          testWallet.address,
          userAddress,
          true,
          nonce,
          '0'
        );

        await expect(
          lensHub.permitForAll(testWallet.address, userAddress, true, {
            v,
            r,
            s,
            deadline: MAX_UINT256,
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('TestWallet should fail to permitForAll with invalid deadline', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getPermitForAllParts(
          lensHub.address,
          LENS_HUB_NFT_NAME,
          testWallet.address,
          userAddress,
          true,
          nonce,
          '0'
        );

        await expect(
          lensHub.permitForAll(testWallet.address, userAddress, true, {
            v,
            r,
            s,
            deadline: '0',
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_EXPIRED);
      });

      it('TestWallet should fail to permitForAll with invalid nonce', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getPermitForAllParts(
          lensHub.address,
          LENS_HUB_NFT_NAME,
          testWallet.address,
          userAddress,
          true,
          nonce + 1,
          MAX_UINT256
        );

        await expect(
          lensHub.permitForAll(testWallet.address, userAddress, true, {
            v,
            r,
            s,
            deadline: MAX_UINT256,
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('TestWallet should sign attempt to permitForAll, cancel with empty permitForAll, then fail to permitForAll', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getPermitForAllParts(
          lensHub.address,
          LENS_HUB_NFT_NAME,
          testWallet.address,
          userAddress,
          true,
          nonce,
          MAX_UINT256
        );

        await cancelWithPermitForAll();

        await expect(
          lensHub.permitForAll(testWallet.address, userAddress, true, {
            v,
            r,
            s,
            deadline: MAX_UINT256,
          })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('TestWallet should fail to burnWithSig with invalid token ID', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getBurnWithSigparts(
          lensHub.address,
          LENS_HUB_NFT_NAME,
          0,
          nonce,
          MAX_UINT256
        );

        await expect(lensHub.burnWithSig(0, { v, r, s, deadline: MAX_UINT256 })).to.be.revertedWith(
          ERRORS.SIGNATURE_INVALID
        );
      });

      it('TestWallet should fail to burnWithSig with signature deadline mismatch', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getBurnWithSigparts(
          lensHub.address,
          LENS_HUB_NFT_NAME,
          FIRST_PROFILE_ID,
          nonce,
          '0'
        );

        await expect(
          lensHub.burnWithSig(FIRST_PROFILE_ID, { v, r, s, deadline: MAX_UINT256 })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('TestWallet should fail to burnWithSig with invalid deadline', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getBurnWithSigparts(
          lensHub.address,
          LENS_HUB_NFT_NAME,
          FIRST_PROFILE_ID,
          nonce,
          '0'
        );

        await expect(
          lensHub.burnWithSig(FIRST_PROFILE_ID, { v, r, s, deadline: '0' })
        ).to.be.revertedWith(ERRORS.SIGNATURE_EXPIRED);
      });

      it('TestWallet should fail to burnWithSig with invalid nonce', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getBurnWithSigparts(
          lensHub.address,
          LENS_HUB_NFT_NAME,
          FIRST_PROFILE_ID,
          nonce + 1,
          MAX_UINT256
        );

        await expect(
          lensHub.burnWithSig(FIRST_PROFILE_ID, { v, r, s, deadline: MAX_UINT256 })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });

      it('TestWallet should sign attempt to burnWithSig, cancel with empty permitForAll, then fail to burnWithSig', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getBurnWithSigparts(
          lensHub.address,
          LENS_HUB_NFT_NAME,
          FIRST_PROFILE_ID,
          nonce,
          MAX_UINT256
        );

        await cancelWithPermitForAll();

        await expect(
          lensHub.burnWithSig(FIRST_PROFILE_ID, { v, r, s, deadline: MAX_UINT256 })
        ).to.be.revertedWith(ERRORS.SIGNATURE_INVALID);
      });
    });

    context('Scenarios', function () {
      it('TestWallet should permit user, user should transfer NFT, send back NFT and fail to transfer it again', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getPermitParts(
          lensHub.address,
          LENS_HUB_NFT_NAME,
          userAddress,
          FIRST_PROFILE_ID,
          nonce,
          MAX_UINT256
        );
        await expect(
          lensHub.permit(
            userAddress,
            FIRST_PROFILE_ID,
            {
              v,
              r,
              s,
              deadline: MAX_UINT256,
            },
            { gasLimit: 12450000 }
          )
        ).to.not.be.reverted;

        await expect(
          lensHub.transferFrom(testWallet.address, userAddress, FIRST_PROFILE_ID)
        ).to.not.be.reverted;
        await expect(
          lensHub.transferFrom(userAddress, testWallet.address, FIRST_PROFILE_ID)
        ).to.not.be.reverted;
        await expect(
          lensHub.transferFrom(testWallet.address, userAddress, FIRST_PROFILE_ID)
        ).to.be.revertedWith(ERRORS.ERC721_TRANSFER_NOT_OWNER_OR_APPROVED);
      });

      it('TestWallet should permitForAll user, user should transfer NFT, send back NFT and transfer it again', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getPermitForAllParts(
          lensHub.address,
          LENS_HUB_NFT_NAME,
          testWallet.address,
          userAddress,
          true,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.permitForAll(testWallet.address, userAddress, true, {
            v,
            r,
            s,
            deadline: MAX_UINT256,
          })
        ).to.not.be.reverted;

        await expect(
          lensHub.transferFrom(testWallet.address, userAddress, FIRST_PROFILE_ID)
        ).to.not.be.reverted;

        await expect(
          lensHub.transferFrom(userAddress, testWallet.address, FIRST_PROFILE_ID)
        ).to.not.be.reverted;

        await expect(
          lensHub.transferFrom(testWallet.address, userAddress, FIRST_PROFILE_ID)
        ).to.not.be.reverted;
      });

      it('TestWallet should sign burnWithSig, user should submit and burn NFT', async function () {
        const nonce = (await lensHub.sigNonces(testWallet.address)).toNumber();

        const { v, r, s } = await getBurnWithSigparts(
          lensHub.address,
          LENS_HUB_NFT_NAME,
          FIRST_PROFILE_ID,
          nonce,
          MAX_UINT256
        );

        await expect(
          lensHub.connect(user).burnWithSig(FIRST_PROFILE_ID, { v, r, s, deadline: MAX_UINT256 })
        ).to.not.be.reverted;
      });
    });
  });
});
