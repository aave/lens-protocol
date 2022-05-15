// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';

contract Mock1155Collection is ERC1155 {
    using SafeMath for uint256;

    mapping(uint256 => address) public creators;
    mapping(uint256 => uint256) public tokenSupply;

    constructor() ERC1155('') {}

    function totalSupply(uint256 _id) public view returns (uint256) {
        return tokenSupply[_id];
    }

    function create(
        address _initialOwner,
        uint256 _id,
        uint256 _initialSupply,
        bytes memory _data
    ) public returns (uint256) {
        require(!_exists(_id), 'token _id already exists');
        creators[_id] = _msgSender();

        _mint(_initialOwner, _id, _initialSupply, _data);

        tokenSupply[_id] = _initialSupply;
        return _id;
    }

    function mint(
        address _to,
        uint256 _id,
        uint256 _quantity,
        bytes memory _data
    ) public {
        _mint(_to, _id, _quantity, _data);
        tokenSupply[_id] = tokenSupply[_id].add(_quantity);
    }

    function mintBatch(
        address _to,
        uint256[] memory _ids,
        uint256[] memory _quantities,
        bytes memory _data
    ) public {
        for (uint256 i = 0; i < _ids.length; i++) {
            uint256 _id = _ids[i];
            require(creators[_id] == _msgSender(), 'ERC1155#mintBatch: ONLY_CREATOR_ALLOWED');
            uint256 quantity = _quantities[i];
            tokenSupply[_id] = tokenSupply[_id].add(quantity);
        }
        _mintBatch(_to, _ids, _quantities, _data);
    }

    function _exists(uint256 _id) internal view returns (bool) {
        return creators[_id] != address(0);
    }
}
