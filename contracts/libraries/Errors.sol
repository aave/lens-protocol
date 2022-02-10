// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

library Errors {
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
    error CallerNotAllowlistedModule();
    error CollectModuleNotAllowlisted();
    error FollowModuleNotAllowlisted();
    error ReferenceModuleNotAllowlisted();
    error ProfileCreatorNotAllowlisted();
    error NotProfileOwner();
    error NotProfileOwnerOrDispatcher();
    error PublicationDoesNotExist();
    error HandleTaken();
    error HandleLengthInvalid();
    error HandleContainsInvalidCharacters();
    error CallerNotFollowNFT();
    error CallerNotCollectNFT();
    error BlockNumberInvalid();
    error ArrayMismatch();

    // Module Errors
    error InitParamsInvalid();
    error ZeroCurrency();
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
