// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {Errors} from '../../libraries/Errors.sol';
import {Events} from '../../libraries/Events.sol';
import {IModuleGlobals} from '../../interfaces/IModuleGlobals.sol';

/**
 * @title ModuleGlobals
 * @author Lens Protocol
 *
 * @notice This contract contains data relevant to Lens modules, such as the module governance address, treasury
 * address and treasury fee BPS.
 *
 * NOTE: The reason we have an additional governance address instead of just fetching it from the hub is to
 * allow the flexibility of using different governance executors.
 */
contract ModuleGlobals is IModuleGlobals {
    uint16 internal constant BPS_MAX = 10000;

    mapping(address => bool) internal _currencyAllowlisted;
    address internal _governance;
    address internal _treasury;
    uint16 internal _treasuryFee;

    modifier onlyGov() {
        if (msg.sender != _governance) revert Errors.NotGovernance();
        _;
    }

    /**
     * @notice Initializes the governance, treasury and treasury fee amounts.
     *
     * @param governance The governance address which has additional control over setting certain parameters.
     * @param treasury The treasury address to direct fees to.
     * @param treasuryFee The treasury fee in BPS to levy on collects.
     */
    constructor(
        address governance,
        address treasury,
        uint16 treasuryFee
    ) {
        _setGovernance(governance);
        _setTreasury(treasury);
        _setTreasuryFee(treasuryFee);
    }

    /// @inheritdoc IModuleGlobals
    function setGovernance(address newGovernance) external override onlyGov {
        _setGovernance(newGovernance);
    }

    /// @inheritdoc IModuleGlobals
    function setTreasury(address newTreasury) external override onlyGov {
        _setTreasury(newTreasury);
    }

    /// @inheritdoc IModuleGlobals
    function setTreasuryFee(uint16 newTreasuryFee) external override onlyGov {
        _setTreasuryFee(newTreasuryFee);
    }

    /// @inheritdoc IModuleGlobals
    function allowlistCurrency(address currency, bool toAllowlist) external override onlyGov {
        _allowlistCurrency(currency, toAllowlist);
    }

    /// @inheritdoc IModuleGlobals
    function isCurrencyAllowlisted(address currency) external view override returns (bool) {
        return _currencyAllowlisted[currency];
    }

    /// @inheritdoc IModuleGlobals
    function getGovernance() external view override returns (address) {
        return _governance;
    }

    /// @inheritdoc IModuleGlobals
    function getTreasury() external view override returns (address) {
        return _treasury;
    }

    /// @inheritdoc IModuleGlobals
    function getTreasuryFee() external view override returns (uint16) {
        return _treasuryFee;
    }

    //@inheritdoc IModuleGlobals
    function getTreasuryData() external view override returns (address, uint16) {
        return (_treasury, _treasuryFee);
    }

    function _setGovernance(address newGovernance) internal {
        if (newGovernance == address(0)) revert Errors.InitParamsInvalid();
        address prevGovernance = _governance;
        _governance = newGovernance;
        emit Events.ModuleGlobalsGovernanceSet(prevGovernance, newGovernance, block.timestamp);
    }

    function _setTreasury(address newTreasury) internal {
        if (newTreasury == address(0)) revert Errors.InitParamsInvalid();
        address prevTreasury = _treasury;
        _treasury = newTreasury;
        emit Events.ModuleGlobalsTreasurySet(prevTreasury, newTreasury, block.timestamp);
    }

    function _setTreasuryFee(uint16 newTreasuryFee) internal {
        if (newTreasuryFee >= BPS_MAX / 2) revert Errors.InitParamsInvalid();
        uint16 prevTreasuryFee = _treasuryFee;
        _treasuryFee = newTreasuryFee;
        emit Events.ModuleGlobalsTreasuryFeeSet(prevTreasuryFee, newTreasuryFee, block.timestamp);
    }

    function _allowlistCurrency(address currency, bool toAllowlist) internal {
        if (currency == address(0)) revert Errors.InitParamsInvalid();
        bool prevAllowlisted = _currencyAllowlisted[currency];
        _currencyAllowlisted[currency] = toAllowlist;
        emit Events.ModuleGlobalsCurrencyAllowlisted(
            currency,
            prevAllowlisted,
            toAllowlist,
            block.timestamp
        );
    }
}
