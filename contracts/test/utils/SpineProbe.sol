// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KuruBook, IKuruOrderBook, IKuruMarginAccount} from "../../src/lib/KuruBook.sol";

/// Test-only contract doing the raw Kuru moves the vault and router are built from.
/// Native assets are address(0), as in MarginAccount.sol:44.
contract SpineProbe {
    IKuruOrderBook public immutable book;
    IKuruMarginAccount public immutable margin;
    address public immutable base;
    address public immutable quote;

    struct BuyResult {
        uint256 baseOut;
        uint256 quoteSpent;
        uint40 cancelledId;
        uint256 wallFill;
    }

    constructor(IKuruOrderBook book_, IKuruMarginAccount margin_) {
        book = book_;
        margin = margin_;
        (,, base,, quote,,,,,,) = book_.getMarketParams();
    }

    receive() external payable {}

    function _deposit(address token, uint256 amount) internal {
        if (token == address(0)) {
            margin.deposit{value: amount}(address(this), token, amount);
        } else {
            IERC20(token).approve(address(margin), amount);
            margin.deposit(address(this), token, amount);
        }
    }

    function placeAsk(uint32 price, uint96 size, uint256 baseAmount) external returns (uint40 id) {
        _deposit(base, baseAmount);
        book.addSellOrder(price, size, true);
        id = book.s_orderIdCounter();
        (address owner,,,,, uint32 p,, bool isBuy) = book.s_orders(id);
        require(owner == address(this) && p == price && !isBuy, "wall id");
    }

    /// Capped buy: addBuyOrder at the cap, then cancel any remainder of our own order in the same tx.
    function cappedBuy(uint32 cap, uint96 size, uint256 quoteIn, uint40 wallId) external returns (BuyResult memory r) {
        _deposit(quote, quoteIn);
        uint256 b0 = margin.getBalance(address(this), base);
        uint256 q0 = margin.getBalance(address(this), quote);
        uint40 c0 = book.s_orderIdCounter();
        uint96 w0 = wallId == 0 ? 0 : KuruBook.remaining(book, wallId);

        book.addBuyOrder(cap, size, false);

        uint40 c1 = book.s_orderIdCounter();
        if (c1 > c0) {
            (address owner,,,,,,, bool isBuy) = book.s_orders(c1);
            if (owner == address(this) && isBuy && KuruBook.status(book, c1) == KuruBook.Status.Active) {
                uint40[] memory ids = new uint40[](1);
                ids[0] = c1;
                book.batchCancelOrders(ids);
                r.cancelledId = c1;
            }
        }
        r.baseOut = margin.getBalance(address(this), base) - b0;
        r.quoteSpent = q0 - margin.getBalance(address(this), quote);
        if (wallId != 0) r.wallFill = w0 - KuruBook.remaining(book, wallId);
    }

    function cancel(uint40 id) external {
        uint40[] memory ids = new uint40[](1);
        ids[0] = id;
        book.batchCancelOrders(ids);
    }
}
