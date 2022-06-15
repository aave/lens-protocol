// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {ModuleGlobals} from '../contracts/core/modules/ModuleGlobals.sol';
import {LensHub} from '../contracts/core/LensHub.sol';
import {FollowNFT} from '../contracts/core/FollowNFT.sol';
import {CollectNFT} from '../contracts/core/CollectNFT.sol';

import {TransparentUpgradeableProxy} from '../contracts/upgradeability/TransparentUpgradeableProxy.sol';

import {FeeCollectModule} from '../contracts/core/modules/collect/FeeCollectModule.sol';
import {LimitedFeeCollectModule} from '../contracts/core/modules/collect/LimitedFeeCollectModule.sol';
import {TimedFeeCollectModule} from '../contracts/core/modules/collect/TimedFeeCollectModule.sol';
import {LimitedTimedFeeCollectModule} from '../contracts/core/modules/collect/LimitedTimedFeeCollectModule.sol';
import {RevertCollectModule} from '../contracts/core/modules/collect/RevertCollectModule.sol';
import {FreeCollectModule} from '../contracts/core/modules/collect/FreeCollectModule.sol';

import {FeeFollowModule} from '../contracts/core/modules/follow/FeeFollowModule.sol';
import {ProfileFollowModule} from '../contracts/core/modules/follow/ProfileFollowModule.sol';
import {RevertFollowModule} from '../contracts/core/modules/follow/RevertFollowModule.sol';
import {ApprovalFollowModule} from '../contracts/core/modules/follow/ApprovalFollowModule.sol';

import {FollowerOnlyReferenceModule} from '../contracts/core/modules/reference/FollowerOnlyReferenceModule.sol';

import {LensPeriphery} from '../contracts/misc/LensPeriphery.sol';
import {UIDataProvider} from '../contracts/misc/UIDataProvider.sol';
import {ProfileCreationProxy} from '../contracts/misc/ProfileCreationProxy.sol';

import {Currency} from '../contracts/mocks/Currency.sol';

library ScriptTypes {
    struct Contracts {
        ModuleGlobals moduleGlobals;
        LensHub lensHubImpl;
        FollowNFT followNFT;
        CollectNFT collectNFT;
        TransparentUpgradeableProxy proxy;
        LensHub lensHub;
        LensPeriphery lensPeriphery;
        Currency currency;
        FeeCollectModule feeCollectModule;
        LimitedFeeCollectModule limitedFeeCollectModule;
        TimedFeeCollectModule timedFeeCollectModule;
        LimitedTimedFeeCollectModule limitedTimedFeeCollectModule;
        RevertCollectModule revertCollectModule;
        FreeCollectModule freeCollectModule;
        FeeFollowModule feeFollowModule;
        ProfileFollowModule profileFollowModule;
        RevertFollowModule revertFollowModule;
        ApprovalFollowModule approvalFollowModule;
        FollowerOnlyReferenceModule followerOnlyReferenceModule;
        UIDataProvider uiDataProvider;
        ProfileCreationProxy profileCreationProxy;
    }
}
