// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {RaidVault, IEntropyV2} from "../../src/RaidVault.sol";
import {RaidRouter} from "../../src/RaidRouter.sol";
import {SeatGate} from "../../src/SeatGate.sol";
import {KuruBook, IKuruOrderBook, IKuruMarginAccount} from "../../src/lib/KuruBook.sol";
import {Terms, AnchorMode, RaidStatus, RaidView, IRaidRouter, IRaidVault} from "../../src/interfaces/IRaid.sol";
import {MockERC20} from "../utils/MockERC20.sol";
import {MockStars} from "../utils/MockStars.sol";
import {IKuruRouter} from "../../script/DeployTestnet.s.sol";

/// The testnet thin-market raid (SPEC §4.3) on a fork of chain 10143: a fresh market made through
/// Kuru's testnet Router, where the wall is the only ask, so raid buys come out of the sponsor's supply.
/// Run: forge test --fork-url $MONAD_TESTNET_RPC --match-path "test/fork/TestnetRaid*"
contract TestnetRaidForkTest is Test {
    IKuruRouter constant KURU_ROUTER = IKuruRouter(0x7EFbE105Ca7415dE98F96622173458ac1c054630);
    IKuruMarginAccount constant MARGIN = IKuruMarginAccount(0xd029C2D98ff85D8F64799017fE00a59B1159CE02);
    IEntropyV2 constant ENTROPY = IEntropyV2(0x825c0390f379C631f3Cf11A82a37D20BddF93c07);

    MockERC20 star;
    MockERC20 usdc;
    MockStars stars;
    IKuruOrderBook book;
    RaidVault vault;
    RaidRouter router;
    SeatGate gate;
    address keeper = makeAddr("keeper");
    address sponsor = makeAddr("sponsor");

    function setUp() public {
        if (block.chainid != 10143) {
            vm.skip(true);
            return;
        }
        star = new MockERC20("tSTAR", "tSTAR", 18);
        usdc = new MockERC20("tUSDC", "tUSDC", 6);
        stars = new MockStars();
        book = IKuruOrderBook(KURU_ROUTER.deployProxy(0, address(star), address(usdc), 1e10, 1e8, 100, 1e12, 1e20, 0, 0, 100));
        vault = new RaidVault(address(this), MARGIN, ENTROPY, keeper);
        gate = new SeatGate(address(this), IERC721(address(stars)), address(0xBEEF));
        router = new RaidRouter(IRaidVault(address(vault)), gate, MARGIN);
        vault.setRouter(IRaidRouter(address(router)));
        vault.setMarket(address(book), true);
        gate.setRouter(address(router));
    }

    function test_testnet_thinMarketRaidDrainsTheWall() public {
        Terms memory t = Terms({
            market: address(book),
            prizeToken: address(usdc),
            wallSize: 100_000e10,
            bounty: 50e6,
            target: 1_000e6,
            seatCap: 400e6,
            w0: uint64(block.number + 20),
            w1: uint64(block.number + 220),
            hold: 1 hours,
            capBps: 0,
            anchorMode: AnchorMode.Fixed,
            anchorParam: 2_600_000 // 0.026 tUSDC
        });
        star.mint(sponsor, 100_000e18);
        usdc.mint(sponsor, t.bounty);
        vm.startPrank(sponsor);
        star.approve(address(vault), type(uint256).max);
        usdc.approve(address(vault), type(uint256).max);
        uint256 id = vault.post(t, new address[](0));
        vm.stopPrank();

        vm.roll(t.w0);
        vm.prank(keeper);
        vault.open(id);
        RaidView memory v = vault.raidView(id);
        assertEq(uint8(v.status), uint8(RaidStatus.Open));
        assertEq(v.capPrice, 2_600_000);

        for (uint256 i; i < 4; ++i) {
            address p = makeAddr(string(abi.encode(i)));
            uint256 tok = stars.mint(p);
            usdc.mint(p, 500e6);
            vm.startPrank(p);
            usdc.approve(address(router), type(uint256).max);
            SeatGate.Seat memory s;
            s.kind = 1;
            s.holder = p;
            s.tokenId = tok;
            router.raid(id, 400e6, s);
            vm.stopPrank();
            vm.roll(block.number + 3);
        }
        // the wall is the only ask: every unit bought came from it
        uint256 counted = router.countedTotalAt(id, uint64(block.number));
        assertApproxEqAbs(counted, 1_600e6, 4);
        // 1,600 tUSDC at 0.026 is 61,538.46 tSTAR out of the 100,000 wall
        assertApproxEqAbs(uint256(KuruBook.remaining(book, v.wallId)), uint256(384_615_385e6), 1e8, "wall drained by the raid");

        vm.roll(t.w1 + 1);
        vm.deal(keeper, 1 ether);
        vm.prank(keeper);
        vault.close{value: ENTROPY.getFeeV2()}(id);
        vm.roll(block.number + 201);
        vault.closeWithoutEntropy(id);
        vault.settle(id);
        assertTrue(vault.raidView(id).won);
        assertTrue(vault.raid(id).wallRecovered);
        assertApproxEqAbs(usdc.balanceOf(sponsor), 1_600e6, 4, "sponsor sold 1,600 tUSDC of its token to holders");
    }
}
