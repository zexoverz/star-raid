// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {VaultFixture} from "../utils/VaultFixture.sol";
import {StubRouter} from "../utils/Mocks.sol";
import {MockERC20} from "../utils/MockERC20.sol";
import {Terms, RaidStatus} from "../../src/interfaces/IRaid.sol";

/// Drives raids through random paths: random wall takes, won or lost, Entropy or timeout, settle.
/// The prize is its own token so the sponsor's prize balance cannot be confused with wall proceeds.
contract VaultHandler is VaultFixture {
    StubRouter public stub;
    MockERC20 public prize;
    uint256 public sponsorPrizeFromRanRaids;
    uint256 public prizeHeldByVault;
    uint256 public prizeRolledOver;
    uint256 public prizeToRouter;
    uint256 public raids;

    constructor() {
        stub = new StubRouter();
        _deployVault(stub);
        prize = new MockERC20("Prize", "PRZ", 6);
    }

    function runRaid(uint256 seed) external {
        Terms memory t = _terms(uint64(block.number + 20));
        t.prizeToken = address(prize);
        base.mint(sponsor, WALL_WEI);
        uint256 credit = vault.rollover(sponsor, address(prize));
        if (credit < BOUNTY) prize.mint(sponsor, BOUNTY - credit);
        vm.startPrank(sponsor);
        base.approve(address(vault), WALL_WEI);
        prize.approve(address(vault), BOUNTY);
        uint256 id = vault.post(t, new address[](0));
        vm.stopPrank();

        uint256 before = prize.balanceOf(sponsor);
        vm.roll(t.w0);
        vm.prank(keeper);
        vault.open(id);
        if (vault.raidView(id).status != RaidStatus.Open) return;
        ++raids;

        if (seed % 3 == 0) _takeAsks(makeAddr("t"), vault.raidView(id).capPrice, uint96(bound(seed, MIN_SIZE, WALL)));
        if (seed % 2 == 0) stub.setCounted(id, TARGET);
        vm.roll(t.w1 + 1);
        vm.prank(keeper);
        vault.close{value: 1}(id);
        if (seed % 5 == 0) {
            vm.roll(block.number + 201);
            vault.closeWithoutEntropy(id);
        } else {
            entropy.fulfill(entropy.seq(), keccak256(abi.encode(seed)));
        }
        vault.settle(id);
        sponsorPrizeFromRanRaids += prize.balanceOf(sponsor) - before;
    }

    function prizeInVault() external view returns (uint256) {
        return prize.balanceOf(address(vault));
    }

    function rolloverOfSponsor() external view returns (uint256) {
        return vault.rollover(sponsor, address(prize));
    }

    function prizeAtRouter() external view returns (uint256) {
        return prize.balanceOf(address(stub));
    }
}

contract VaultInvariantTest is Test {
    VaultHandler handler;

    function setUp() public {
        handler = new VaultHandler();
        targetContract(address(handler));
        bytes4[] memory sel = new bytes4[](1);
        sel[0] = VaultHandler.runRaid.selector;
        targetSelector(FuzzSelector(address(handler), sel));
    }

    /// The sponsor never receives the bounty of a raid that ran.
    function invariant_sponsorNeverGetsBountyBack() public view {
        assertEq(handler.sponsorPrizeFromRanRaids(), 0);
    }

    /// Every unwon prize unit sits in the vault as rollover; nothing leaks.
    function invariant_rolloverIsBackedByVaultBalance() public view {
        assertEq(handler.prizeInVault(), handler.rolloverOfSponsor());
    }
}
