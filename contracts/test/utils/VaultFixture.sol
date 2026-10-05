// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {KuruFixture} from "./KuruFixture.sol";
import {MockEntropy, StubRouter} from "./Mocks.sol";
import {RaidVault, IEntropyV2} from "../../src/RaidVault.sol";
import {Terms, AnchorMode, IRaidRouter} from "../../src/interfaces/IRaid.sol";

contract VaultFixture is KuruFixture {
    uint96 internal constant WALL = 100_000e10; // 100k base tokens
    uint256 internal constant WALL_WEI = 100_000e18;
    uint128 internal constant BOUNTY = 100e6;
    uint128 internal constant TARGET = 1_000e6;
    uint128 internal constant SEAT_CAP = 200e6;

    RaidVault internal vault;
    MockEntropy internal entropy;
    address internal owner = makeAddr("owner");
    address internal keeper = makeAddr("keeper");
    address internal sponsor = makeAddr("sponsor");

    function _deployVault(IRaidRouter router) internal {
        _deployKuru();
        entropy = new MockEntropy();
        vault = new RaidVault(owner, _marginAccount(), IEntropyV2(address(entropy)), keeper);
        vm.startPrank(owner);
        vault.setRouter(router);
        vault.setMarket(address(book), true);
        vm.stopPrank();
        vm.deal(keeper, 100 ether);
    }

    function _terms(uint64 w0) internal view returns (Terms memory) {
        return Terms({
            market: address(book),
            prizeToken: address(usdc),
            wallSize: WALL,
            bounty: BOUNTY,
            target: TARGET,
            seatCap: SEAT_CAP,
            w0: w0,
            w1: w0 + 100,
            hold: 1 hours,
            capBps: 50,
            anchorMode: AnchorMode.Fixed,
            anchorParam: PRICE
        });
    }

    function _post(Terms memory t) internal returns (uint256 id) {
        base.mint(sponsor, WALL_WEI);
        usdc.mint(sponsor, t.bounty);
        vm.startPrank(sponsor);
        base.approve(address(vault), WALL_WEI);
        usdc.approve(address(vault), t.bounty);
        id = vault.post(t, new address[](0));
        vm.stopPrank();
    }

    function _postAndOpen() internal returns (uint256 id) {
        Terms memory t = _terms(uint64(block.number + 20));
        id = _post(t);
        vm.roll(t.w0);
        vm.prank(keeper);
        vault.open(id);
    }

    function _closeAndDraw(uint256 id, bytes32 rand) internal {
        vm.roll(vault.raidView(id).w1 + 1);
        vm.prank(keeper);
        vault.close{value: 1}(id);
        entropy.fulfill(entropy.seq(), rand);
    }

    /// Expected cap for the fixed anchor with an empty book: PRICE * 1.005 rounded up to tick.
    function _expectedCap() internal pure returns (uint32) {
        uint256 c = uint256(PRICE) * 10_050 / 10_000;
        uint256 r = c % TICK;
        return uint32(r == 0 ? c : c + TICK - r);
    }
}
