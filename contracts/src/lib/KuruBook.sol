// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

// Kuru facts in this file are read from Kuru-Labs/Kuru-contracts-dex-public@2060bb27,
// contracts/OrderBook.sol and contracts/MarginAccount.sol. Line numbers cite that commit.

/// Subset of Kuru's OrderBook used by Star Raid.
interface IKuruOrderBook {
    // OrderBook.sol:40, public getter of `mapping(uint40 => Order)`.
    function s_orders(uint40 id)
        external
        view
        returns (
            address ownerAddress,
            uint96 size,
            uint40 prev,
            uint40 next,
            uint40 flippedId,
            uint32 price,
            uint32 flippedPrice,
            bool isBuy
        );

    // OrderBook.sol:41-42, PricePoint{head, tail}.
    function s_buyPricePoints(uint256 price) external view returns (uint40 head, uint40 tail);
    function s_sellPricePoints(uint256 price) external view returns (uint40 head, uint40 tail);

    // OrderBook.sol:46-47.
    function s_orderIdCounter() external view returns (uint40);
    function marketState() external view returns (uint8);

    // OrderBook.sol:183. Fills asks up to `_price` (vault levels included, :871), rests the remainder.
    function addBuyOrder(uint32 _price, uint96 size, bool _postOnly) external;

    // OrderBook.sol:254. postOnly reverts PostOnlyError on any match.
    function addSellOrder(uint32 _price, uint96 _size, bool _postOnly) external;

    // OrderBook.sol:480. Reverts on a filled or cancelled order (:534-535).
    function batchCancelOrders(uint40[] calldata _orderIds) external;

    // OrderBook.sol:1334.
    function getMarketParams()
        external
        view
        returns (
            uint32 pricePrecision,
            uint96 sizePrecision,
            address baseAsset,
            uint256 baseAssetDecimals,
            address quoteAsset,
            uint256 quoteAssetDecimals,
            uint32 tickSize,
            uint96 minSize,
            uint96 maxSize,
            uint256 takerFeeBps,
            uint256 makerFeeBps
        );

    // OrderBook.sol:1357. Both values in 1e18 precision (AbstractAMM.sol:31); bid 0 / ask 0 when empty.
    function bestBidAsk() external view returns (uint256 bid, uint256 ask);
}

/// Subset of Kuru's MarginAccount. Native MON is token address(0) (MarginAccount.sol:44).
interface IKuruMarginAccount {
    function deposit(address _user, address _token, uint256 _amount) external payable;
    function withdraw(uint256 _amount, address _token) external;
    function getBalance(address _user, address _token) external view returns (uint256);
}

/// Order status and price helpers that never read an order's size to decide liveness.
library KuruBook {
    enum Status {
        Active,
        Filled,
        Cancelled
    }

    uint256 internal constant VAULT_PRICE_PRECISION = 1e18;

    error TooManySteps();

    /// Status from the price level head, mirroring OrderBook.sol:604-622.
    /// A cancelled order is deleted, so its price reads 0. A fully filled order may keep its old
    /// size (:1155-1160), so the only reliable signal is the level head moving past the id.
    function status(IKuruOrderBook book, uint40 id) internal view returns (Status) {
        (,,,,, uint32 price,, bool isBuy) = book.s_orders(id);
        if (price == 0) return Status.Cancelled;
        (uint40 head,) = isBuy ? book.s_buyPricePoints(price) : book.s_sellPricePoints(price);
        if (head > id || head == 0) return Status.Filled;
        return Status.Active;
    }

    /// Size still resting on an order: its size only while the head says it is active.
    function remaining(IKuruOrderBook book, uint40 id) internal view returns (uint96) {
        if (status(book, id) != Status.Active) return 0;
        (, uint96 size,,,,,,) = book.s_orders(id);
        return size;
    }

    /// Rule 7: batchCancelOrders reverts on a filled or cancelled order (OrderBook.sol:534-535), so
    /// every cancel in Star Raid goes through this one check. Returns whether it cancelled.
    function cancelIfActive(IKuruOrderBook book, uint40 id) internal returns (bool) {
        if (status(book, id) != Status.Active) return false;
        uint40[] memory ids = new uint40[](1);
        ids[0] = id;
        book.batchCancelOrders(ids);
        return true;
    }

    function roundUpToTick(uint256 price, uint32 tick) internal pure returns (uint256) {
        uint256 r = price % tick;
        return r == 0 ? price : price + (tick - r);
    }

    /// First ask level at or above `price` with no resting order, so the wall is first in FIFO.
    function emptyAskLevel(IKuruOrderBook book, uint256 price, uint32 tick, uint256 maxSteps)
        internal
        view
        returns (uint256)
    {
        for (uint256 i; i <= maxSteps; ++i) {
            (uint40 head,) = book.s_sellPricePoints(price);
            if (head == 0) return price;
            price += tick;
        }
        revert TooManySteps();
    }

    /// Quote token amount for `size` at `price`, rounded down, as Kuru credits a maker (:1295).
    function quoteFor(uint256 size, uint256 price, uint96 sizePrecision, uint32 pricePrecision, uint256 quoteDecimals)
        internal
        pure
        returns (uint256)
    {
        return ((price * size) / sizePrecision) * (10 ** quoteDecimals) / pricePrecision;
    }

    /// Largest size whose cost at `price`, rounded up the way addBuyOrder charges it (:1242), fits in
    /// `quoteIn` token units.
    function sizeFor(uint256 quoteIn, uint256 price, uint96 sizePrecision, uint32 pricePrecision, uint256 quoteDecimals)
        internal
        pure
        returns (uint256)
    {
        uint256 q = quoteIn * pricePrecision / (10 ** quoteDecimals);
        return q * sizePrecision / price;
    }

    /// Mid in Kuru price units, or 0 if either side of the book is empty. An empty bid side reads
    /// type(uint256).max and an empty ask side reads 0 (:1380-1416).
    function mid(IKuruOrderBook book, uint32 pricePrecision) internal view returns (uint256) {
        (uint256 bid, uint256 ask) = book.bestBidAsk();
        if (bid == 0 || bid == type(uint256).max || ask == 0) return 0;
        return (bid + ask) * pricePrecision / (2 * VAULT_PRICE_PRECISION);
    }
}
