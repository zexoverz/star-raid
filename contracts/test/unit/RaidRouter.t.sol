// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Vm} from "forge-std/Test.sol";
import {SystemFixture} from "../utils/SystemFixture.sol";
import {RaidRouter} from "../../src/RaidRouter.sol";
import {SeatGate} from "../../src/SeatGate.sol";
import {KuruBook} from "../../src/lib/KuruBook.sol";
import {Terms, RaidStatus, RaidView} from "../../src/interfaces/IRaid.sol";

contract RaidRouterTest is SystemFixture {
    bytes32 constant TRADE_TOPIC = keccak256("Trade(uint40,address,bool,uint256,uint96,address,address,uint96)");
    bytes32 constant RAIDED_TOPIC =
        keccak256("Raided(uint256,address,bytes32,uint256,uint256,uint256,uint256,uint256)");

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address asker = makeAddr("asker");
    uint256 id;
    uint32 cap;

    function setUp() public {
        _deploySystem();
        id = _postAndOpen();
        cap = _view(id).capPrice;
    }

    function _wallQuote(uint96 size) internal view returns (uint256) {
        return KuruBook.quoteFor(size, cap, SIZE_PRECISION, PRICE_PRECISION, 6);
    }

    // ------------------------------------------------------------ the capped buy

    /// Rule 5: cheaper asks fill first, the wall next, and an ask one tick over the cap never.
    function test_capNeverExceededWithCheaperAsksPresent() public {
        _ask(asker, cap - 10 * TICK, 1_000e10);
        _ask(asker, cap - 5 * TICK, 1_000e10);
        uint40 above = _ask(asker, cap + TICK, 1_000e10);
        uint256 t = _raider(alice, 10_000e6);

        vm.recordLogs();
        _buy(alice, id, 3_000e6, _starSeat(alice, t)); // more than everything up to the cap
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] != TRADE_TOPIC) continue;
            (,,, uint256 price,,,,) =
                abi.decode(logs[i].data, (uint40, address, bool, uint256, uint96, address, address, uint96));
            assertLe(price, uint256(cap) * 1e18 / PRICE_PRECISION, "filled above the cap");
        }
        assertEq(KuruBook.remaining(book, above), 1_000e10, "ask over the cap untouched");
        assertEq(uint8(KuruBook.status(book, _view(id).wallId)), uint8(KuruBook.Status.Filled));
    }

    /// Rule 5: nothing of ours rests on the book after the tx; the unspent quote is refunded.
    function test_overshootCancelledAndRefunded() public {
        uint256 t = _raider(alice, 10_000e6);
        uint40 before = book.s_orderIdCounter();
        _buy(alice, id, 3_000e6, _starSeat(alice, t));
        uint40 rest = book.s_orderIdCounter();
        assertEq(rest, before + 1, "the remainder rested");
        (address o,,,,,,,) = book.s_orders(rest);
        assertEq(o, address(0), "and was cancelled in the same tx");
        assertEq(margin.getBalance(address(router), address(usdc)), 0);
        assertEq(margin.getBalance(address(router), address(base)), 0);
        uint256 spent = _wallQuote(WALL);
        assertApproxEqAbs(usdc.balanceOf(alice), 10_000e6 - spent, 2, "refund of the unspent quote");
    }

    /// Rule 6: a donation into the router's margin account does not leak into a raider's base.
    function test_attributionIgnoresDonatedMargin() public {
        base.mint(address(this), 5_000e18);
        base.approve(address(margin), 5_000e18);
        margin.deposit(address(router), address(base), 5_000e18);

        uint256 t = _raider(alice, 1_000e6);
        vm.recordLogs();
        _buy(alice, id, 50e6, _starSeat(alice, t));
        (, uint256 escrow,,) = router.seatOf(id, _key(alice));
        uint256 filled = _sumFills(vm.getRecordedLogs(), address(router));
        assertEq(escrow, filled * 1e8, "base equals the fills, not the donation");
        assertEq(margin.getBalance(address(router), address(base)), 5_000e18, "donation left alone");
    }

    function _sumFills(Vm.Log[] memory logs, address taker) internal pure returns (uint256 filled) {
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] != TRADE_TOPIC) continue;
            (,,,,, address tk,, uint96 f) =
                abi.decode(logs[i].data, (uint40, address, bool, uint256, uint96, address, address, uint96));
            if (tk == taker) filled += f;
        }
    }

    /// Rule 9: a USDC-quoted raid never takes native MON from the raider.
    function test_rejectsNativeOnErc20Quote() public {
        uint256 t = _raider(alice, 1_000e6);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(RaidRouter.NativeNotAccepted.selector);
        router.raid{value: 1}(id, 50e6, _starSeat(alice, t));
    }

    function test_rejectsDustSize() public {
        uint256 t = _raider(alice, 1_000e6);
        vm.prank(alice);
        vm.expectRevert(RaidRouter.SizeTooSmall.selector);
        router.raid(id, 1, _starSeat(alice, t));
    }

    function test_windowAndStatus() public {
        uint256 t = _raider(alice, 1_000e6);
        vm.roll(_view(id).w1 + 1);
        vm.prank(alice);
        vm.expectRevert(RaidRouter.OutsideWindow.selector);
        router.raid(id, 50e6, _starSeat(alice, t));
        vm.prank(alice);
        vm.expectRevert(RaidRouter.NotOpen.selector);
        router.raid(id + 1, 50e6, _starSeat(alice, t));
    }

    // ------------------------------------------------------------ counting (C1, wall fill only)

    function test_wallFillCountedAtCap() public {
        uint256 t = _raider(alice, 1_000e6);
        _buy(alice, id, 50e6, _starSeat(alice, t));
        (, uint256 escrow, uint256 cum,) = router.seatOf(id, _key(alice));
        assertGt(escrow, 0);
        assertApproxEqAbs(cum, 50e6, 1);
        assertEq(router.countedTotalAt(id, uint64(block.number)), cum);
    }

    /// C1 self-wash: the raider's own cheaper ask fills first and counts for nothing.
    function test_selfWashCountsZero() public {
        uint256 t = _raider(alice, 1_000e6);
        _ask(alice, cap - TICK, 1_000e10);
        uint256 cost = _wallQuote(1_000e10);
        _buy(alice, id, uint128(cost), _starSeat(alice, t));
        (, uint256 escrow, uint256 cum,) = router.seatOf(id, _key(alice));
        assertEq(escrow, 1_000e18);
        assertEq(cum, 0, "own ask under the wall earns nothing");
    }

    function test_nonSeatBuyGoesThroughUncounted() public {
        usdc.mint(carol, 1_000e6);
        vm.prank(carol);
        usdc.approve(address(router), type(uint256).max);
        _buy(carol, id, 50e6, _noSeat());
        assertGt(base.balanceOf(carol), 0, "non-seat gets base at once");
        assertEq(router.nonSeatBuys(id), 1);
        assertEq(router.countedTotalAt(id, uint64(block.number)), 0);
    }

    function test_seatCapAppliesAcrossBuys() public {
        uint256 t = _raider(alice, 1_000e6);
        _buy(alice, id, 150e6, _starSeat(alice, t));
        vm.roll(block.number + 1);
        _buy(alice, id, 150e6, _starSeat(alice, t));
        assertEq(router.countedTotalAt(id, uint64(block.number)), SEAT_CAP);
    }

    /// Only buys at or before E count; buys after still receive their base.
    function test_onlyBuysUpToEndBlockCount() public {
        RaidView memory v = _view(id);
        uint256 ta = _raider(alice, 1_000e6);
        uint256 tb = _raider(bob, 1_000e6);
        bytes32 rand = bytes32(0); // E = w1 - quarter
        uint64 e = vault.drawEndBlock(v.w0, v.w1, rand);
        vm.roll(e);
        _buy(alice, id, 100e6, _starSeat(alice, ta));
        vm.roll(e + 1);
        _buy(bob, id, 100e6, _starSeat(bob, tb));
        _closeAndDraw(id, rand);
        assertEq(_view(id).endBlock, e);
        assertApproxEqAbs(router.countedOf(id, _key(alice)), 100e6, 1);
        assertEq(router.countedOf(id, _key(bob)), 0);
        assertApproxEqAbs(router.countedTotalAt(id, e), 100e6, 1);
        (, uint256 bobEscrow,,) = router.seatOf(id, _key(bob));
        assertGt(bobEscrow, 0);
    }

    // ------------------------------------------------------------ seats

    function test_notStarOwner() public {
        uint256 t = _raider(alice, 1_000e6);
        usdc.mint(bob, 100e6);
        vm.prank(bob);
        usdc.approve(address(router), type(uint256).max);
        vm.prank(bob);
        vm.expectRevert(SeatGate.NotStarOwner.selector);
        router.raid(id, 50e6, _starSeat(bob, t));
    }

    /// One Star cannot be passed around for a second seat in the same raid.
    function test_tokenNullifiedToFirstHolder() public {
        uint256 t = _raider(alice, 1_000e6);
        _buy(alice, id, 50e6, _starSeat(alice, t));
        vm.prank(alice);
        stars.transferFrom(alice, bob, t);
        usdc.mint(bob, 100e6);
        vm.prank(bob);
        usdc.approve(address(router), type(uint256).max);
        vm.prank(bob);
        vm.expectRevert(SeatGate.TokenUsed.selector);
        router.raid(id, 50e6, _starSeat(bob, t));
    }

    /// C2: one seat per holder wallet, however many Stars it holds.
    function test_oneSeatPerHolder() public {
        uint256 hk = 0xB0B;
        address holder = vm.addr(hk);
        stars.mint(holder);
        uint256 t2 = stars.mint(holder);
        uint256 t1 = t2 - 1;
        usdc.mint(holder, 1_000e6);
        vm.prank(holder);
        usdc.approve(address(router), type(uint256).max);
        _buy(holder, id, 50e6, _starSeat(holder, t1));

        usdc.mint(carol, 1_000e6);
        vm.prank(carol);
        usdc.approve(address(router), type(uint256).max);
        SeatGate.Seat memory s = _bindSeat(hk, carol, t2, uint64(block.timestamp + 1 days));
        vm.prank(carol);
        vm.expectRevert(SeatGate.SeatTaken.selector);
        router.raid(id, 50e6, s);
    }

    /// H7: a Mera account raids for a holder through a Bind signature.
    function test_bindLetsAnotherWalletRaid() public {
        uint256 hk = 0xB0B;
        uint256 t = stars.mint(vm.addr(hk));
        usdc.mint(carol, 1_000e6);
        vm.prank(carol);
        usdc.approve(address(router), type(uint256).max);
        _buy(carol, id, 50e6, _bindSeat(hk, carol, t, uint64(block.timestamp + 1 days)));
        (address p,,,) = router.seatOf(id, _key(vm.addr(hk)));
        assertEq(p, carol);
    }

    function test_bindExpiredOrForged() public {
        uint256 hk = 0xB0B;
        uint256 t = stars.mint(vm.addr(hk));
        usdc.mint(carol, 1_000e6);
        vm.prank(carol);
        usdc.approve(address(router), type(uint256).max);
        SeatGate.Seat memory s = _bindSeat(hk, carol, t, uint64(block.timestamp - 1));
        vm.prank(carol);
        vm.expectRevert(SeatGate.Expired.selector);
        router.raid(id, 50e6, s);
        s = _bindSeat(0xBAD, carol, t, uint64(block.timestamp + 1 days));
        s.holder = vm.addr(hk); // signed by someone else
        vm.prank(carol);
        vm.expectRevert(SeatGate.BadBind.selector);
        router.raid(id, 50e6, s);
    }

    function test_playerCannotHoldTwoSeats() public {
        uint256 ta = _raider(alice, 1_000e6);
        _buy(alice, id, 50e6, _starSeat(alice, ta));
        uint256 hk = 0xB0B;
        uint256 t = stars.mint(vm.addr(hk));
        SeatGate.Seat memory s = _bindSeat(hk, alice, t, uint64(block.timestamp + 1 days));
        vm.prank(alice);
        vm.expectRevert(SeatGate.PlayerHasSeat.selector);
        router.raid(id, 50e6, s);
    }

    function test_humanSeat() public {
        usdc.mint(carol, 1_000e6);
        vm.prank(carol);
        usdc.approve(address(router), type(uint256).max);
        _buy(carol, id, 50e6, _humanSeat(id, carol, keccak256("passport"), uint64(block.timestamp + 1 hours), verifierKey));
        assertGt(router.countedTotalAt(id, uint64(block.number)), 0);
    }

    function test_humanSeatForgedOrHeldByStarHolder() public {
        usdc.mint(carol, 1_000e6);
        vm.prank(carol);
        usdc.approve(address(router), type(uint256).max);
        SeatGate.Seat memory s = _humanSeat(id, carol, keccak256("p"), uint64(block.timestamp + 1 hours), 0xBAD);
        vm.prank(carol);
        vm.expectRevert(SeatGate.BadHuman.selector);
        router.raid(id, 50e6, s);

        _raider(alice, 1_000e6);
        s = _humanSeat(id, alice, keccak256("p2"), uint64(block.timestamp + 1 hours), verifierKey);
        vm.prank(alice);
        vm.expectRevert(SeatGate.HolderNeedsStarSeat.selector);
        router.raid(id, 50e6, s);
    }

    function test_sponsorAndAffiliateRejected() public {
        uint256 ts = _raider(sponsor, 1_000e6);
        vm.prank(sponsor);
        vm.expectRevert(RaidRouter.Excluded.selector);
        router.raid(id, 50e6, _starSeat(sponsor, ts));

        // a holder bound to a fresh wallet is still the sponsor
        vm.prank(sponsor);
        vm.expectRevert(RaidRouter.Excluded.selector);
        router.raid(id, 50e6, _noSeat());
    }

    function test_onlyRouterUsesGate() public {
        vm.expectRevert(SeatGate.OnlyRouter.selector);
        gate.use(id, _noSeat(), alice);
    }

    // ------------------------------------------------------------ claims

    function _winWith(address a, address b) internal {
        uint256 ta = _raider(a, 1_000e6);
        uint256 tb = _raider(b, 1_000e6);
        _buy(a, id, uint128(SEAT_CAP + 5e6), _starSeat(a, ta));
        _buy(b, id, uint128(SEAT_CAP + 5e6), _starSeat(b, tb));
        for (uint256 i; i < 3; ++i) {
            address x = makeAddr(string(abi.encode(i)));
            uint256 tx_ = _raider(x, 1_000e6);
            _buy(x, id, uint128(SEAT_CAP + 5e6), _starSeat(x, tx_));
        }
        _closeAndDraw(id, bytes32(uint256(1)));
        vault.settle(id);
        assertTrue(_view(id).won);
    }

    function test_claimAfterHoldPaysBaseAndShare() public {
        _winWith(alice, bob);
        vm.prank(alice);
        vm.expectRevert(RaidRouter.HoldNotOver.selector);
        router.claim(id);
        vm.warp(block.timestamp + 1 hours);
        (, uint256 escrow,,) = router.seatOf(id, _key(alice));
        vm.prank(alice);
        router.claim(id);
        assertEq(base.balanceOf(alice), escrow);
        assertApproxEqAbs(usdc.balanceOf(alice), 1_000e6 - SEAT_CAP - 5e6 + BOUNTY / 5, 2);
        vm.prank(alice);
        vm.expectRevert(RaidRouter.AlreadyDone.selector);
        router.claim(id);
    }

    function test_exitEarlyForfeitsToRollover() public {
        _winWith(alice, bob);
        vm.prank(bob);
        router.exitEarly(id);
        assertGt(base.balanceOf(bob), 0);
        assertApproxEqAbs(vault.rollover(sponsor, address(usdc)), BOUNTY / 5, 1);
    }

    function test_lostRaidClaimsBaseAtOnce() public {
        uint256 ta = _raider(alice, 1_000e6);
        _buy(alice, id, 50e6, _starSeat(alice, ta));
        _closeAndDraw(id, bytes32(0));
        vault.settle(id);
        assertFalse(_view(id).won);
        vm.prank(alice);
        router.claim(id);
        assertGt(base.balanceOf(alice), 0);
        assertEq(vault.rollover(sponsor, address(usdc)), BOUNTY);
    }

    function test_claimNeedsSettleAndSeat() public {
        vm.prank(alice);
        vm.expectRevert(RaidRouter.NotSettled.selector);
        router.claim(id);
        _closeAndDraw(id, bytes32(0));
        vault.settle(id);
        vm.prank(carol);
        vm.expectRevert(RaidRouter.NoSeat.selector);
        router.claim(id);
    }
}
