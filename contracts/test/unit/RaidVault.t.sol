// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {VaultFixture} from "../utils/VaultFixture.sol";
import {StubRouter} from "../utils/Mocks.sol";
import {RaidVault} from "../../src/RaidVault.sol";
import {WallMaker} from "../../src/WallMaker.sol";
import {KuruBook} from "../../src/lib/KuruBook.sol";
import {Terms, AnchorMode, RaidStatus, RaidView} from "../../src/interfaces/IRaid.sol";

contract RaidVaultTest is VaultFixture {
    StubRouter stub;
    address raider = makeAddr("raider");

    function setUp() public {
        stub = new StubRouter();
        _deployVault(stub);
    }

    // ------------------------------------------------------------ post

    function test_postPullsBaseAndBounty() public {
        uint256 id = _post(_terms(uint64(block.number + 20)));
        assertEq(id, 1);
        assertEq(base.balanceOf(address(vault)), WALL_WEI);
        assertEq(usdc.balanceOf(address(vault)), BOUNTY);
        assertEq(uint8(vault.raidView(id).status), uint8(RaidStatus.Posted));
        assertTrue(vault.isExcluded(id, sponsor));
    }

    function test_postRejectsUnlistedMarket() public {
        Terms memory t = _terms(uint64(block.number + 20));
        t.market = address(new StubRouter()); // anything that is not an allowed Kuru book
        vm.expectRevert(RaidVault.MarketNotAllowed.selector);
        vault.post(t, new address[](0));
    }

    function test_postRejectsBadWindow() public {
        Terms memory t = _terms(uint64(block.number + 5)); // too close to now
        vm.expectRevert(RaidVault.BadWindow.selector);
        vault.post(t, new address[](0));
        t = _terms(uint64(block.number + 20));
        t.w1 = t.w0 + 401;
        vm.expectRevert(RaidVault.BadWindow.selector);
        vault.post(t, new address[](0));
    }

    function test_postRejectsBadCapAndSize() public {
        Terms memory t = _terms(uint64(block.number + 20));
        t.capBps = 201;
        vm.expectRevert(RaidVault.BadCapBps.selector);
        vault.post(t, new address[](0));
        t.capBps = 10;
        t.anchorMode = AnchorMode.VaultRate;
        vm.expectRevert(RaidVault.BadCapBps.selector);
        vault.post(t, new address[](0));
        t = _terms(uint64(block.number + 20));
        t.wallSize = MIN_SIZE - 1;
        vm.expectRevert(RaidVault.BadSize.selector);
        vault.post(t, new address[](0));
    }

    /// H4: target must be at least 10x the bounty when both are the quote token.
    function test_postRejectsBountyAboveTenthOfTarget() public {
        Terms memory t = _terms(uint64(block.number + 20));
        t.bounty = TARGET / 10 + 1;
        vm.expectRevert(RaidVault.BountyTooLarge.selector);
        vault.post(t, new address[](0));
    }

    function test_postRecordsAffiliates() public {
        Terms memory t = _terms(uint64(block.number + 20));
        base.mint(sponsor, WALL_WEI);
        usdc.mint(sponsor, BOUNTY);
        address[] memory aff = new address[](1);
        aff[0] = makeAddr("affiliate");
        vm.startPrank(sponsor);
        base.approve(address(vault), WALL_WEI);
        usdc.approve(address(vault), BOUNTY);
        uint256 id = vault.post(t, aff);
        vm.stopPrank();
        assertTrue(vault.isExcluded(id, aff[0]));
        assertFalse(vault.isExcluded(id, raider));
    }

    function test_pauseBlocksPostAndOpenOnly() public {
        Terms memory t = _terms(uint64(block.number + 20));
        uint256 id = _post(t);
        vm.prank(owner);
        vault.setPaused(true);
        vm.expectRevert(RaidVault.IsPaused.selector);
        vault.post(t, new address[](0));
        vm.roll(t.w0);
        vm.prank(keeper);
        vm.expectRevert(RaidVault.IsPaused.selector);
        vault.open(id);
    }

    // ------------------------------------------------------------ open

    function test_openPlacesWallThroughCloneAtEmptyLevel() public {
        uint256 id = _postAndOpen();
        RaidView memory v = vault.raidView(id);
        assertEq(uint8(v.status), uint8(RaidStatus.Open));
        assertEq(v.capPrice, _expectedCap());
        (address owner_, uint96 size,,,, uint32 p,, bool isBuy) = book.s_orders(v.wallId);
        assertEq(owner_, v.maker);
        assertEq(size, WALL);
        assertEq(p, v.capPrice);
        assertFalse(isBuy);
        assertEq(WallMaker(payable(v.maker)).vault(), address(vault));
        assertEq(base.balanceOf(address(vault)), 0);
    }

    function test_openSkipsOccupiedLevels() public {
        _ask(raider, _expectedCap(), MIN_SIZE);
        _ask(raider, _expectedCap() + TICK, MIN_SIZE);
        uint256 id = _postAndOpen();
        assertEq(vault.raidView(id).capPrice, _expectedCap() + 2 * TICK);
    }

    function test_openAbortsWhenNoEmptyLevel() public {
        for (uint32 i; i < 6; ++i) {
            _ask(raider, _expectedCap() + i * TICK, MIN_SIZE);
        }
        uint256 id = _postAndOpen();
        assertEq(uint8(vault.raidView(id).status), uint8(RaidStatus.Aborted));
        assertEq(base.balanceOf(sponsor), WALL_WEI, "base refunded");
        assertEq(usdc.balanceOf(sponsor), BOUNTY, "bounty refunded");
    }

    function test_openUsesMidWhenAboveAnchorWithin20Bps() public {
        // mid 10 bps over the anchor
        uint32 bid = PRICE + 40 * TICK;
        _bid(raider, bid, MIN_SIZE);
        _ask(raider, PRICE + 60 * TICK, MIN_SIZE);
        uint256 id = _postAndOpen();
        uint256 mid = PRICE + 50 * TICK;
        uint256 c = mid * 10_050 / 10_000;
        assertEq(vault.raidView(id).capPrice, KuruBook.roundUpToTick(c, TICK));
    }

    function test_openAbortsWhenMidFarAboveAnchor() public {
        _bid(raider, PRICE * 101 / 100 - (PRICE * 101 / 100) % TICK, MIN_SIZE);
        _ask(raider, PRICE * 102 / 100, MIN_SIZE);
        uint256 id = _postAndOpen();
        assertEq(uint8(vault.raidView(id).status), uint8(RaidStatus.Aborted));
    }

    /// A resting bid at the cap makes the postOnly wall revert; the raid aborts and refunds. The ask
    /// side is empty, so there is no mid and the mid guard does not fire first.
    function test_openAbortsWhenWallWouldMatch() public {
        Terms memory t = _terms(uint64(block.number + 20));
        uint256 id = _post(t);
        _bid(raider, _expectedCap(), MIN_SIZE);
        vm.roll(t.w0);
        vm.expectEmit(address(vault));
        emit RaidVault.Aborted(id, 12);
        vm.prank(keeper);
        vault.open(id);
        assertEq(uint8(vault.raidView(id).status), uint8(RaidStatus.Aborted));
        assertEq(base.balanceOf(sponsor), WALL_WEI);
        assertEq(usdc.balanceOf(sponsor), BOUNTY);
    }

    function test_openAbortsWhenMidFarAboveAnchorReason() public {
        _bid(raider, PRICE * 101 / 100 - (PRICE * 101 / 100) % TICK, MIN_SIZE);
        _ask(raider, PRICE * 102 / 100, MIN_SIZE);
        Terms memory t = _terms(uint64(block.number + 20));
        uint256 id = _post(t);
        vm.roll(t.w0);
        vm.expectEmit(address(vault));
        emit RaidVault.Aborted(id, 10);
        vm.prank(keeper);
        vault.open(id);
    }

    function test_openOnlyKeeperInWindow() public {
        Terms memory t = _terms(uint64(block.number + 20));
        uint256 id = _post(t);
        vm.roll(t.w0);
        vm.expectRevert(RaidVault.NotKeeper.selector);
        vault.open(id);
        vm.roll(t.w0 - 11);
        vm.prank(keeper);
        vm.expectRevert(RaidVault.TooEarly.selector);
        vault.open(id);
        vm.roll(t.w0 + 31);
        vm.prank(keeper);
        vm.expectRevert(RaidVault.TooLate.selector);
        vault.open(id);
    }

    function test_expireRefundsUnopenedRaid() public {
        Terms memory t = _terms(uint64(block.number + 20));
        uint256 id = _post(t);
        vm.expectRevert(RaidVault.TooEarly.selector);
        vault.expire(id);
        vm.roll(t.w0 + 31);
        vault.expire(id);
        assertEq(uint8(vault.raidView(id).status), uint8(RaidStatus.Aborted));
        assertEq(base.balanceOf(sponsor), WALL_WEI);
        assertEq(usdc.balanceOf(sponsor), BOUNTY);
    }

    // ------------------------------------------------------------ close and E

    function test_closeRequestsEntropyOnceAfterW1() public {
        uint256 id = _postAndOpen();
        vm.prank(keeper);
        vm.expectRevert(RaidVault.TooEarly.selector);
        vault.close{value: 1}(id);
        vm.roll(vault.raidView(id).w1 + 1);
        entropy.setFee(5);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(RaidVault.FeeTooLow.selector, 5));
        vault.close{value: 4}(id);
        uint256 before = keeper.balance;
        vm.prank(keeper);
        vault.close{value: 9}(id);
        assertEq(keeper.balance, before - 5, "excess refunded");
        assertEq(uint8(vault.raidView(id).status), uint8(RaidStatus.Closing));
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(RaidVault.BadStatus.selector, RaidStatus.Closing));
        vault.close{value: 5}(id);
    }

    function test_endBlockInLastQuarter(bytes32 rand) public {
        uint256 id = _postAndOpen();
        _closeAndDraw(id, rand);
        RaidView memory v = vault.raidView(id);
        assertEq(uint8(v.status), uint8(RaidStatus.Closed));
        assertGe(v.endBlock, v.w1 - (v.w1 - v.w0) / 4);
        assertLe(v.endBlock, v.w1);
    }

    /// Rule 8: only Entropy sets the end block.
    function test_onlyEntropyCanDrawTheEnd() public {
        uint256 id = _postAndOpen();
        vm.roll(vault.raidView(id).w1 + 1);
        vault.close{value: 1}(id);
        vm.expectRevert(RaidVault.OnlyEntropy.selector);
        vault._entropyCallback(1, address(entropy), bytes32(uint256(7)));
    }

    /// Rule 8: prevrandao and blockhash have no say in E.
    function test_endBlockIgnoresPrevrandao() public {
        bytes32 rand = keccak256("r");
        uint256 snap = vm.snapshotState();
        vm.prevrandao(bytes32(uint256(1)));
        uint256 id = _postAndOpen();
        _closeAndDraw(id, rand);
        uint64 e1 = vault.raidView(id).endBlock;
        vm.revertToState(snap);
        vm.prevrandao(bytes32(uint256(999_999)));
        id = _postAndOpen();
        _closeAndDraw(id, rand);
        assertEq(vault.raidView(id).endBlock, e1);
        assertEq(e1, vault.drawEndBlock(vault.raidView(id).w0, vault.raidView(id).w1, rand));
    }

    function test_entropyTimeoutEndsAtW1AndLateCallbackIgnored() public {
        uint256 id = _postAndOpen();
        vm.roll(vault.raidView(id).w1 + 1);
        vault.close{value: 1}(id);
        vm.expectRevert(RaidVault.TooEarly.selector);
        vault.closeWithoutEntropy(id);
        vm.roll(block.number + 201);
        vault.closeWithoutEntropy(id);
        RaidView memory v = vault.raidView(id);
        assertEq(v.endBlock, v.w1);
        entropy.fulfill(entropy.seq(), bytes32(uint256(3))); // late, must not revert or change E
        assertEq(vault.raidView(id).endBlock, v.w1);
    }

    // ------------------------------------------------------------ settle

    function test_settleLostActiveWallCancelsAndRollsOver() public {
        uint256 id = _postAndOpen();
        _closeAndDraw(id, bytes32(0));
        vault.settle(id);
        RaidView memory v = vault.raidView(id);
        assertEq(uint8(v.status), uint8(RaidStatus.Settled));
        assertFalse(v.won);
        assertEq(uint8(KuruBook.status(book, v.wallId)), uint8(KuruBook.Status.Cancelled));
        assertEq(base.balanceOf(sponsor), WALL_WEI, "unsold base back");
        assertEq(usdc.balanceOf(sponsor), 0, "bounty never returns to the sponsor");
        assertEq(vault.rollover(sponsor, address(usdc)), BOUNTY);
        assertTrue(vault.raid(id).wallRecovered);
    }

    function test_settleWonFundsRouter() public {
        uint256 id = _postAndOpen();
        stub.setCounted(id, TARGET);
        _closeAndDraw(id, bytes32(0));
        vault.settle(id);
        assertTrue(vault.raidView(id).won);
        assertEq(usdc.balanceOf(address(stub)), BOUNTY);
        assertEq(stub.funded(id), BOUNTY);
        assertEq(vault.rollover(sponsor, address(usdc)), 0);
    }

    /// Rule 7: a filled wall is never cancelled; settle and the sweep still succeed.
    function test_settleFilledWallDoesNotCancel() public {
        uint256 id = _postAndOpen();
        RaidView memory v = vault.raidView(id);
        _takeAsks(raider, v.capPrice, WALL + MIN_SIZE); // overshoot: the wall's stored size is kept
        assertEq(uint8(KuruBook.status(book, v.wallId)), uint8(KuruBook.Status.Filled));
        _closeAndDraw(id, bytes32(0));
        vault.settle(id);
        assertTrue(vault.raid(id).wallRecovered, "sweep did not revert");
        assertEq(base.balanceOf(sponsor), 0);
        assertEq(usdc.balanceOf(sponsor), KuruBook.quoteFor(WALL, v.capPrice, SIZE_PRECISION, PRICE_PRECISION, 6));
    }

    function test_settlePartialWall() public {
        uint256 id = _postAndOpen();
        RaidView memory v = vault.raidView(id);
        _takeAsks(raider, v.capPrice, WALL / 4);
        _closeAndDraw(id, bytes32(0));
        vm.recordLogs();
        vault.settle(id);
        assertEq(base.balanceOf(sponsor), WALL_WEI * 3 / 4);
        assertEq(usdc.balanceOf(sponsor), KuruBook.quoteFor(WALL / 4, v.capPrice, SIZE_PRECISION, PRICE_PRECISION, 6));
    }

    /// Kuru's admin can cancel any order (SPEC §2.2). Simulated by cancelling as the maker; on chain
    /// the effect is the same: price 0, base credited to the maker's margin.
    function test_settleAdminCancelledWall() public {
        uint256 id = _postAndOpen();
        RaidView memory v = vault.raidView(id);
        uint40[] memory ids = new uint40[](1);
        ids[0] = v.wallId;
        vm.prank(v.maker);
        book.batchCancelOrders(ids);
        _closeAndDraw(id, bytes32(0));
        vault.settle(id);
        assertTrue(vault.raid(id).wallRecovered);
        assertEq(base.balanceOf(sponsor), WALL_WEI);
    }

    /// H3: a Kuru hard pause blocks cancel; settle still records the outcome and recovery retries.
    function test_settleSurvivesHardPauseThenRecovers() public {
        uint256 id = _postAndOpen();
        _closeAndDraw(id, bytes32(0));
        vm.prank(address(kuruRouter));
        (bool ok,) = address(book).call(abi.encodeWithSignature("toggleMarket(uint8)", uint8(2)));
        assertTrue(ok, "pause");
        vault.settle(id);
        assertEq(uint8(vault.raidView(id).status), uint8(RaidStatus.Settled));
        assertFalse(vault.raid(id).wallRecovered);
        assertEq(vault.rollover(sponsor, address(usdc)), BOUNTY);

        vm.prank(address(kuruRouter));
        (ok,) = address(book).call(abi.encodeWithSignature("toggleMarket(uint8)", uint8(0)));
        vault.recoverWall(id);
        assertEq(base.balanceOf(sponsor), WALL_WEI);
        vm.expectRevert(RaidVault.AlreadyRecovered.selector);
        vault.recoverWall(id);
    }

    function test_settleOnlyAfterEndDrawn() public {
        uint256 id = _postAndOpen();
        vm.expectRevert(abi.encodeWithSelector(RaidVault.BadStatus.selector, RaidStatus.Open));
        vault.settle(id);
    }

    function test_recoverWallSelfOnlyFromVault() public {
        vm.expectRevert(RaidVault.NotSelf.selector);
        vault.recoverWallSelf(1);
    }

    // ------------------------------------------------------------ rollover

    function test_rolloverSpentByNextPostOnly() public {
        uint256 id = _postAndOpen();
        _closeAndDraw(id, bytes32(0));
        vault.settle(id);
        assertEq(vault.rollover(sponsor, address(usdc)), BOUNTY);

        // next raid: the bounty comes entirely from rollover, nothing pulled from the sponsor
        Terms memory t = _terms(uint64(block.number + 20));
        base.mint(sponsor, WALL_WEI);
        vm.startPrank(sponsor);
        base.approve(address(vault), WALL_WEI);
        uint256 id2 = vault.post(t, new address[](0));
        vm.stopPrank();
        assertEq(vault.rollover(sponsor, address(usdc)), 0);
        assertEq(vault.raid(id2).fromRollover, BOUNTY);
    }

    /// H4: an abort hands the rollover part back to the ledger, never to the sponsor.
    function test_abortReturnsRolloverToLedger() public {
        uint256 id = _postAndOpen();
        _closeAndDraw(id, bytes32(0));
        vault.settle(id);

        Terms memory t = _terms(uint64(block.number + 20));
        t.bounty = BOUNTY + 50e6; // 100 from rollover, 50 fresh
        t.target = 1_500e6;
        base.mint(sponsor, WALL_WEI);
        usdc.mint(sponsor, 50e6);
        vm.startPrank(sponsor);
        base.approve(address(vault), WALL_WEI);
        usdc.approve(address(vault), 50e6);
        uint256 id2 = vault.post(t, new address[](0));
        vm.stopPrank();

        vm.roll(t.w0 + 31);
        vault.expire(id2);
        assertEq(vault.rollover(sponsor, address(usdc)), BOUNTY, "rollover back in the ledger");
        assertEq(usdc.balanceOf(sponsor), 50e6, "only the fresh part refunded");
    }
}
