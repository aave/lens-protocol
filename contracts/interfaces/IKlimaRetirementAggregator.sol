// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

/**
 * @title IKlimaRetirementAggregator
 * @author KlimaDAO
 *
 * @notice This is the interface for the KlimaDAO carbon offset retirement aggregator contract.
 */
interface IKlimaRetirementAggregator {
    /**
     * @notice Retires the specified carbon offset token with the provided parameters.
     *
     * @param _sourceToken The token ID of the currency being provided.
     * @param _poolToken The token ID of the carbon offset pool to retire from (e.g. BCT, MCO2).
     * @param _amount Amount of carbon offsets to retire, or amount of currency provided - behavior controlled by _amountInCarbon.
     * @param _amountInCarbon Indicates whether the _amount value represents the amout of the currency provided or the amount of carbon the user wants to retire.
     * @param _beneficiaryAddress Address on whose behalf the offsets are being retired.
     * @param _beneficiaryString Describes the beneficiary of the retirement.
     * @param _retirementMessage Describes the reason or context for the retirement.
     */
    function retireCarbon(
        address _sourceToken,
        address _poolToken,
        uint256 _amount,
        bool _amountInCarbon,
        address _beneficiaryAddress,
        string memory _beneficiaryString,
        string memory _retirementMessage
    ) external;

    /**
     * @notice Retires the specified carbon offset token with the provided parameters, but assumes the source token are already transferred to this contract.
     *
     * @param _recipient The address which should receive back any _sourceToken dust if _amountInCarbon is true.
     * @param _sourceToken The token ID of the currency being provided.
     * @param _poolToken The token ID of the carbon offset pool to retire from (e.g. BCT, MCO2).
     * @param _amount Amount of carbon offsets to retire, or amount of currency provided - behavior controlled by _amountInCarbon.
     * @param _amountInCarbon Indicates whether the _amount value represents the amout of the currency provided or the amount of carbon the user wants to retire.
     * @param _beneficiaryAddress Address on whose behalf the offsets are being retired.
     * @param _beneficiaryString Describes the beneficiary of the retirement.
     * @param _retirementMessage Describes the reason or context for the retirement.
     */
    function retireCarbonFrom(
        address _recipient,
        address _sourceToken,
        address _poolToken,
        uint256 _amount,
        bool _amountInCarbon,
        address _beneficiaryAddress,
        string memory _beneficiaryString,
        string memory _retirementMessage
    ) external;
}
