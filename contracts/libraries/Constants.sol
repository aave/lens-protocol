// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

library Constants {
    string internal constant FOLLOW_NFT_NAME_SUFFIX = '-Follower';
    string internal constant FOLLOW_NFT_SYMBOL_SUFFIX = '-Fl';
    string internal constant COLLECT_NFT_NAME_INFIX = '-Collect-';
    string internal constant COLLECT_NFT_SYMBOL_INFIX = '-Cl-';
    uint8 internal constant MAX_HANDLE_LENGTH = 31;
    uint16 internal constant MAX_PROFILE_IMAGE_URI_LENGTH = 6000;
}
