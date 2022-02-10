import '@nomiclabs/hardhat-ethers';
import { hexlify, keccak256, RLP } from 'ethers/lib/utils';
import fs from 'fs';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  LensHub__factory,
  ApprovalFollowModule__factory,
  CollectNFT__factory,
  Currency__factory,
  EmptyCollectModule__factory,
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
} from '../typechain-types';
import { deployWithVerify, waitForTx } from './helpers/utils';

const TREASURY_FEE_BPS = 50;
const LENS_HUB_NFT_NAME = 'Various Vegetables';
const LENS_HUB_NFT_SYMBOL = 'VVGT';

export let runtimeHRE: HardhatRuntimeEnvironment;

task('full-deploy-verify', 'deploys the entire Lens Protocol with explorer verification').setAction(
  async ({}, hre) => {
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
    const hubLibs = {
      'contracts/libraries/PublishingLogic.sol:PublishingLogic': publishingLogic.address,
      'contracts/libraries/InteractionLogic.sol:InteractionLogic': interactionLogic.address,
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
      '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol'
    );

    // Connect the hub proxy to the LensHub factory and the governance for ease of use.
    const lensHub = LensHub__factory.connect(proxy.address, governance);

    // Currency
    console.log('\n\t-- Deploying Currency --');
    const currency = await deployWithVerify(
      new Currency__factory(deployer).deploy({ nonce: deployerNonce++ }),
      [],
      'contracts/mocks/Currency.sol:Currency'
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
    console.log('\n\t-- Deploying emptyCollectModule --');
    const emptyCollectModule = await deployWithVerify(
      new EmptyCollectModule__factory(deployer).deploy(lensHub.address, { nonce: deployerNonce++ }),
      [lensHub.address],
      'contracts/core/modules/collect/EmptyCollectModule.sol:EmptyCollectModule'
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
    console.log('\n\t-- Deploying approvalFollowModule --');
    const approvalFollowModule = await deployWithVerify(
      new ApprovalFollowModule__factory(deployer).deploy(lensHub.address, {
        nonce: deployerNonce++,
      }),
      [lensHub.address],
      'contracts/core/modules/follow/ApprovalFollowModule.sol:ApprovalFollowModule'
    );

    // Deploy reference module
    console.log('\n\t-- Deploying followerOnlyReferenceModule --');
    const followerOnlyReferenceModule = await deployWithVerify(
      new FollowerOnlyReferenceModule__factory(deployer).deploy(lensHub.address, {
        nonce: deployerNonce++,
      }),
      [lensHub.address],
      'contracts/core/modules/reference/FollowerOnlyReferenceModule.sol:FollowerOnlyReferenceModule'
    );

    // Allowlist the collect modules
    console.log('\n\t-- Allowlisting Collect Modules --');
    let governanceNonce = await ethers.provider.getTransactionCount(governance.address);
    await waitForTx(
      lensHub.allowlistCollectModule(feeCollectModule.address, true, { nonce: governanceNonce++ })
    );
    await waitForTx(
      lensHub.allowlistCollectModule(limitedFeeCollectModule.address, true, {
        nonce: governanceNonce++,
      })
    );
    await waitForTx(
      lensHub.allowlistCollectModule(timedFeeCollectModule.address, true, {
        nonce: governanceNonce++,
      })
    );
    await waitForTx(
      lensHub.allowlistCollectModule(limitedTimedFeeCollectModule.address, true, {
        nonce: governanceNonce++,
      })
    );
    await waitForTx(
      lensHub.allowlistCollectModule(revertCollectModule.address, true, {
        nonce: governanceNonce++,
      })
    );
    await waitForTx(
      lensHub.allowlistCollectModule(emptyCollectModule.address, true, { nonce: governanceNonce++ })
    );

    // Allowlist the follow modules
    console.log('\n\t-- Allowlisting Follow Modules --');
    await waitForTx(
      lensHub.allowlistFollowModule(feeFollowModule.address, true, { nonce: governanceNonce++ })
    );
    await waitForTx(
      lensHub.allowlistFollowModule(approvalFollowModule.address, true, {
        nonce: governanceNonce++,
      })
    );

    // Allowlist the reference module
    console.log('\n\t-- Allowlisting Reference Module --');
    await waitForTx(
      lensHub.allowlistReferenceModule(followerOnlyReferenceModule.address, true, {
        nonce: governanceNonce++,
      })
    );

    // Allowlist the currency
    console.log('\n\t-- Allowlisting Currency in Module Globals --');
    await waitForTx(
      moduleGlobals
        .connect(governance)
        .allowlistCurrency(currency.address, true, { nonce: governanceNonce++ })
    );

    // Save and log the addresses
    const addrs = {
      'lensHub proxy': lensHub.address,
      'lensHub impl:': lensHubImpl.address,
      'publishing logic lib': publishingLogic.address,
      'interaction logic lib': interactionLogic.address,
      'follow NFT impl': followNFTImplAddress,
      'collect NFT impl': collectNFTImplAddress,
      currency: currency.address,
      'module globals': moduleGlobals.address,
      'fee collect module': feeCollectModule.address,
      'limited fee collect module': limitedFeeCollectModule.address,
      'timed fee collect module': timedFeeCollectModule.address,
      'limited timed fee collect module': limitedTimedFeeCollectModule.address,
      'revert collect module': revertCollectModule.address,
      'empty collect module': emptyCollectModule.address,
      'fee follow module': feeFollowModule.address,
      'approval follow module': approvalFollowModule.address,
      'follower only reference module': followerOnlyReferenceModule.address,
    };
    const json = JSON.stringify(addrs, null, 2);
    console.log(json);

    fs.writeFileSync('addresses.json', json, 'utf-8');
  }
);
