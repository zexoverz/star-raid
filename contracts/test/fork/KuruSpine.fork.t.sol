// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test, Vm} from "forge-std/Test.sol";
import {KuruBook, IKuruOrderBook, IKuruMarginAccount} from "../../src/lib/KuruBook.sol";
import {SpineProbe} from "../utils/SpineProbe.sol";

/// Fork tests against Kuru's live MON/USDC market on chain 143.
/// Run: forge test --fork-url $MONAD_RPC --match-path "test/fork/*"
contract KuruSpineForkTest is Test {
    IKuruOrderBook constant BOOK = IKuruOrderBook(0x065C9d28E428A0db40191a54d33d5b7c71a9C394);
    IKuruMarginAccount constant MARGIN = IKuruMarginAccount(0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5);
    bytes32 constant TRADE_TOPIC =
        keccak256("Trade(uint40,address,bool,uint256,uint96,address,address,uint96)");

    SpineProbe probe;
    uint32 pricePrecision;
    uint96 sizePrecision;
    address usdc;
    uint32 tick;
    uint96 minSize;

    function setUp() public {
        if (block.chainid != 143) {
            vm.skip(true);
            return;
        }
        (pricePrecision, sizePrecision,,, usdc,, tick, minSize,,,) = BOOK.getMarketParams();
        probe = new SpineProbe(BOOK, MARGIN);
    }

    /// Wall price: mid + 50 bps, rounded up to tick, moved up to an empty level.
    function _wallPrice() internal view returns (uint32) {
        uint256 mid = KuruBook.mid(BOOK, pricePrecision);
        require(mid != 0, "no mid");
        uint256 p = KuruBook.roundUpToTick(mid * 10_050 / 10_000, tick);
        return uint32(_emptyLevel(p));
    }

    function _emptyLevel(uint256 p) internal view returns (uint256) {
        for (uint256 i; i < 50; ++i) {
            (uint40 head,) = BOOK.s_sellPricePoints(p);
            if (head == 0) return p;
            p += tick;
        }
        revert("no empty level");
    }

    function _placeWall(uint32 price, uint96 size) internal returns (uint40 id) {
        uint256 baseWei = uint256(size) * 1e18 / sizePrecision;
        vm.deal(address(probe), baseWei);
        id = probe.placeAsk(price, size, baseWei);
    }

    function _quoteFor(uint32 price, uint96 size) internal view returns (uint256) {
        return KuruBook.quoteFor(size, price, sizePrecision, pricePrecision, 6) + 1e6;
    }

    function test_fork_contractPlacesNativeWallAndReadsId() public {
        uint32 price = _wallPrice();
        uint40 before = BOOK.s_orderIdCounter();
        uint40 id = _placeWall(price, minSize * 5);
        assertEq(id, before + 1);
        (address owner, uint96 size,,,, uint32 p,, bool isBuy) = BOOK.s_orders(id);
        assertEq(owner, address(probe));
        assertEq(size, minSize * 5);
        assertEq(p, price);
        assertFalse(isBuy);
        assertEq(uint8(KuruBook.status(BOOK, id)), uint8(KuruBook.Status.Active));
    }

    /// Rule 4 on the live book: partial, filled (size kept) and cancelled, all read from the head.
    function test_fork_statusPartialFilledCancelled() public {
        uint32 cap = _wallPrice();
        uint40 partialWall = _placeWall(cap, minSize * 5);
        uint256 quoteIn = _quoteFor(cap, minSize * 1000);
        deal(usdc, address(probe), quoteIn * 3);

        // buy everything under the cap plus part of the wall
        SpineProbe taker = new SpineProbe(BOOK, MARGIN);
        deal(usdc, address(taker), quoteIn);
        uint96 under = _sizeUnder(cap);
        taker.cappedBuy(cap, under + minSize * 2, quoteIn, partialWall);
        assertEq(uint8(KuruBook.status(BOOK, partialWall)), uint8(KuruBook.Status.Active));
        assertEq(KuruBook.remaining(BOOK, partialWall), minSize * 3);

        // a bigger buy fills the rest; the stored size stays at 3x minSize
        uint40 next = _placeWall(cap, minSize * 5);
        deal(usdc, address(taker), _quoteFor(cap, minSize * 4));
        taker.cappedBuy(cap, minSize * 4, _quoteFor(cap, minSize * 4), next);
        (, uint96 stored,,,,,,) = BOOK.s_orders(partialWall);
        assertEq(stored, minSize * 3, "full fill keeps the old size");
        assertEq(uint8(KuruBook.status(BOOK, partialWall)), uint8(KuruBook.Status.Filled));

        probe.cancel(next);
        assertEq(uint8(KuruBook.status(BOOK, next)), uint8(KuruBook.Status.Cancelled));
    }

    function _sizeUnder(uint32 cap) internal view returns (uint96 total) {
        for (uint256 p = cap - tick; p > cap - 400 * tick; p -= tick) {
            (uint40 id,) = BOOK.s_sellPricePoints(p);
            while (id != 0) {
                (, uint96 size,, uint40 nxt,,,,) = BOOK.s_orders(id);
                total += size;
                id = nxt;
            }
        }
    }

    /// Rule 5: the capped buy pays at most the cap on every level, with cheaper asks present,
    /// and never touches an ask one tick above the cap.
    function test_fork_cappedBuyNeverFillsAboveCap() public {
        uint32 cap = _wallPrice();
        uint40 wall = _placeWall(cap, minSize * 5);
        uint40 above = _placeWall(uint32(_emptyLevel(cap + tick)), minSize * 5);

        uint96 size = minSize * 1000; // far more than the asks under the cap
        uint256 quoteIn = _quoteFor(cap, size);
        deal(usdc, address(probe), quoteIn);

        vm.recordLogs();
        SpineProbe.BuyResult memory r = probe.cappedBuy(cap, size, quoteIn, wall);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        uint256 maxPrice;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(BOOK) || logs[i].topics[0] != TRADE_TOPIC) continue;
            (,,, uint256 price,,,,) =
                abi.decode(logs[i].data, (uint40, address, bool, uint256, uint96, address, address, uint96));
            if (price > maxPrice) maxPrice = price;
        }
        assertLe(maxPrice, uint256(cap) * 1e18 / pricePrecision, "a fill above the cap");
        assertEq(uint8(KuruBook.status(BOOK, wall)), uint8(KuruBook.Status.Filled), "wall reached");
        assertEq(KuruBook.remaining(BOOK, above), minSize * 5, "ask above cap untouched");
        assertGt(r.baseOut, 0);
    }

    /// Rule 5 second half: the overshoot rests as our own bid and is cancelled in the same tx.
    function test_fork_overshootRemainderCancelledSameTx() public {
        uint32 cap = _wallPrice();
        uint40 wall = _placeWall(cap, minSize * 5);
        uint96 size = minSize * 1000;
        uint256 quoteIn = _quoteFor(cap, size);
        deal(usdc, address(probe), quoteIn);

        SpineProbe.BuyResult memory r = probe.cappedBuy(cap, size, quoteIn, wall);

        assertGt(r.cancelledId, 0, "remainder rested");
        assertEq(uint8(KuruBook.status(BOOK, r.cancelledId)), uint8(KuruBook.Status.Cancelled));
        // the cancel refunded the unspent quote into margin
        assertEq(MARGIN.getBalance(address(probe), usdc), quoteIn - r.quoteSpent);
    }

    /// Rule 6: base received by margin difference equals the sum of fills, checked here against
    /// Trade logs as an independent source (the contract itself never reads logs).
    function test_fork_marginDifferenceEqualsBaseReceived() public {
        uint32 cap = _wallPrice();
        uint40 wall = _placeWall(cap, minSize * 5);
        uint96 size = minSize * 1000;
        uint256 quoteIn = _quoteFor(cap, size);
        deal(usdc, address(probe), quoteIn);

        vm.recordLogs();
        SpineProbe.BuyResult memory r = probe.cappedBuy(cap, size, quoteIn, wall);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        uint256 filled;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(BOOK) || logs[i].topics[0] != TRADE_TOPIC) continue;
            (,,,,, address taker,, uint96 filledSize) =
                abi.decode(logs[i].data, (uint40, address, bool, uint256, uint96, address, address, uint96));
            if (taker == address(probe)) filled += filledSize;
        }
        assertEq(r.baseOut, filled * 1e18 / sizePrecision);
        assertEq(r.wallFill, minSize * 5, "wall fill from remaining size before and after");
    }

    /// R E1: an ask the raider owns under the wall fills first and adds nothing to the wall fill.
    function test_fork_selfWashEarnsZeroWallFill() public {
        uint32 cap = _wallPrice();
        uint40 wall = _placeWall(cap, minSize * 5);
        // a raider's own ask one tick under the wall, at an empty level
        uint32 own = cap - tick;
        (uint40 head,) = BOOK.s_sellPricePoints(own);
        vm.assume(head == 0);
        SpineProbe raider = new SpineProbe(BOOK, MARGIN);
        vm.deal(address(raider), uint256(minSize) * 1e8);
        raider.placeAsk(own, minSize, uint256(minSize) * 1e8);

        // buy only up to one tick under the wall: everything comes from cheaper asks
        uint256 quoteIn = _quoteFor(own, minSize);
        deal(usdc, address(raider), quoteIn);
        SpineProbe.BuyResult memory r = raider.cappedBuy(cap, minSize, quoteIn, wall);
        assertGt(r.baseOut, 0);
        assertEq(r.wallFill, 0);
    }
}
