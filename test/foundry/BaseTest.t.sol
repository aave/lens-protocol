// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import 'forge-std/Test.sol';

import {ScriptTypes} from '../../scripts/ScriptTypes.sol';
import {Deploy} from '../../scripts/Deploy.sol';
import {Whitelist} from '../../scripts/Whitelist.sol';
import {MockGovernance} from './mocks/MockGovernance.sol';

contract BaseTest is Test {
    address immutable user = vm.addr(1);
    address immutable userTwo = vm.addr(2);
    address immutable userThree = vm.addr(3);
    address immutable treasury = vm.addr(4);

    uint256 immutable FIRST_PROFILE_ID = 1;
    string constant MOCK_PROFILE_HANDLE = 'plant1ghost.eth';
    string constant MOCK_PROFILE_URI =
        'https://ipfs.io/ipfs/Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu';
    string constant MOCK_FOLLOW_NFT_URI =
        'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan';

    string constant MOCK_URI =
        'https://ipfs.io/ipfs/QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR';

    MockGovernance internal gov;

    ScriptTypes.Contracts internal contracts;

    function setUp() public virtual {
        gov = new MockGovernance();

        // Run Deploy script
        Deploy deploy = new Deploy();
        // We delegate call so that msg.sender is persisted we do not need test specific changes in the deploy script
        (bool success, bytes memory result) = address(deploy).delegatecall(
            abi.encodeWithSelector(Deploy.run.selector, address(gov), treasury)
        );
        require(success, 'Deploy script did not run successfully!');
        contracts = abi.decode(result, (ScriptTypes.Contracts));

        // Run Whitelist script, as Gov
        // Pranking does not work here as you cannot prank and broadcast at the same time
        Whitelist whitelist = new Whitelist();
        gov.govern(address(whitelist), abi.encodeWithSelector(Whitelist.run.selector, contracts));

        // Whitelist some users, as Gov
        gov.govern(
            address(contracts.lensHub),
            abi.encodeWithSelector(contracts.lensHub.whitelistProfileCreator.selector, user, true)
        );
        gov.govern(
            address(contracts.lensHub),
            abi.encodeWithSelector(
                contracts.lensHub.whitelistProfileCreator.selector,
                userTwo,
                true
            )
        );
        gov.govern(
            address(contracts.lensHub),
            abi.encodeWithSelector(
                contracts.lensHub.whitelistProfileCreator.selector,
                userThree,
                true
            )
        );
    }
}
