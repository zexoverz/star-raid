// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {KuruFixture} from "../utils/KuruFixture.sol";
import {KuruBook, IKuruOrderBook} from "../../src/lib/KuruBook.sol";

contract KuruBookHarness {
    function status(IKuruOrderBook b, uint40 id) external view returns (KuruBook.Status) {
        return KuruBook.status(b, id);
    }

    function remaining(IKuruOrderBook b, uint40 id) external view returns (uint96) {
        return KuruBook.remaining(b, id);
    }

    function emptyAskLevel(IKuruOrderBook b, uint256 p, uint32 t, uint256 n) external view returns (uint256) {
        return KuruBook.emptyAskLevel(b, p, t, n);
    }

    function mid(IKuruOrderBook b, uint32 pp) external view returns (uint256) {
        return KuruBook.mid(b, pp);
    }
}

contract KuruBookTest is KuruFixture {
    KuruBookHarness h;
    address maker = makeAddr("maker");
    address taker = makeAddr("taker");

    function setUp() public {
        _deployKuru();
        h = new KuruBookHarness();
    }

    function test_activeOrder() public {
        uint40 id = _ask(maker, PRICE, 10e10);
        assertEq(uint8(h.status(book, id)), uint8(KuruBook.Status.Active));
        assertEq(h.remaining(book, id), 10e10);
    }

    function test_partialFillStaysActiveWithReducedSize() public {
        uint40 id = _ask(maker, PRICE, 10e10);
        _takeAsks(taker, PRICE, 4e10);
        assertEq(uint8(h.status(book, id)), uint8(KuruBook.Status.Active));
        assertEq(h.remaining(book, id), 6e10);
    }

    function test_cancelledOrderReadsCancelled() public {
        uint40 id = _ask(maker, PRICE, 10e10);
        uint40[] memory ids = new uint40[](1);
        ids[0] = id;
        vm.prank(maker);
        book.batchCancelOrders(ids);
        assertEq(uint8(h.status(book, id)), uint8(KuruBook.Status.Cancelled));
        assertEq(h.remaining(book, id), 0);
    }

    /// Rule 4: a taker bigger than the order fills it and leaves the stored size untouched
    /// (OrderBook.sol:1155-1160). Reading `size` would call this order live.
    function test_filledOrderKeepsSizeButReadsFilled() public {
        uint40 id = _ask(maker, PRICE, 10e10);
        _ask(maker, PRICE + TICK, 10e10);
        _takeAsks(taker, PRICE + TICK, 15e10);
        (, uint96 storedSize,,,,,,) = book.s_orders(id);
        assertEq(storedSize, 10e10, "Kuru keeps the old size on a full fill");
        assertEq(uint8(h.status(book, id)), uint8(KuruBook.Status.Filled));
        assertEq(h.remaining(book, id), 0);
    }

    function test_exactFillReadsFilled() public {
        uint40 id = _ask(maker, PRICE, 10e10);
        _takeAsks(taker, PRICE, 10e10);
        assertEq(uint8(h.status(book, id)), uint8(KuruBook.Status.Filled));
    }

    function test_filledOrderBehindNewerOrderReadsFilled() public {
        uint40 id = _ask(maker, PRICE, 10e10);
        _takeAsks(taker, PRICE, 10e10);
        uint40 later = _ask(maker, PRICE, 10e10); // level head is now `later` > id
        assertEq(uint8(h.status(book, id)), uint8(KuruBook.Status.Filled));
        assertEq(uint8(h.status(book, later)), uint8(KuruBook.Status.Active));
    }

    function test_roundUpToTick() public pure {
        assertEq(KuruBook.roundUpToTick(2_600_000, 100), 2_600_000);
        assertEq(KuruBook.roundUpToTick(2_600_001, 100), 2_600_100);
        assertEq(KuruBook.roundUpToTick(2_600_099, 100), 2_600_100);
    }

    function test_emptyAskLevelSkipsOccupiedLevels() public {
        _ask(maker, PRICE, 10e10);
        _ask(maker, PRICE + TICK, 10e10);
        assertEq(h.emptyAskLevel(book, PRICE, TICK, 5), PRICE + 2 * TICK);
        assertEq(h.emptyAskLevel(book, PRICE + 3 * TICK, TICK, 5), PRICE + 3 * TICK);
    }

    function test_emptyAskLevelGivesUp() public {
        for (uint32 i; i < 3; ++i) {
            _ask(maker, PRICE + i * TICK, 10e10);
        }
        vm.expectRevert(KuruBook.TooManySteps.selector);
        h.emptyAskLevel(book, PRICE, TICK, 2);
    }

    function test_midNeedsBothSides() public {
        assertEq(h.mid(book, PRICE_PRECISION), 0);
        _ask(maker, PRICE + 10 * TICK, 10e10);
        assertEq(h.mid(book, PRICE_PRECISION), 0);
        _bid(taker, PRICE - 10 * TICK, 10e10);
        assertEq(h.mid(book, PRICE_PRECISION), PRICE);
    }

    function test_sizeForNeverOverspends(uint64 quoteIn, uint32 priceSeed) public pure {
        uint256 price = bound(priceSeed, 100, 1e9);
        uint256 size = KuruBook.sizeFor(quoteIn, price, SIZE_PRECISION, PRICE_PRECISION, 6);
        // addBuyOrder charges ceil(price*size/sizePrecision) * 1e6 / pricePrecision (OrderBook.sol:202-204)
        uint256 charged = ((price * size + SIZE_PRECISION - 1) / SIZE_PRECISION) * 1e6 / PRICE_PRECISION;
        assertLe(charged, quoteIn);
    }
}
