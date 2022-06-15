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

import {ScriptTypes} from './ScriptTypes.sol';

import 'forge-std/Script.sol';

contract Deploy is Script {
    uint16 constant TREASURY_FEE_BPS = 50;
    string constant LENS_HUB_NFT_NAME = 'Lens Protocol Profiles';
    string constant LENS_HUB_NFT_SYMBOL = 'LPP';

    function run(address governance, address treasury) external returns (ScriptTypes.Contracts memory contracts) {
        require(governance != address(0), "Governance address not set!");
        require(treasury != address(0), "Treasury address not set!");

        vm.startBroadcast();

        contracts.moduleGlobals = new ModuleGlobals(governance, treasury, TREASURY_FEE_BPS);

        uint256 deployerNonce = vm.getNonce(msg.sender);

        uint256 followNFTNonce = deployerNonce + 1;
        uint256 collectNFTNonce = deployerNonce + 2;
        uint256 hubProxyNonce = deployerNonce + 3;

        address followNFTImplAddress = addressFrom(msg.sender, followNFTNonce);
        address collectNFTImplAddress = addressFrom(msg.sender, collectNFTNonce);
        address hubProxyAddress = addressFrom(msg.sender, hubProxyNonce);

        contracts.lensHubImpl = new LensHub(followNFTImplAddress, collectNFTImplAddress);

        contracts.followNFT = new FollowNFT(hubProxyAddress);
        contracts.collectNFT = new CollectNFT(hubProxyAddress);

        contracts.proxy = new TransparentUpgradeableProxy(
            address(contracts.lensHubImpl),
            msg.sender,
            abi.encodeWithSelector(
                LensHub.initialize.selector,
                LENS_HUB_NFT_NAME,
                LENS_HUB_NFT_SYMBOL,
                governance
            )
        );

        contracts.lensHub = LensHub(address(contracts.proxy));

        contracts.lensPeriphery = new LensPeriphery(contracts.lensHub);

        contracts.currency = new Currency();

        address lensHubAddress = address(contracts.lensHub);
        address moduleGlobalsAddress = address(contracts.moduleGlobals);

        contracts.feeCollectModule = new FeeCollectModule(lensHubAddress, moduleGlobalsAddress);
        contracts.limitedFeeCollectModule = new LimitedFeeCollectModule(
            lensHubAddress,
            moduleGlobalsAddress
        );
        contracts.timedFeeCollectModule = new TimedFeeCollectModule(
            lensHubAddress,
            moduleGlobalsAddress
        );
        contracts.limitedTimedFeeCollectModule = new LimitedTimedFeeCollectModule(
            lensHubAddress,
            moduleGlobalsAddress
        );
        contracts.revertCollectModule = new RevertCollectModule();
        contracts.freeCollectModule = new FreeCollectModule(lensHubAddress);

        contracts.feeFollowModule = new FeeFollowModule(lensHubAddress, moduleGlobalsAddress);
        contracts.profileFollowModule = new ProfileFollowModule(lensHubAddress);
        contracts.revertFollowModule = new RevertFollowModule(lensHubAddress);
        contracts.approvalFollowModule = new ApprovalFollowModule(lensHubAddress);

        contracts.followerOnlyReferenceModule = new FollowerOnlyReferenceModule(lensHubAddress);

        contracts.uiDataProvider = new UIDataProvider(contracts.lensHub);

        contracts.profileCreationProxy = new ProfileCreationProxy(msg.sender, contracts.lensHub);

        vm.stopBroadcast();
    }

    function addressFrom(address _origin, uint256 _nonce) internal pure returns (address _address) {
        bytes memory data;
        if (_nonce == 0x00)
            data = abi.encodePacked(bytes1(0xd6), bytes1(0x94), _origin, bytes1(0x80));
        else if (_nonce <= 0x7f)
            data = abi.encodePacked(bytes1(0xd6), bytes1(0x94), _origin, uint8(_nonce));
        else if (_nonce <= 0xff)
            data = abi.encodePacked(
                bytes1(0xd7),
                bytes1(0x94),
                _origin,
                bytes1(0x81),
                uint8(_nonce)
            );
        else if (_nonce <= 0xffff)
            data = abi.encodePacked(
                bytes1(0xd8),
                bytes1(0x94),
                _origin,
                bytes1(0x82),
                uint16(_nonce)
            );
        else if (_nonce <= 0xffffff)
            data = abi.encodePacked(
                bytes1(0xd9),
                bytes1(0x94),
                _origin,
                bytes1(0x83),
                uint24(_nonce)
            );
        else
            data = abi.encodePacked(
                bytes1(0xda),
                bytes1(0x94),
                _origin,
                bytes1(0x84),
                uint32(_nonce)
            );
        bytes32 hash = keccak256(data);
        assembly {
            mstore(0, hash)
            _address := mload(0)
        }
    }
}
