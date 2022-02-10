import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ERRORS } from '../../helpers/errors';
import { governance, lensHub, makeSuiteCleanRoom, userAddress } from '../../__setup.spec';

makeSuiteCleanRoom('Governance Functions', function () {
  context('Negatives', function () {
    it('User should not be able to call governance functions', async function () {
      await expect(lensHub.setGovernance(userAddress)).to.be.revertedWith(ERRORS.NOT_GOVERNANCE);
      await expect(lensHub.allowlistFollowModule(userAddress, true)).to.be.revertedWith(
        ERRORS.NOT_GOVERNANCE
      );
      await expect(lensHub.allowlistReferenceModule(userAddress, true)).to.be.revertedWith(
        ERRORS.NOT_GOVERNANCE
      );
      await expect(lensHub.allowlistCollectModule(userAddress, true)).to.be.revertedWith(
        ERRORS.NOT_GOVERNANCE
      );
    });
  });

  context('Scenarios', function () {
    it('Governance should successfully allowlist and unallowlist modules', async function () {
      await expect(
        lensHub.connect(governance).allowlistFollowModule(userAddress, true)
      ).to.not.be.reverted;
      await expect(
        lensHub.connect(governance).allowlistReferenceModule(userAddress, true)
      ).to.not.be.reverted;
      await expect(
        lensHub.connect(governance).allowlistCollectModule(userAddress, true)
      ).to.not.be.reverted;
      expect(await lensHub.isFollowModuleAllowlisted(userAddress)).to.eq(true);
      expect(await lensHub.isReferenceModuleAllowlisted(userAddress)).to.eq(true);
      expect(await lensHub.isCollectModuleAllowlisted(userAddress)).to.eq(true);

      await expect(
        lensHub.connect(governance).allowlistFollowModule(userAddress, false)
      ).to.not.be.reverted;
      await expect(
        lensHub.connect(governance).allowlistReferenceModule(userAddress, false)
      ).to.not.be.reverted;
      await expect(
        lensHub.connect(governance).allowlistCollectModule(userAddress, false)
      ).to.not.be.reverted;
      expect(await lensHub.isFollowModuleAllowlisted(userAddress)).to.eq(false);
      expect(await lensHub.isReferenceModuleAllowlisted(userAddress)).to.eq(false);
      expect(await lensHub.isCollectModuleAllowlisted(userAddress)).to.eq(false);
    });

    it('Governance should successfully change the governance address', async function () {
      await expect(lensHub.connect(governance).setGovernance(userAddress)).to.not.be.reverted;
    });
  });
});
