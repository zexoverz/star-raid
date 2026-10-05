// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {SystemFixture} from "../utils/SystemFixture.sol";
import {RaidStatus, Terms} from "../../src/interfaces/IRaid.sol";

/// Random raids with random raiders, cheaper asks, end blocks, claims and early exits.
contract SystemHandler is SystemFixture {
    address[] internal players;
    uint256[] internal tokens;
    uint256 public raidId;
    uint256 public prizePaid; // claimed prize across raids
    uint256 public prizeFunded; // bounties of won raids
    uint256 public baseBoughtBySeats;
    uint256 public baseReleased;
    uint256 public expectedPaid; // pot * counted / total, computed here per claim
    uint256 public wonRaids;
    mapping(uint256 => uint256) internal potOf;

    constructor() {
        _deploySystem();
        for (uint256 i; i < 6; ++i) {
            address p = makeAddr(string(abi.encode("p", i)));
            players.push(p);
            tokens.push(_raider(p, 1e12));
        }
    }

    function start() public {
        if (raidId != 0 && vault.raidView(raidId).status != RaidStatus.Settled) return;
        // a target five seats can reach, so wins are common
        Terms memory t = _terms(uint64(block.number + 20));
        t.target = 300e6;
        t.bounty = 30e6;
        raidId = _post(t);
        vm.roll(t.w0);
        vm.prank(keeper);
        vault.open(raidId);
    }

    function buy(uint256 who, uint256 amount, bool cheaperAsk) external {
        if (raidId == 0 || vault.raidView(raidId).status != RaidStatus.Open) return;
        if (block.number > vault.raidView(raidId).w1) return;
        who = bound(who, 0, players.length - 1);
        amount = bound(amount, 30e6, 400e6);
        uint32 cap = vault.raidView(raidId).capPrice;
        if (cheaperAsk) _ask(makeAddr("asker"), cap - TICK, 500e10);
        (, uint256 e0,,) = router.seatOf(raidId, _key(players[who]));
        vm.prank(players[who]);
        router.raid(raidId, uint128(amount), _starSeat(players[who], tokens[who]));
        (, uint256 e1,,) = router.seatOf(raidId, _key(players[who]));
        baseBoughtBySeats += e1 - e0;
        vm.roll(block.number + 1);
    }

    function finish(bytes32 rand) external {
        if (raidId == 0 || vault.raidView(raidId).status != RaidStatus.Open) return;
        uint256 before = usdc.balanceOf(address(router));
        _closeAndDraw(raidId, rand);
        vault.settle(raidId);
        if (vault.raidView(raidId).won) {
            uint256 pot = usdc.balanceOf(address(router)) - before;
            prizeFunded += pot;
            potOf[raidId] = pot;
            ++wonRaids;
        }
    }

    function claim(uint256 who, bool early) external {
        if (raidId == 0 || vault.raidView(raidId).status != RaidStatus.Settled) return;
        who = bound(who, 0, players.length - 1);
        address p = players[who];
        (address bound_, uint256 escrow,, bool done) = router.seatOf(raidId, _key(p));
        if (bound_ != p || done) return;
        vm.warp(block.timestamp + 1 hours);
        uint256 u0 = usdc.balanceOf(p);
        vm.prank(p);
        if (early) router.exitEarly(raidId);
        else router.claim(raidId);
        prizePaid += usdc.balanceOf(p) - u0;
        if (!early && vault.raidView(raidId).won) {
            expectedPaid += potOf[raidId] * router.countedOf(raidId, _key(p)) / router.countedAtSettle(raidId);
        }
        baseReleased += escrow;
    }

    function routerBase() external view returns (uint256) {
        return base.balanceOf(address(router));
    }

    function escrowedBase() external view returns (uint256) {
        return router.escrowed(address(base));
    }
}

contract SystemInvariantTest is Test {
    SystemHandler h;

    function setUp() public {
        h = new SystemHandler();
        h.start();
        targetContract(address(h));
    }

    /// Σ claims ≤ Σ bounties of won raids.
    function invariant_claimsNeverExceedBounty() public view {
        assertLe(h.prizePaid(), h.prizeFunded());
    }

    /// Each claim pays exactly its pro-rata share of the pot.
    function invariant_prizeIsProRata() public view {
        assertEq(h.prizePaid(), h.expectedPaid());
    }

    /// Escrowed base equals Σ unclaimed baseOut, and the router holds it.
    function invariant_escrowMatchesUnclaimedBase() public view {
        assertEq(h.escrowedBase(), h.baseBoughtBySeats() - h.baseReleased());
        assertGe(h.routerBase(), h.escrowedBase());
    }
}
