// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {RaidVault, IEntropyV2} from "../../src/RaidVault.sol";
import {RaidRouter} from "../../src/RaidRouter.sol";
import {SeatGate} from "../../src/SeatGate.sol";
import {KuruBook, IKuruOrderBook, IKuruMarginAccount} from "../../src/lib/KuruBook.sol";
import {BookDepth} from "../utils/BookDepth.sol";
import {Terms, AnchorMode, RaidStatus, RaidView, IRaidRouter, IRaidVault} from "../../src/interfaces/IRaid.sol";

/// A whole raid on chain 143 against Kuru's live MON/USDC book, real Lil Stars and real Pyth Entropy.
/// Native MON is the base here, so this also covers the native wall and native escrow paths.
contract RaidFlowForkTest is Test {
    IKuruOrderBook constant BOOK = IKuruOrderBook(0x065C9d28E428A0db40191a54d33d5b7c71a9C394);
    IKuruMarginAccount constant MARGIN = IKuruMarginAccount(0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5);
    IEntropyV2 constant ENTROPY = IEntropyV2(0xD458261E832415CFd3BAE5E416FdF3230ce6F134);
    IERC721 constant LIL_STARS = IERC721(0xCaBF3c04B90f4Fe1B521Fcaf4AcB25D5df478e52);

    RaidVault vault;
    RaidRouter router;
    SeatGate gate;
    address usdc;
    address sponsor = makeAddr("sponsor");
    address keeper = makeAddr("keeper");

    function setUp() public {
        if (block.chainid != 143) {
            vm.skip(true);
            return;
        }
        (,,,, usdc,,,,,,) = BOOK.getMarketParams();
        vault = new RaidVault(address(this), MARGIN, ENTROPY, keeper);
        gate = new SeatGate(address(this), LIL_STARS, address(0xBEEF));
        router = new RaidRouter(IRaidVault(address(vault)), gate, MARGIN);
        vault.setRouter(IRaidRouter(address(router)));
        vault.setMarket(address(BOOK), true);
        gate.setRouter(address(router));
    }

    function test_fork_fullRaidOnLiveBook() public {
        (uint32 pp, uint96 sp,,,,, uint32 tick, uint96 minSize,,,) = BOOK.getMarketParams();
        uint256 mid = KuruBook.mid(BOOK, pp);
        Terms memory t = Terms({
            market: address(BOOK),
            prizeToken: usdc,
            wallSize: minSize * 10, // 2,000 MON
            bounty: 5e6,
            target: 50e6,
            seatCap: 100e6,
            w0: uint64(block.number + 20),
            w1: uint64(block.number + 220),
            hold: 1 hours,
            capBps: 50,
            anchorMode: AnchorMode.Fixed,
            anchorParam: KuruBook.roundUpToTick(mid, tick)
        });
        uint256 wallWei = uint256(t.wallSize) * 1e18 / sp;
        vm.deal(sponsor, wallWei);
        deal(usdc, sponsor, t.bounty);
        vm.startPrank(sponsor);
        IERC20(usdc).approve(address(vault), t.bounty);
        uint256 id = vault.post{value: wallWei}(t, new address[](0));
        vm.stopPrank();

        vm.roll(t.w0);
        vm.prank(keeper);
        vault.open(id);
        RaidView memory v = vault.raidView(id);
        assertEq(uint8(v.status), uint8(RaidStatus.Open), "opened on the live book");

        // a real Lil Stars holder raids with USDC; cheaper live asks fill first
        address holder = LIL_STARS.ownerOf(1);
        // through every live ask under the wall and the wall itself, sized from the book at this block
        uint128 through = uint128(
            KuruBook.quoteFor(BookDepth.sizeUnder(BOOK, v.capPrice, tick, 2000) + 2 * uint256(t.wallSize), v.capPrice, sp, pp, 6)
        );
        deal(usdc, holder, uint256(through) + 10_000e6);
        vm.prank(holder);
        IERC20(usdc).approve(address(router), type(uint256).max);
        SeatGate.Seat memory s;
        s.kind = 1;
        s.holder = holder;
        s.tokenId = 1;
        uint256 monBefore = holder.balance;
        vm.prank(holder);
        router.raid(id, through, s);
        assertEq(holder.balance, monBefore, "seat base is escrowed, not sent");
        assertEq(uint8(KuruBook.status(BOOK, v.wallId)), uint8(KuruBook.Status.Filled), "reached the wall");

        // real Entropy request at its real fee; no keeper on a fork, so take the timeout path
        vm.roll(t.w1 + 1);
        uint256 fee = ENTROPY.getFeeV2();
        vm.deal(keeper, fee);
        vm.prank(keeper);
        vault.close{value: fee}(id);
        vm.roll(block.number + 201);
        vault.closeWithoutEntropy(id);
        vault.settle(id);
        v = vault.raidView(id);
        assertTrue(v.won, "the wall fill met the target");
        assertTrue(vault.raid(id).wallRecovered);
        assertGt(IERC20(usdc).balanceOf(sponsor), 0, "wall proceeds to the sponsor");

        vm.warp(block.timestamp + 1 hours);
        vm.prank(holder);
        router.claim(id);
        assertGt(holder.balance, monBefore, "MON released after the hold");
        assertGt(IERC20(usdc).balanceOf(holder), 10_000e6 + t.bounty - 1, "refund and the whole prize");
    }
}
