// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

library Errors {
    // ERC721Time Errors
    error ERC721Time_BalanceQueryForZeroAddress();
    error ERC721Time_OwnerQueryForNonexistantToken();
    error ERC721Time_MintTimestampQueryForNonexistantToken();
    error ERC721Time_TokenDataQueryForNonexistantToken();
    error ERC721Time_URIQueryForNonexistantToken(); 
    error ERC721Time_ApprovalToCurrentOwner();
    error ERC721Time_ApproveCallerNotOwnerOrApprovedForAll();
    error ERC721Time_ApprovedQueryForNonexistantToken();
    error ERC721Time_ApproveToCaller();
    error ERC721Time_TransferCallerNotOwnerOrApproved();
    error ERC721Time_TransferToNonERC721ReceiverImplementer();
    error ERC721Time_OperatorQueryForNonexistantToken();
    error ERC721Time_MintToZeroAddress();
    error ERC721Time_TokenAlreadyMinted();
    error ERC721Time_TransferOfTokenThatIsNotOwn();
    error ERC721Time_TransferToZeroAddress();

    // ERC721Enumerable Errors
    error ERC721Enumerable_OwnerIndexOutOfBounds();
    error ERC721Enumerable_GlobalIndexOutOfBounds();

    // Lens Protocol Errors
    error CannotInitImplementation();
    error Initialized();
    error SignatureExpired();
    error ZeroSpender();
    error SignatureInvalid();
    error NotOwnerOrApproved();
    error NotHub();
    error TokenDoesNotExist();
    error NotGovernance();
    error NotGovernanceOrEmergencyAdmin();
    error EmergencyAdminCanOnlyPauseFurther();
    error CallerNotWhitelistedModule();
    error CollectModuleNotWhitelisted();
    error FollowModuleNotWhitelisted();
    error ReferenceModuleNotWhitelisted();
    error ProfileCreatorNotWhitelisted();
    error NotProfileOwner();
    error NotProfileOwnerOrDispatcher();
    error NotDispatcher();
    error PublicationDoesNotExist();
    error HandleTaken();
    error HandleLengthInvalid();
    error HandleContainsInvalidCharacters();
    error HandleFirstCharInvalid();
    error ProfileImageURILengthInvalid();
    error CallerNotFollowNFT();
    error CallerNotCollectNFT();
    error BlockNumberInvalid();
    error ArrayMismatch();
    error CannotCommentOnSelf();
    error NotWhitelisted();

    // Module Errors
    error InitParamsInvalid();
    error CollectExpired();
    error FollowInvalid();
    error ModuleDataMismatch();
    error FollowNotApproved();
    error MintLimitExceeded();
    error CollectNotAllowed();

    // MultiState Errors
    error Paused();
    error PublishingPaused();
}
