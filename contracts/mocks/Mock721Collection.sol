// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/utils/Counters.sol';

contract Mock721Collection is ERC721 {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIds;

    constructor() ERC721('Mock721Collection', 'MCT') {}

    function totalSupply() public view virtual returns (uint256) {
        return _tokenIds.current();
    }

    function mint(address to) public virtual returns (bool) {
        _tokenIds.increment();
        uint256 tokenID = _tokenIds.current();
        _safeMint(to, tokenID);
        return true;
    }

    function safeTransfer(
        address to,
        uint256 tokenId,
        bytes calldata data
    ) public virtual {
        super._safeTransfer(_msgSender(), to, tokenId, data);
    }

    function safeTransfer(address to, uint256 tokenId) public virtual {
        super._safeTransfer(_msgSender(), to, tokenId, '');
    }
}
