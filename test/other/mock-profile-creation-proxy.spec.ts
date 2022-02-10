import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ZERO_ADDRESS } from '../helpers/constants';
import { ERRORS } from '../helpers/errors';
import { MockProfileCreationProxy, MockProfileCreationProxy__factory } from '../../typechain-types';
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
import { BigNumber } from 'ethers';
import { TokenDataStructOutput } from '../../typechain-types/LensHub';
import { getTimestamp } from '../helpers/utils';

makeSuiteCleanRoom('Mock Profile Creation Proxy', function () {
  let mockProfileCreationProxy: MockProfileCreationProxy;
  beforeEach(async function () {
    mockProfileCreationProxy = await new MockProfileCreationProxy__factory(deployer).deploy(
      lensHub.address
    );
    await expect(
      lensHub.connect(governance).allowlistProfileCreator(mockProfileCreationProxy.address, true)
    ).to.not.be.reverted;
  });

  it('User should be able to create a profile using the allowlisted proxy, received NFT should be valid', async function () {
    let timestamp: any;
    let owner: string;
    let totalSupply: BigNumber;
    let profileId: BigNumber;
    let mintTimestamp: BigNumber;
    let tokenData: TokenDataStructOutput;

    await expect(
      mockProfileCreationProxy.connect(user).proxyCreateProfile({
        to: userAddress,
        handle: MOCK_PROFILE_HANDLE,
        imageURI: MOCK_PROFILE_URI,
        followModule: ZERO_ADDRESS,
        followModuleData: [],
        followNFTURI: MOCK_FOLLOW_NFT_URI,
      })
    ).to.not.be.reverted;

    timestamp = await getTimestamp();
    owner = await lensHub.ownerOf(FIRST_PROFILE_ID);
    totalSupply = await lensHub.totalSupply();
    profileId = await lensHub.getProfileIdByHandle(MOCK_PROFILE_HANDLE);
    mintTimestamp = await lensHub.mintTimestampOf(FIRST_PROFILE_ID);
    tokenData = await lensHub.tokenDataOf(FIRST_PROFILE_ID);
    expect(owner).to.eq(userAddress);
    expect(totalSupply).to.eq(FIRST_PROFILE_ID);
    expect(profileId).to.eq(FIRST_PROFILE_ID);
    expect(mintTimestamp).to.eq(timestamp);
    expect(tokenData.owner).to.eq(userAddress);
    expect(tokenData.mintTimestamp).to.eq(timestamp);
  });
});
