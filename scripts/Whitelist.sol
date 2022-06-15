// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {DataTypes} from '../contracts/libraries/DataTypes.sol';

import {ScriptTypes} from './ScriptTypes.sol';

import 'forge-std/Script.sol';

contract Whitelist is Script {
    function run(ScriptTypes.Contracts calldata contracts) external {
        vm.startBroadcast(msg.sender);

        contracts.lensHub.whitelistCollectModule(address(contracts.feeCollectModule), true);
        contracts.lensHub.whitelistCollectModule(address(contracts.limitedFeeCollectModule), true);
        contracts.lensHub.whitelistCollectModule(address(contracts.timedFeeCollectModule), true);
        contracts.lensHub.whitelistCollectModule(
            address(contracts.limitedTimedFeeCollectModule),
            true
        );
        contracts.lensHub.whitelistCollectModule(address(contracts.revertCollectModule), true);
        contracts.lensHub.whitelistCollectModule(address(contracts.freeCollectModule), true);

        contracts.lensHub.whitelistFollowModule(address(contracts.feeFollowModule), true);
        contracts.lensHub.whitelistFollowModule(address(contracts.profileFollowModule), true);
        contracts.lensHub.whitelistFollowModule(address(contracts.revertFollowModule), true);
        contracts.lensHub.whitelistFollowModule(address(contracts.approvalFollowModule), true);

        contracts.lensHub.whitelistReferenceModule(
            address(contracts.followerOnlyReferenceModule),
            true
        );

        contracts.moduleGlobals.whitelistCurrency(address(contracts.currency), true);

        contracts.lensHub.whitelistProfileCreator(address(contracts.profileCreationProxy), true);

        contracts.lensHub.setState(DataTypes.ProtocolState.Unpaused);

        vm.stopBroadcast();
    }
}
