// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {AnchorMode} from "../interfaces/IRaid.sol";

interface IChainlinkFeed {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

interface IPyth {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }

    function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (Price memory);
}

struct OracleConfig {
    IChainlinkFeed chainlink;
    IPyth pyth;
    bytes32 pythId;
}

/// Reference price for a raid's cap. Never reverts: a failed anchor returns (false, 0, reason) so
/// the vault can abort and refund instead of leaving the raid stuck.
library PriceAnchor {
    uint256 internal constant CHAINLINK_MAX_AGE = 120;
    uint256 internal constant PYTH_MAX_AGE = 60;
    uint256 internal constant ORACLE_MAX_DIVERGENCE_BPS = 50;

    uint8 internal constant OK = 0;
    uint8 internal constant BAD_FIXED = 1;
    uint8 internal constant BAD_RATE = 2;
    uint8 internal constant CHAINLINK_STALE = 3;
    uint8 internal constant PYTH_STALE = 4;
    uint8 internal constant ORACLES_DIVERGE = 5;

    struct Market {
        address base;
        uint256 baseDecimals;
        uint256 quoteDecimals;
        uint32 pricePrecision;
    }

    function anchor(AnchorMode mode, uint256 param, Market memory m, OracleConfig memory o)
        internal
        view
        returns (bool ok, uint256 price, uint8 reason)
    {
        if (mode == AnchorMode.Fixed) {
            if (param == 0) return (false, 0, BAD_FIXED);
            return (true, param, OK);
        }
        if (mode == AnchorMode.VaultRate) return _vaultRate(m);
        return _oracle(m, o);
    }

    /// LST rate: quote assets for one whole base token, in Kuru price units.
    function _vaultRate(Market memory m) private view returns (bool, uint256, uint8) {
        try IERC4626(m.base).convertToAssets(10 ** m.baseDecimals) returns (uint256 assets) {
            uint256 p = assets * m.pricePrecision / (10 ** m.quoteDecimals);
            if (p == 0) return (false, 0, BAD_RATE);
            return (true, p, OK);
        } catch {
            return (false, 0, BAD_RATE);
        }
    }

    /// USD price from Chainlink (<=120 s) and Pyth (<=60 s), each scaled to 1e18, within 50 bps of
    /// each other. The quote is assumed to be a USD stablecoin.
    function _oracle(Market memory m, OracleConfig memory o) private view returns (bool, uint256, uint8) {
        uint256 cl;
        try o.chainlink.latestRoundData() returns (uint80, int256 answer, uint256, uint256 updatedAt, uint80) {
            if (answer <= 0 || updatedAt + CHAINLINK_MAX_AGE < block.timestamp) return (false, 0, CHAINLINK_STALE);
            cl = uint256(answer) * 1e18 / (10 ** o.chainlink.decimals());
        } catch {
            return (false, 0, CHAINLINK_STALE);
        }

        uint256 py;
        try o.pyth.getPriceNoOlderThan(o.pythId, PYTH_MAX_AGE) returns (IPyth.Price memory p) {
            if (p.price <= 0 || p.expo > 0 || p.expo < -18) return (false, 0, PYTH_STALE);
            py = uint256(uint64(p.price)) * 1e18 / (10 ** uint32(-p.expo));
        } catch {
            return (false, 0, PYTH_STALE);
        }

        uint256 hi = cl > py ? cl : py;
        uint256 lo = cl > py ? py : cl;
        if ((hi - lo) * 10_000 > lo * ORACLE_MAX_DIVERGENCE_BPS) return (false, 0, ORACLES_DIVERGE);
        return (true, ((cl + py) / 2) * m.pricePrecision / 1e18, OK);
    }
}
