// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import '@openzeppelin/contracts/access/AccessControl.sol';
import '@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol';

import {ILensHub} from '../interfaces/ILensHub.sol';
import {DataTypes} from '../libraries/DataTypes.sol';

/**
 * @title SharedAccount
 * @author Lens Protocol, WATCHPUG
 *
 * @dev A smart contract that will hold a ProfileNFT, it has 2 roles,
 * 1) admin: which can set FollowModules, transfer the ProfileNFT to another address, and add/remove posters.
 * 2) posters: only able to create publications..
 */
contract SharedAccount is AccessControl {
  address immutable HUB;

  bytes32 public constant ADMIN_ROLE = keccak256('ADMIN_ROLE');
  bytes32 public constant POSTER_ROLE = keccak256('POSTER_ROLE');

  constructor(
    address hub,
    address _admin,
    address _defaultPoster
  ) {
    HUB = hub;

    _setRoleAdmin(POSTER_ROLE, ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _admin);
    _setupRole(ADMIN_ROLE, _admin);

    if (_defaultPoster != address(0)) {
      _setupRole(POSTER_ROLE, _defaultPoster);
    }
  }

  function setFollowModule(
    uint256 profileId,
    address followModule,
    bytes calldata followModuleData
  ) external onlyRole(ADMIN_ROLE) {
    ILensHub(HUB).setFollowModule(profileId, followModule, followModuleData);
  }

  function transferProfileNFT(uint256 profileId, address to) external onlyRole(ADMIN_ROLE) {
    IERC721Enumerable(HUB).transferFrom(address(this), to, profileId);
  }

  function post(DataTypes.PostData calldata vars) external onlyRole(POSTER_ROLE) {
    ILensHub(HUB).post(vars);
  }

  function comment(DataTypes.CommentData calldata vars) external onlyRole(POSTER_ROLE) {
    ILensHub(HUB).comment(vars);
  }

  function mirror(DataTypes.MirrorData calldata vars) external onlyRole(POSTER_ROLE) {
    ILensHub(HUB).mirror(vars);
  }
}
