// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import './SharedAccount.sol';

/// @title The SharedAccountFactory allows users to create SharedAccount
contract SharedAccountFactory {

  address immutable HUB;

  constructor(address hub) {
    HUB = hub;
  }

  function newSharedAccount(
    address _owner,
    address _defaultPoster
  ) public returns (address) {
    SharedAccount instance = new SharedAccount(
      HUB,
      _owner,
      _defaultPoster
    );
    return address(instance);
  }
}