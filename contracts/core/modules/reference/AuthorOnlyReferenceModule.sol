// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {IReferenceModule} from '../../../interfaces/IReferenceModule.sol';
import {ModuleBase} from '../ModuleBase.sol';
import {Errors} from '../../../libraries/Errors.sol';
import {IERC721} from '@openzeppelin/contracts/token/ERC721/IERC721.sol';

/**
 * @title AuthorOnlyReferenceModule
 * @author Lens Protocol/Sébastien Bellanger (Share CEO)
 *
 * @notice A simple reference module that validates that comments or mirrors originate is the original author of parent.
 */
contract AuthorOnlyReferenceModule is IReferenceModule, ModuleBase {
    constructor(address hub) ModuleBase(hub) {}

    /**
     * @dev There is nothing needed at initialization.
     */
    function initializeReferenceModule(
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external pure override returns (bytes memory) {
        return new bytes(0);
    }

    /**
     * @notice Validates that the commenting profile's owner is the original author.
     *
     * NOTE: We don't need to care what the pointed publication is in this context.
     */
    function processComment(
        uint256 profileId,
        uint256 profileIdPointed,
        uint256 pubIdPointed,
        bytes calldata data
    ) external view override {
        address commentCreator = IERC721(HUB).ownerOf(profileId);
        address OriginalAuthor = IERC721(HUB).ownerOf(profileIdPointed);
        if (OriginalAuthor != commentCreator) {
            revert Errors.CommentNotAllowed();
        }
        
    }

    /**
     * @notice Validates that the commenting profile's owner is the original author.
     *
     * NOTE: We don't need to care what the pointed publication is in this context.
     */
    function processMirror(
        uint256 profileId,
        uint256 profileIdPointed,
        uint256 pubIdPointed,
        bytes calldata data
    ) external view override {
        address mirrorCreator = IERC721(HUB).ownerOf(profileId);
        address OriginalAuthor = IERC721(HUB).ownerOf(profileIdPointed);
        if (OriginalAuthor != mirrorCreator) {
            revert Errors.MirrorNotAllowed();
        }
    }
}
