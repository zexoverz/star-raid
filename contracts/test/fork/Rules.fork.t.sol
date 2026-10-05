// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OrderBookErrors} from "kuru/libraries/Errors.sol";
import {RaidVault, IEntropyV2} from "../../src/RaidVault.sol";
import {RaidRouter} from "../../src/RaidRouter.sol";
import {SeatGate} from "../../src/SeatGate.sol";
import {WallMaker} from "../../src/WallMaker.sol";
import {KuruBook, IKuruOrderBook, IKuruMarginAccount} from "../../src/lib/KuruBook.sol";
import {Terms, AnchorMode, RaidStatus, RaidView, IRaidRouter, IRaidVault} from "../../src/interfaces/IRaid.sol";
import {SpineProbe} from "../utils/SpineProbe.sol";

/// AGENTS.md rules 4 to 8, each pinned by a test on chain 143 against Kuru's live MON/USDC book, the
/// real Lil Stars and the real Pyth Entropy. Each test is checked by deleting its guard: see
/// docs/plan/decisions.md D27 for the mutation runs.
/// Run: forge test --fork-url $MONAD_RPC --match-path "test/fork/Rules*"
contract RulesForkTest is Test {
    IKuruOrderBook constant BOOK = IKuruOrderBook(0x065C9d28E428A0db40191a54d33d5b7c71a9C394);
    IKuruMarginAccount constant MARGIN = IKuruMarginAccount(0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5);
    IEntropyV2 constant ENTROPY = IEntropyV2(0xD458261E832415CFd3BAE5E416FdF3230ce6F134);
    IERC721 constant LIL_STARS = IERC721(0xCaBF3c04B90f4Fe1B521Fcaf4AcB25D5df478e52);
    bytes32 constant TRADE_TOPIC = keccak256("Trade(uint40,address,bool,uint256,uint96,address,address,uint96)");

    RaidVault vault;
    RaidRouter router;
    SeatGate gate;
    address usdc;
    uint32 pp;
    uint96 sp;
    uint32 tick;
    uint96 minSize;
    address sponsor = makeAddr("sponsor");
    address keeper = makeAddr("keeper");
    address holder;
    uint256 id;
    RaidView v;

    function setUp() public {
        if (block.chainid != 143) {
            vm.skip(true);
            return;
        }
        (pp, sp,,, usdc,, tick, minSize,,,) = BOOK.getMarketParams();
        vault = new RaidVault(address(this), MARGIN, ENTROPY, keeper);
        gate = new SeatGate(address(this), LIL_STARS, address(0xBEEF));
        router = new RaidRouter(IRaidVault(address(vault)), gate, MARGIN);
        vault.setRouter(IRaidRouter(address(router)));
        vault.setMarket(address(BOOK), true);
        gate.setRouter(address(router));

        Terms memory t = Terms({
            market: address(BOOK),
            prizeToken: usdc,
            wallSize: minSize * 10,
            bounty: 5e6,
            target: 50e6,
            seatCap: 100e6,
            w0: uint64(block.number + 20),
            w1: uint64(block.number + 220),
            hold: 0,
            capBps: 50,
            anchorMode: AnchorMode.Fixed,
            anchorParam: KuruBook.roundUpToTick(KuruBook.mid(BOOK, pp), tick)
        });
        uint256 wallWei = uint256(t.wallSize) * 1e18 / sp;
        vm.deal(sponsor, wallWei);
        deal(usdc, sponsor, t.bounty);
        vm.startPrank(sponsor);
        IERC20(usdc).approve(address(vault), t.bounty);
        id = vault.post{value: wallWei}(t, new address[](0));
        vm.stopPrank();
        vm.roll(t.w0);
        vm.prank(keeper);
        vault.open(id);
        v = vault.raidView(id);
        require(v.status == RaidStatus.Open, "open");

        holder = LIL_STARS.ownerOf(1);
        deal(usdc, holder, 100_000e6);
        vm.prank(holder);
        IERC20(usdc).approve(address(router), type(uint256).max);
    }

    function _seat() internal view returns (SeatGate.Seat memory s) {
        s.kind = 1;
        s.holder = holder;
        s.tokenId = 1;
    }

    function _raid(uint128 quoteIn) internal {
        vm.prank(holder);
        router.raid(id, quoteIn, _seat());
    }

    /// Buys straight through the wall with an overshoot, so Kuru keeps the wall's old size. Kuru's
    /// own cancel check (OrderBook.sol:604-622) is what says the wall is filled, not ours.
    function _fillWallWithOvershoot() internal {
        _raid(30_000e6);
        uint40[] memory ids = new uint40[](1);
        ids[0] = v.wallId;
        vm.prank(v.maker);
        vm.expectRevert(OrderBookErrors.OrderAlreadyFilledOrCancelled.selector);
        BOOK.batchCancelOrders(ids);
    }

    // ---------------------------------------------------------------- rule 4

    /// Never read an order's size to decide if it is live. After an overshoot the wall keeps its
    /// size, Kuru itself calls it filled, and settle's sweep must treat it as filled.
    function test_rule4_filledWallKeepsSizeAndIsNotLive() public {
        _fillWallWithOvershoot();
        (, uint96 size,,,,,,) = BOOK.s_orders(v.wallId);
        assertEq(size, minSize * 10, "Kuru kept the filled wall's size");

        // reading size would call it live and try a cancel, which Kuru reverts
        vm.prank(address(vault));
        (, uint256 quoteOut) = WallMaker(payable(v.maker)).sweep(sponsor);
        assertGt(quoteOut, 0, "the wall's proceeds came back");
    }

    // ---------------------------------------------------------------- rule 5

    /// Every raid buy is addBuyOrder at the cap, then the remainder is cancelled in the same tx.
    function test_rule5_cappedBuyNeverAboveCapAndRemainderCancelled() public {
        SpineProbe asker = new SpineProbe(BOOK, MARGIN);
        uint32 above = v.capPrice + tick;
        (uint40 head,) = BOOK.s_sellPricePoints(above);
        vm.assume(head == 0);
        vm.deal(address(asker), uint256(minSize) * 1e18 / sp);
        uint40 aboveId = asker.placeAsk(above, minSize, uint256(minSize) * 1e18 / sp);

        uint256 before = IERC20(usdc).balanceOf(holder);
        uint40 c0 = BOOK.s_orderIdCounter();
        vm.recordLogs();
        _raid(30_000e6);
        // the overshoot rested as the router's own bid (the last id created) and was cancelled
        uint40 rest = BOOK.s_orderIdCounter();
        assertGt(rest, c0, "a remainder rested");
        (address restOwner,,,,,,,) = BOOK.s_orders(rest);
        assertTrue(restOwner != address(router), "the router's remainder is still on the book");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(BOOK) || logs[i].topics[0] != TRADE_TOPIC) continue;
            (,,, uint256 price,,,,) =
                abi.decode(logs[i].data, (uint40, address, bool, uint256, uint96, address, address, uint96));
            assertLe(price, uint256(v.capPrice) * 1e18 / pp, "filled above the cap");
        }
        assertEq(KuruBook.remaining(BOOK, aboveId), minSize, "the ask over the cap is untouched");
        assertEq(MARGIN.getBalance(address(router), usdc), 0, "no quote left resting for the router");
        assertGt(IERC20(usdc).balanceOf(holder), before - 30_000e6, "the unspent quote came back");
    }

    /// Never placeAndExecuteMarketBuy: it has no per-level cap. Its selector must not appear in the
    /// router's code.
    function test_rule5_routerNeverCallsMarketBuy() public view {
        bytes4 sel = bytes4(keccak256("placeAndExecuteMarketBuy(uint96,uint256,bool,bool)"));
        bytes memory code = address(router).code;
        for (uint256 i; i + 4 <= code.length; ++i) {
            bool hit = code[i] == sel[0] && code[i + 1] == sel[1] && code[i + 2] == sel[2] && code[i + 3] == sel[3];
            assertFalse(hit, "router code contains placeAndExecuteMarketBuy");
        }
    }

    // ---------------------------------------------------------------- rule 6

    /// Attribution is the margin difference around our own call, checked against Trade logs as an
    /// independent source. Base donated into the router's margin account is left alone.
    function test_rule6_attributionIsMarginDifference() public {
        uint256 donation = 1_000e18;
        vm.deal(address(this), donation);
        MARGIN.deposit{value: donation}(address(router), address(0), donation);

        vm.recordLogs();
        _raid(30_000e6); // overshoots the wall: the size asked for is more than the size filled
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 filled;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(BOOK) || logs[i].topics[0] != TRADE_TOPIC) continue;
            (,,,,, address taker,, uint96 f) =
                abi.decode(logs[i].data, (uint40, address, bool, uint256, uint96, address, address, uint96));
            if (taker == address(router)) filled += f;
        }
        (, uint256 escrow,,) = router.seatOf(id, keccak256(abi.encode(uint8(1), holder)));
        assertEq(escrow, filled * 1e18 / sp, "escrow equals the fills");
        assertEq(MARGIN.getBalance(address(router), address(0)), donation, "the donation stays where it was");
    }

    // ---------------------------------------------------------------- rule 7

    /// batchCancelOrders reverts on a filled order, so settle checks status before cancelling: a
    /// raid whose wall was bought out still settles and recovers its proceeds.
    function test_rule7_settleNeverCancelsAFilledWall() public {
        _fillWallWithOvershoot();
        // the sweep alone first, outside settle's try/catch, so a regression shows Kuru's own error
        vm.prank(address(vault));
        WallMaker(payable(v.maker)).sweep(sponsor);

        vm.roll(v.w1 + 1);
        uint256 fee = ENTROPY.getFeeV2();
        vm.deal(keeper, fee);
        vm.prank(keeper);
        vault.close{value: fee}(id);
        vm.roll(block.number + 201);
        vault.closeWithoutEntropy(id);
        vault.settle(id);
        assertTrue(vault.raid(id).wallRecovered, "the sweep ran without cancelling");
    }

    // ---------------------------------------------------------------- rule 8

    /// The end block comes from Pyth Entropy only: only the Entropy contract can deliver it, and the
    /// result depends on its random number, never on prevrandao.
    function test_rule8_endBlockFromEntropyOnly() public {
        vm.roll(v.w1 + 1);
        uint256 fee = ENTROPY.getFeeV2();
        vm.deal(keeper, fee);
        vm.prank(keeper);
        vault.close{value: fee}(id);
        uint64 seq = vault.raid(id).entropySeq;
        assertGt(seq, 0, "a real Entropy request");

        vm.expectRevert(RaidVault.OnlyEntropy.selector);
        vault._entropyCallback(seq, address(0), bytes32(uint256(7)));

        bytes32 rand = keccak256("pyth");
        uint256 snap = vm.snapshotState();
        vm.prevrandao(bytes32(uint256(1)));
        vm.prank(address(ENTROPY));
        vault._entropyCallback(seq, address(0), rand);
        uint64 e1 = vault.raidView(id).endBlock;
        vm.revertToState(snap);
        vm.prevrandao(bytes32(uint256(2)));
        vm.prank(address(ENTROPY));
        vault._entropyCallback(seq, address(0), rand);
        assertEq(vault.raidView(id).endBlock, e1, "prevrandao changed E");
        assertEq(e1, vault.drawEndBlock(v.w0, v.w1, rand));
    }
}
