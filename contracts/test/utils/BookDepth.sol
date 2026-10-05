// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IKuruOrderBook} from "../../src/lib/KuruBook.sol";

/// Live books change between fork blocks, so buys that must reach the wall are sized from the actual
/// ask depth under it instead of a fixed amount.
library BookDepth {
    /// Total resting ask size in the `levels` ticks below `cap`.
    function sizeUnder(IKuruOrderBook book, uint256 cap, uint32 tick, uint256 levels) internal view returns (uint256 total) {
        for (uint256 p = cap - tick; p + levels * tick > cap && p > 0; p -= tick) {
            (uint40 id,) = book.s_sellPricePoints(p);
            while (id != 0) {
                (, uint96 size,, uint40 nxt,,,,) = book.s_orders(id);
                total += size;
                id = nxt;
            }
        }
    }
}
