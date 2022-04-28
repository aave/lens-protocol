// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {ERC721} from '@openzeppelin/contracts/token/ERC721/ERC721.sol';

contract NftCollection is ERC721('MockNftCollection', 'MNC') {
    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }

    function burn(uint256 tokenId) external {
        _burn(tokenId);
    }
}
