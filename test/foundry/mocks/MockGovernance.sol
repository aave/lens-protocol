// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

contract MockGovernance {
    function govern(address target, bytes calldata data) public returns (bytes memory) {
        (bool success, bytes memory result) = target.call(data);
        require(success, 'Governing failed!');

        return result;
    }
}
