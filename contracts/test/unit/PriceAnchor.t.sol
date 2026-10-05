// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {PriceAnchor, OracleConfig, IChainlinkFeed, IPyth} from "../../src/lib/PriceAnchor.sol";
import {AnchorMode} from "../../src/interfaces/IRaid.sol";
import {MockChainlink, MockPyth, MockLst} from "../utils/Mocks.sol";

contract AnchorHarness {
    function anchor(AnchorMode mode, uint256 param, PriceAnchor.Market memory m, OracleConfig memory o)
        external
        view
        returns (bool, uint256, uint8)
    {
        return PriceAnchor.anchor(mode, param, m, o);
    }
}

contract PriceAnchorTest is Test {
    AnchorHarness h;
    MockChainlink cl;
    MockPyth py;
    MockLst lst;
    OracleConfig cfg;
    PriceAnchor.Market usdMarket; // MON/USDC shape: price precision 1e8, quote 6 decimals
    PriceAnchor.Market lstMarket; // shMON/MON shape: price precision 1e6, quote 18 decimals

    function setUp() public {
        vm.warp(1_800_000_000);
        h = new AnchorHarness();
        cl = new MockChainlink();
        py = new MockPyth();
        lst = new MockLst();
        cfg = OracleConfig(IChainlinkFeed(address(cl)), IPyth(address(py)), bytes32("MON"));
        usdMarket = PriceAnchor.Market(address(0), 18, 6, 1e8);
        lstMarket = PriceAnchor.Market(address(lst), 18, 18, 1e6);
        cl.set(2_630_000, block.timestamp); // $0.0263, 8 decimals
        py.set(2_631_000, -8, block.timestamp);
    }

    function test_fixed() public view {
        (bool ok, uint256 p,) = h.anchor(AnchorMode.Fixed, 123, usdMarket, cfg);
        assertTrue(ok);
        assertEq(p, 123);
        (ok,,) = h.anchor(AnchorMode.Fixed, 0, usdMarket, cfg);
        assertFalse(ok);
    }

    function test_vaultRateInKuruUnits() public {
        lst.setRate(1.626e18);
        (bool ok, uint256 p,) = h.anchor(AnchorMode.VaultRate, 0, lstMarket, cfg);
        assertTrue(ok);
        assertEq(p, 1_626_000); // 1.626 MON at price precision 1e6
    }

    function test_vaultRateFailsOnNonVault() public view {
        PriceAnchor.Market memory m = lstMarket;
        m.base = address(cfg.chainlink); // no convertToAssets
        (bool ok,, uint8 reason) = h.anchor(AnchorMode.VaultRate, 0, m, cfg);
        assertFalse(ok);
        assertEq(reason, PriceAnchor.BAD_RATE);
    }

    function test_oracleMidOfBoth() public view {
        (bool ok, uint256 p,) = h.anchor(AnchorMode.Oracle, 0, usdMarket, cfg);
        assertTrue(ok);
        assertEq(p, 2_630_500);
    }

    function test_chainlinkStaleAfter120s() public {
        cl.set(2_630_000, block.timestamp - 121);
        (bool ok,, uint8 reason) = h.anchor(AnchorMode.Oracle, 0, usdMarket, cfg);
        assertFalse(ok);
        assertEq(reason, PriceAnchor.CHAINLINK_STALE);
        cl.set(2_630_000, block.timestamp - 120);
        (ok,,) = h.anchor(AnchorMode.Oracle, 0, usdMarket, cfg);
        assertTrue(ok);
    }

    function test_pythStaleAfter60s() public {
        py.set(2_631_000, -8, block.timestamp - 61);
        (bool ok,, uint8 reason) = h.anchor(AnchorMode.Oracle, 0, usdMarket, cfg);
        assertFalse(ok);
        assertEq(reason, PriceAnchor.PYTH_STALE);
    }

    function test_oraclesDivergeOver50Bps() public {
        py.set(2_630_000 * 10_051 / 10_000, -8, block.timestamp);
        (bool ok,, uint8 reason) = h.anchor(AnchorMode.Oracle, 0, usdMarket, cfg);
        assertFalse(ok);
        assertEq(reason, PriceAnchor.ORACLES_DIVERGE);
        py.set(2_630_000 * 10_049 / 10_000, -8, block.timestamp);
        (ok,,) = h.anchor(AnchorMode.Oracle, 0, usdMarket, cfg);
        assertTrue(ok);
    }

    function test_negativeChainlinkAnswerFails() public {
        cl.set(-1, block.timestamp);
        (bool ok,,) = h.anchor(AnchorMode.Oracle, 0, usdMarket, cfg);
        assertFalse(ok);
    }
}
