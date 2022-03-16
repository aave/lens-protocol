// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TokenSwapDelegation {
    using SafeERC20 for IERC20;

    /// @notice Contract owner.
    address private _owner;

    /// @notice The custom recipient address to direct earnings to.
    address public recipient;

    event BoughtTokens(address sellToken, address buyToken, uint256 boughtAmount);

    /**
     * @notice Initializes the delegation.
     * @param _recipient The custom recipient address to direct earnings to.
     */
    function initialize(address _recipient) public {
        require(_owner == address(0) || msg.sender == _owner, 'already-init');
        _owner = msg.sender;
        recipient = _recipient;
    }

    /// @notice Swap by filling a 0x quote.
    /// @dev Execute a swap by filling a 0x quote, as provided by the 0x API.
    ///      Charges a governable swap fee that comes out of the bought asset,
    ///      be it token or ETH. Unfortunately, the fee is also charged on any
    ///      refunded ETH from 0x protocol fees due to an implementation oddity.
    ///      This behavior shouldn't impact most users.
    ///
    ///      Learn more about the 0x API and quotes at https://0x.org/docs/api
    /// @param sellTokenAddress The contract address of the token to be sold,
    ///        as returned by the 0x `/swap/v1/quote` API endpoint. If selling
    ///        unwrapped ETH included via msg.value, this should be address(0)
    /// @param amountToSell Amount of token to sell, with the same precision as
    ///        sellTokenAddress. This information is also encoded in swapCallData.
    ///        If selling unwrapped ETH via msg.value, this should be 0.
    /// @param buyTokenAddress The contract address of the token to be bought,
    ///        as returned by the 0x `/swap/v1/quote` API endpoint. To buy
    ///        unwrapped ETH, use `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`
    /// @param minimumAmountReceived The minimum amount expected to be received
    ///        from filling the quote, before the swap fee is deducted, in
    ///        buyTokenAddress. Reverts if not met
    /// @param allowanceTarget Contract address that needs to be approved for
    ///        sellTokenAddress, as returned by the 0x `/swap/v1/quote` API
    ///        endpoint. Should be address(0) for purchases uses unwrapped ETH
    /// @param swapTarget Contract to fill the 0x quote, as returned by the 0x
    ///        `/swap/v1/quote` API endpoint
    /// @param swapCallData Data encoding the 0x quote, as returned by the 0x
    ///        `/swap/v1/quote` API endpoint
    /// @param deadline Timestamp after which the swap will be reverted.
    function swapByQuote(
        address sellTokenAddress,
        uint256 amountToSell,
        address buyTokenAddress,
        uint256 minimumAmountReceived,
        address allowanceTarget,
        address payable swapTarget,
        bytes calldata swapCallData,
        uint256 deadline
    ) external payable onlyOwner {
        require(block.timestamp <= deadline, '!deadline');

        // Track our balance of the outputCurrency to determine how much we've bought.
        uint256 boughtAmount = IERC20(buyTokenAddress).balanceOf(address(this));

        IERC20(sellTokenAddress).safeIncreaseAllowance(allowanceTarget, amountToSell);

        (bool success,) = swapTarget.call{value: msg.value}(swapCallData);
        require(success, 'SWAP_CALL_FAILED');

        boughtAmount = IERC20(buyTokenAddress).balanceOf(address(this)) - boughtAmount;
        IERC20(buyTokenAddress).safeTransfer(recipient, boughtAmount);

        // return any refunded ETH
        if (address(this).balance > 0) {
            payable(recipient).transfer(address(this).balance);
        }

        emit BoughtTokens(sellTokenAddress, buyTokenAddress, boughtAmount);
    }


    /// @notice Modifier to only allow the contract owner to call a function
    modifier onlyOwner() {
        require(msg.sender == _owner, 'only-owner');
        _;
    }
}
