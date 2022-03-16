// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import '@openzeppelin/contracts/proxy/Clones.sol';

import './TokenSwapDelegation.sol';

/// @title The SwapDelegatorFactory allows users to create TokenSwapDelegation very cheaply.
contract SwapDelegatorFactory {
    using Clones for address;

    /// @notice The instance to which all proxies will point.
    TokenSwapDelegation public delegationInstance;

    /// @notice Contract constructor.
    constructor() {
        delegationInstance = new TokenSwapDelegation();
        delegationInstance.initialize(address(0));
    }

    /**
     * @notice Creates a clone of the delegation.
     * @param _salt Random number used to deterministically deploy the clone
     * @param _recipient The custom recipient address to direct earnings to.
     * @return The newly created delegation
     */
    function _createDelegation(bytes32 _salt, address _recipient) internal returns (address) {
        TokenSwapDelegation _delegation = TokenSwapDelegation(address(delegationInstance).cloneDeterministic(_salt));
        _delegation.initialize(_recipient);
        return address(_delegation);
    }

    /**
     * @notice Computes salt used to deterministically deploy a clone.
     * @param _profileId profileId of the delegator
     * @return Salt used to deterministically deploy a clone.
     */
    function _computeSalt(uint256 _profileId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_profileId));
    }
}
