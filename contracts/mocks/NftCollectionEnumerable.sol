// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {ERC721} from '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {ERC721Enumerable} from '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';

contract NftCollectionEnumerable is ERC721Enumerable {

    constructor() ERC721('MockNftCollectionEnumerable', 'MNCE') {
    }

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}
