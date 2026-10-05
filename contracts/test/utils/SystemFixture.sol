// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {VaultFixture} from "./VaultFixture.sol";
import {MockEntropy} from "./Mocks.sol";
import {MockStars} from "./MockStars.sol";
import {RaidVault, IEntropyV2} from "../../src/RaidVault.sol";
import {RaidRouter} from "../../src/RaidRouter.sol";
import {SeatGate} from "../../src/SeatGate.sol";
import {IRaidRouter, IRaidVault, RaidView} from "../../src/interfaces/IRaid.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract SystemFixture is VaultFixture {
    RaidRouter internal router;
    SeatGate internal gate;
    MockStars internal stars;
    uint256 internal verifierKey = 0xA11CE;

    function _deploySystem() internal {
        _deployKuru();
        entropy = new MockEntropy();
        stars = new MockStars();
        vault = new RaidVault(owner, _marginAccount(), IEntropyV2(address(entropy)), keeper);
        gate = new SeatGate(owner, IERC721(address(stars)), vm.addr(verifierKey));
        router = new RaidRouter(IRaidVault(address(vault)), gate, _marginAccount());
        vm.startPrank(owner);
        vault.setRouter(IRaidRouter(address(router)));
        vault.setMarket(address(book), true);
        gate.setRouter(address(router));
        vm.stopPrank();
        vm.deal(keeper, 100 ether);
    }

    function _noSeat() internal pure returns (SeatGate.Seat memory s) {}

    function _starSeat(address holder, uint256 tokenId) internal pure returns (SeatGate.Seat memory s) {
        s.kind = 1;
        s.holder = holder;
        s.tokenId = tokenId;
    }

    function _bindSeat(uint256 holderKey, address player, uint256 tokenId, uint64 expiry)
        internal
        view
        returns (SeatGate.Seat memory s)
    {
        address holder = vm.addr(holderKey);
        s = _starSeat(holder, tokenId);
        s.expiry = expiry;
        bytes32 structHash = keccak256(abi.encode(gate.BIND_TYPEHASH(), holder, player, expiry));
        (uint8 v, bytes32 r, bytes32 ss) =
            vm.sign(holderKey, keccak256(abi.encodePacked("\x19\x01", gate.domainSeparator(), structHash)));
        s.sig = abi.encodePacked(r, ss, v);
    }

    function _humanSeat(uint256 raidId, address player, bytes32 humanId, uint64 expiry, uint256 signerKey)
        internal
        view
        returns (SeatGate.Seat memory s)
    {
        s.kind = 2;
        s.humanId = humanId;
        s.expiry = expiry;
        bytes32 structHash = keccak256(abi.encode(gate.HUMAN_TYPEHASH(), player, humanId, raidId, expiry));
        (uint8 v, bytes32 r, bytes32 ss) =
            vm.sign(signerKey, keccak256(abi.encodePacked("\x19\x01", gate.domainSeparator(), structHash)));
        s.sig = abi.encodePacked(r, ss, v);
    }

    /// Mints a Star to `who` and gives it USDC approved to the router.
    function _raider(address who, uint256 usdcAmt) internal returns (uint256 tokenId) {
        tokenId = stars.mint(who);
        usdc.mint(who, usdcAmt);
        vm.prank(who);
        usdc.approve(address(router), type(uint256).max);
    }

    function _buy(address who, uint256 raidId, uint128 quoteIn, SeatGate.Seat memory s) internal {
        vm.prank(who);
        router.raid(raidId, quoteIn, s);
    }

    function _view(uint256 id) internal view returns (RaidView memory) {
        return vault.raidView(id);
    }

    function _key(address holder) internal pure returns (bytes32) {
        return keccak256(abi.encode(uint8(1), holder));
    }
}
