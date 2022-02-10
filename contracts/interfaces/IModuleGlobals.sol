// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

/**
 * @title IModuleGlobals
 * @author Lens Protocol
 *
 * @notice This is the interface for the ModuleGlobals contract, a data providing contract to be queried by modules
 * for the most up-to-date parameters.
 */
interface IModuleGlobals {
    /**
     * @notice Sets the governance address. This function can only be called by governance.
     *
     * @param newGovernance The new governance address to set.
     */
    function setGovernance(address newGovernance) external;

    /**
     * @notice Sets the treasury address. This function can only be called by governance.
     *
     * @param newTreasury The new treasury address to set.
     */
    function setTreasury(address newTreasury) external;

    /**
     * @notice Sets the treasury fee. This function can only be called by governance.
     *
     * @param newTreasuryFee The new treasury fee to set.
     */
    function setTreasuryFee(uint16 newTreasuryFee) external;

    /**
     * @notice Adds or removes a currency from the allowlist. This function can only be called by governance.
     *
     * @param currency The currency to add or remove from the allowlist.
     * @param toAllowlist Whether to add or remove the currency from the allowlist.
     */
    function allowlistCurrency(address currency, bool toAllowlist) external;

    /// ************************
    /// *****VIEW FUNCTIONS*****
    /// ************************

    /**
     * @notice Returns whether a currency is allowlisted.
     *
     * @param currency The currency to query the allowlist for.
     *
     * @return Whether the queried currency is allowlisted.
     */
    function isCurrencyAllowlisted(address currency) external view returns (bool);

    /**
     * @notice Returns the governance address.
     *
     * @return The governance address.
     */
    function getGovernance() external view returns (address);

    /**
     * @notice Returns the treasury address.
     *
     * @return The treasury address.
     */
    function getTreasury() external view returns (address);

    /**
     * @notice Returns the treasury fee.
     *
     * @return The treasury fee.
     */
    function getTreasuryFee() external view returns (uint16);

    /**
     * @notice Returns the treasury address and treasury fee in a single call.
     *
     * @return The treasury address and the treasury fee.
     */
    function getTreasuryData() external view returns (address, uint16);
}
