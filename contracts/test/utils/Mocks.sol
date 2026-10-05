// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPyth} from "../../src/lib/PriceAnchor.sol";
import {IRaidRouter} from "../../src/interfaces/IRaid.sol";

interface IEntropyConsumerCb {
    function _entropyCallback(uint64 sequence, address provider, bytes32 randomNumber) external;
}

/// Pyth Entropy v2 stand-in: records requests; the test decides when and what to call back.
contract MockEntropy {
    uint128 public fee = 1;
    uint64 public seq;
    mapping(uint64 => address) public requester;

    function setFee(uint128 f) external {
        fee = f;
    }

    function getFeeV2() external view returns (uint128) {
        return fee;
    }

    function requestV2() external payable returns (uint64) {
        require(msg.value >= fee, "fee");
        requester[++seq] = msg.sender;
        return seq;
    }

    function fulfill(uint64 s, bytes32 rand) external {
        IEntropyConsumerCb(requester[s])._entropyCallback(s, address(this), rand);
    }
}

/// Router stand-in for vault tests: the test sets the counted total.
contract StubRouter is IRaidRouter {
    mapping(uint256 => uint256) public counted;
    mapping(uint256 => uint256) public funded;

    function setCounted(uint256 raidId, uint256 c) external {
        counted[raidId] = c;
    }

    function countedTotalAt(uint256 raidId, uint64) external view returns (uint256) {
        return counted[raidId];
    }

    function fundPrize(uint256 raidId, uint256 amount, uint256) external {
        funded[raidId] += amount;
    }
}

contract MockChainlink {
    int256 public answer;
    uint256 public updatedAt;
    uint8 public decimals = 8;

    function set(int256 a, uint256 t) external {
        answer = a;
        updatedAt = t;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}

contract MockPyth {
    IPyth.Price public p;

    function set(int64 price, int32 expo, uint256 t) external {
        p = IPyth.Price(price, 0, expo, t);
    }

    function getPriceNoOlderThan(bytes32, uint256 age) external view returns (IPyth.Price memory) {
        require(block.timestamp - p.publishTime <= age, "StalePrice");
        return p;
    }
}

/// Minimal ERC-4626-shaped LST: only convertToAssets matters to the anchor.
contract MockLst {
    uint256 public rate; // assets per 1e18 shares

    function setRate(uint256 r) external {
        rate = r;
    }

    function convertToAssets(uint256 shares) external view returns (uint256) {
        return shares * rate / 1e18;
    }
}
