import '@nomiclabs/hardhat-ethers';
import { hexlify, keccak256, RLP } from 'ethers/lib/utils';
import fs from 'fs';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  LensHub__factory,
  ApprovalFollowModule__factory,
  CollectNFT__factory,
  FreeCollectModule__factory,
  FeeCollectModule__factory,
  FeeFollowModule__factory,
  FollowerOnlyReferenceModule__factory,
  FollowNFT__factory,
  InteractionLogic__factory,
  LimitedFeeCollectModule__factory,
  LimitedTimedFeeCollectModule__factory,
  ModuleGlobals__factory,
  PublishingLogic__factory,
  RevertCollectModule__factory,
  TimedFeeCollectModule__factory,
  TransparentUpgradeableProxy__factory,
  ProfileTokenURILogic__factory,
  LensPeriphery__factory,
  UIDataProvider__factory,
  ProfileFollowModule__factory,
  SuperfluidCFAFollowModule__factory,
} from '../typechain-types';
import { deployWithVerify, waitForTx } from './helpers/utils';

const TREASURY_FEE_BPS = 50;
const LENS_HUB_NFT_NAME = 'Lens Protocol Profiles';
const LENS_HUB_NFT_SYMBOL = 'LPP';

export let runtimeHRE: HardhatRuntimeEnvironment;

/**
 * @dev Note that this script uses the default ethers signers.
 * Care should be taken to also ensure that the following addresses end up properly set:
 *    1. LensHub Proxy Admin
 *    2. LensHub Governance
 *    3. ModuleGlobals Governance
 *    3. ModuleGlobals Treasury
 *
 * Furthermore, This script does not whitelist profile creators or deploy a profile creation
 * proxy or a unique currency contract. This also does not whitelist any currencies in the
 * ModuleGlobals contract.
 */
task('full-deploy-verify', 'deploys the entire Lens Protocol with explorer verification').setAction(
  async ({ }, hre) => {
    // Note that the use of these signers is a placeholder and is not meant to be used in
    // production.
    runtimeHRE = hre;
    const ethers = hre.ethers;
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    const governance = accounts[1];
    const treasuryAddress = accounts[2].address;

    // Nonce management in case of deployment issues
    let deployerNonce = await ethers.provider.getTransactionCount(deployer.address);

    console.log('\n\t -- Deploying Module Globals --');
    const moduleGlobals = await deployWithVerify(
      new ModuleGlobals__factory(deployer).deploy(
        governance.address,
        treasuryAddress,
        TREASURY_FEE_BPS,
        { nonce: deployerNonce++ }
      ),
      [governance.address, treasuryAddress, TREASURY_FEE_BPS],
      'contracts/core/modules/ModuleGlobals.sol:ModuleGlobals'
    );

    console.log('\n\t-- Deploying Logic Libs --');

    const publishingLogic = await deployWithVerify(
      new PublishingLogic__factory(deployer).deploy({ nonce: deployerNonce++ }),
      [],
      'contracts/libraries/PublishingLogic.sol:PublishingLogic'
    );
    const interactionLogic = await deployWithVerify(
      new InteractionLogic__factory(deployer).deploy({ nonce: deployerNonce++ }),
      [],
      'contracts/libraries/InteractionLogic.sol:InteractionLogic'
    );
    const profileTokenURILogic = await deployWithVerify(
      new ProfileTokenURILogic__factory(deployer).deploy({ nonce: deployerNonce++ }),
      [],
      'contracts/libraries/ProfileTokenURILogic.sol:ProfileTokenURILogic'
    );
    const hubLibs = {
      'contracts/libraries/PublishingLogic.sol:PublishingLogic': publishingLogic.address,
      'contracts/libraries/InteractionLogic.sol:InteractionLogic': interactionLogic.address,
      'contracts/libraries/ProfileTokenURILogic.sol:ProfileTokenURILogic':
        profileTokenURILogic.address,
    };

    // Here, we pre-compute the nonces and addresses used to deploy the contracts.
    // const nonce = await deployer.getTransactionCount();
    const followNFTNonce = hexlify(deployerNonce + 1);
    const collectNFTNonce = hexlify(deployerNonce + 2);
    const hubProxyNonce = hexlify(deployerNonce + 3);

    const followNFTImplAddress =
      '0x' + keccak256(RLP.encode([deployer.address, followNFTNonce])).substr(26);
    const collectNFTImplAddress =
      '0x' + keccak256(RLP.encode([deployer.address, collectNFTNonce])).substr(26);
    const hubProxyAddress =
      '0x' + keccak256(RLP.encode([deployer.address, hubProxyNonce])).substr(26);

    // Next, we deploy first the hub implementation, then the followNFT implementation, the collectNFT, and finally the
    // hub proxy with initialization.
    console.log('\n\t-- Deploying Hub Implementation --');

    const lensHubImpl = await deployWithVerify(
      new LensHub__factory(hubLibs, deployer).deploy(followNFTImplAddress, collectNFTImplAddress, {
        nonce: deployerNonce++,
      }),
      [followNFTImplAddress, collectNFTImplAddress],
      'contracts/core/LensHub.sol:LensHub'
    );

    console.log('\n\t-- Deploying Follow & Collect NFT Implementations --');
    await deployWithVerify(
      new FollowNFT__factory(deployer).deploy(hubProxyAddress, { nonce: deployerNonce++ }),
      [hubProxyAddress],
      'contracts/core/FollowNFT.sol:FollowNFT'
    );
    await deployWithVerify(
      new CollectNFT__factory(deployer).deploy(hubProxyAddress, { nonce: deployerNonce++ }),
      [hubProxyAddress],
      'contracts/core/CollectNFT.sol:CollectNFT'
    );

    let data = lensHubImpl.interface.encodeFunctionData('initialize', [
      LENS_HUB_NFT_NAME,
      LENS_HUB_NFT_SYMBOL,
      governance.address,
    ]);

    console.log('\n\t-- Deploying Hub Proxy --');
    let proxy = await deployWithVerify(
      new TransparentUpgradeableProxy__factory(deployer).deploy(
        lensHubImpl.address,
        deployer.address,
        data,
        { nonce: deployerNonce++ }
      ),
      [lensHubImpl.address, deployer.address, data],
      'contracts/upgradeability/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy'
    );

    // Connect the hub proxy to the LensHub factory and the governance for ease of use.
    const lensHub = LensHub__factory.connect(proxy.address, governance);

    console.log('\n\t-- Deploying Lens Periphery --');
    const lensPeriphery = await deployWithVerify(
      new LensPeriphery__factory(deployer).deploy(lensHub.address, {
        nonce: deployerNonce++,
      }),
      [lensHub.address],
      'contracts/misc/LensPeriphery.sol:LensPeriphery'
    );

    // Deploy collect modules
    console.log('\n\t-- Deploying feeCollectModule --');
    const feeCollectModule = await deployWithVerify(
      new FeeCollectModule__factory(deployer).deploy(lensHub.address, moduleGlobals.address, {
        nonce: deployerNonce++,
      }),
      [lensHub.address, moduleGlobals.address],
      'contracts/core/modules/collect/FeeCollectModule.sol:FeeCollectModule'
    );
    console.log('\n\t-- Deploying limitedFeeCollectModule --');
    const limitedFeeCollectModule = await deployWithVerify(
      new LimitedFeeCollectModule__factory(deployer).deploy(
        lensHub.address,
        moduleGlobals.address,
        {
          nonce: deployerNonce++,
        }
      ),
      [lensHub.address, moduleGlobals.address],
      'contracts/core/modules/collect/LimitedFeeCollectModule.sol:LimitedFeeCollectModule'
    );
    console.log('\n\t-- Deploying timedFeeCollectModule --');
    const timedFeeCollectModule = await deployWithVerify(
      new TimedFeeCollectModule__factory(deployer).deploy(lensHub.address, moduleGlobals.address, {
        nonce: deployerNonce++,
      }),
      [lensHub.address, moduleGlobals.address],
      'contracts/core/modules/collect/TimedFeeCollectModule.sol:TimedFeeCollectModule'
    );
    console.log('\n\t-- Deploying limitedTimedFeeCollectModule --');
    const limitedTimedFeeCollectModule = await deployWithVerify(
      new LimitedTimedFeeCollectModule__factory(deployer).deploy(
        lensHub.address,
        moduleGlobals.address,
        { nonce: deployerNonce++ }
      ),
      [lensHub.address, moduleGlobals.address],
      'contracts/core/modules/collect/LimitedTimedFeeCollectModule.sol:LimitedTimedFeeCollectModule'
    );

    console.log('\n\t-- Deploying revertCollectModule --');
    const revertCollectModule = await deployWithVerify(
      new RevertCollectModule__factory(deployer).deploy({ nonce: deployerNonce++ }),
      [],
      'contracts/core/modules/collect/RevertCollectModule.sol:RevertCollectModule'
    );
    console.log('\n\t-- Deploying freeCollectModule --');
    const freeCollectModule = await deployWithVerify(
      new FreeCollectModule__factory(deployer).deploy(lensHub.address, { nonce: deployerNonce++ }),
      [lensHub.address],
      'contracts/core/modules/collect/FreeCollectModule.sol:FreeCollectModule'
    );

    // Deploy follow modules
    console.log('\n\t-- Deploying feeFollowModule --');
    const feeFollowModule = await deployWithVerify(
      new FeeFollowModule__factory(deployer).deploy(lensHub.address, moduleGlobals.address, {
        nonce: deployerNonce++,
      }),
      [lensHub.address, moduleGlobals.address],
      'contracts/core/modules/follow/FeeFollowModule.sol:FeeFollowModule'
    );
    console.log('\n\t-- Deploying profileFollowModule --');
    const profileFollowModule = await deployWithVerify(
      new ProfileFollowModule__factory(deployer).deploy(lensHub.address, {
        nonce: deployerNonce++,
      }),
      [lensHub.address],
      'contracts/core/modules/follow/ProfileFollowModule.sol:ProfileFollowModule'
    );
    // --- COMMENTED OUT AS THIS IS NOT A LAUNCH MODULE ---
    // console.log('\n\t-- Deploying approvalFollowModule --');
    // const approvalFollowModule = await deployWithVerify(
    // new ApprovalFollowModule__factory(deployer).deploy(lensHub.address, {
    // nonce: deployerNonce++,
    // }),
    // [lensHub.address],
    // 'contracts/core/modules/follow/ApprovalFollowModule.sol:ApprovalFollowModule'
    // );
    // console.log('\n\t-- Deploying supefluidCFAFollowModule --');
    // if (!process.env.SUPERFLUID_HOST_ADDRESS) {
    //   throw new Error('🚫 SUPERFLUID_HOST_ADDRESS env var is required');
    // }
    // await deployWithVerify(
    //   new SuperfluidCFAFollowModule__factory(deployer).deploy(
    //     lensHub.address,
    //     moduleGlobals.address,
    //     process.env.SUPERFLUID_HOST_ADDRESS,
    //     { nonce: deployerNonce++ },
    //   )
    // );

    // Deploy reference module
    console.log('\n\t-- Deploying followerOnlyReferenceModule --');
    const followerOnlyReferenceModule = await deployWithVerify(
      new FollowerOnlyReferenceModule__factory(deployer).deploy(lensHub.address, {
        nonce: deployerNonce++,
      }),
      [lensHub.address],
      'contracts/core/modules/reference/FollowerOnlyReferenceModule.sol:FollowerOnlyReferenceModule'
    );

    // Deploy UIDataProvider
    console.log('\n\t-- Deploying UI Data Provider --');
    const uiDataProvider = await deployWithVerify(
      new UIDataProvider__factory(deployer).deploy(lensHub.address, {
        nonce: deployerNonce++,
      }),
      [lensHub.address],
      'contracts/misc/UIDataProvider.sol:UIDataProvider'
    );

    // Whitelist the collect modules
    console.log('\n\t-- Whitelisting Collect Modules --');
    let governanceNonce = await ethers.provider.getTransactionCount(governance.address);
    await waitForTx(
      lensHub.whitelistCollectModule(feeCollectModule.address, true, { nonce: governanceNonce++ })
    );
    await waitForTx(
      lensHub.whitelistCollectModule(limitedFeeCollectModule.address, true, {
        nonce: governanceNonce++,
      })
    );
    await waitForTx(
      lensHub.whitelistCollectModule(timedFeeCollectModule.address, true, {
        nonce: governanceNonce++,
      })
    );
    await waitForTx(
      lensHub.whitelistCollectModule(limitedTimedFeeCollectModule.address, true, {
        nonce: governanceNonce++,
      })
    );
    await waitForTx(
      lensHub.whitelistCollectModule(revertCollectModule.address, true, {
        nonce: governanceNonce++,
      })
    );
    await waitForTx(
      lensHub.whitelistCollectModule(freeCollectModule.address, true, { nonce: governanceNonce++ })
    );

    // Whitelist the follow modules
    console.log('\n\t-- Whitelisting Follow Modules --');
    await waitForTx(
      lensHub.whitelistFollowModule(feeFollowModule.address, true, { nonce: governanceNonce++ })
    );
    await waitForTx(
      lensHub.whitelistFollowModule(profileFollowModule.address, true, { nonce: governanceNonce++ })
    );
    // --- COMMENTED OUT AS THIS IS NOT A LAUNCH MODULE ---
    // await waitForTx(
    // lensHub.whitelistFollowModule(approvalFollowModule.address, true, {
    // nonce: governanceNonce++,
    // })
    // );
    // await waitForTx(
    //   lensHub.whitelistFollowModule(superfluidCFAFollowModule.address, true, { nonce: governanceNonce++ })
    // );

    // Whitelist the reference module
    console.log('\n\t-- Whitelisting Reference Module --');
    await waitForTx(
      lensHub.whitelistReferenceModule(followerOnlyReferenceModule.address, true, {
        nonce: governanceNonce++,
      })
    );

    // Save and log the addresses
    const addrs = {
      'lensHub proxy': lensHub.address,
      'lensHub impl:': lensHubImpl.address,
      'publishing logic lib': publishingLogic.address,
      'interaction logic lib': interactionLogic.address,
      'profile token URI logic lib': profileTokenURILogic.address,
      'follow NFT impl': followNFTImplAddress,
      'collect NFT impl': collectNFTImplAddress,
      'lens periphery': lensPeriphery.address,
      'module globals': moduleGlobals.address,
      'fee collect module': feeCollectModule.address,
      'limited fee collect module': limitedFeeCollectModule.address,
      'timed fee collect module': timedFeeCollectModule.address,
      'limited timed fee collect module': limitedTimedFeeCollectModule.address,
      'revert collect module': revertCollectModule.address,
      'free collect module': freeCollectModule.address,
      'fee follow module': feeFollowModule.address,
      'profile follow module': profileFollowModule.address,
      // --- COMMENTED OUT AS THIS IS NOT A LAUNCH MODULE ---
      // 'approval follow module': approvalFollowModule.address,
      // 'superfluid follow module': superfluidCFAFollowModule.address,
      'follower only reference module': followerOnlyReferenceModule.address,
      'UI data provider': uiDataProvider.address,
    };
    const json = JSON.stringify(addrs, null, 2);
    console.log(json);

    fs.writeFileSync('addresses.json', json, 'utf-8');
  }
);
