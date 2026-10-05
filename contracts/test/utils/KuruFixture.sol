// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {OrderBook} from "kuru/OrderBook.sol";
import {Router} from "kuru/Router.sol";
import {MarginAccount} from "kuru/MarginAccount.sol";
import {KuruAMMVault} from "kuru/KuruAMMVault.sol";
import {IOrderBook} from "kuru/interfaces/IOrderBook.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IKuruOrderBook, IKuruMarginAccount} from "../../src/lib/KuruBook.sol";
import {MockERC20} from "./MockERC20.sol";

/// Deploys Kuru from its own source at 2060bb27, the way Kuru's tests do (test/OrderBookTest.t.sol:52-90),
/// with an 18-decimal base and a 6-decimal USDC quote.
contract KuruFixture is Test {
    uint32 internal constant PRICE_PRECISION = 1e8;
    uint96 internal constant SIZE_PRECISION = 1e10;
    uint32 internal constant TICK = 100;
    uint96 internal constant MIN_SIZE = 1e10; // one base token
    uint96 internal constant MAX_SIZE = 1e20;
    uint32 internal constant PRICE = 2_600_000; // 0.026 USDC per base, on tick

    MockERC20 internal base;
    MockERC20 internal usdc;
    Router internal kuruRouter;
    MarginAccount internal margin;
    IKuruOrderBook internal book;

    function _deployKuru() internal {
        base = new MockERC20("Test Star", "tSTAR", 18);
        usdc = new MockERC20("Test USDC", "tUSDC", 6);

        OrderBook impl = new OrderBook();
        KuruAMMVault vaultImpl = new KuruAMMVault();
        kuruRouter = Router(payable(address(new ERC1967Proxy(address(new Router()), ""))));
        margin = MarginAccount(payable(address(new ERC1967Proxy(address(new MarginAccount()), ""))));
        address forwarder = address(0xF0);
        margin.initialize(address(this), address(kuruRouter), address(kuruRouter), forwarder);
        kuruRouter.initialize(address(this), address(margin), address(impl), address(vaultImpl), forwarder);

        address market = kuruRouter.deployProxy(
            IOrderBook.OrderBookType.NO_NATIVE,
            address(base),
            address(usdc),
            SIZE_PRECISION,
            PRICE_PRECISION,
            TICK,
            MIN_SIZE,
            MAX_SIZE,
            0,
            0,
            100
        );
        book = IKuruOrderBook(market);
    }

    function _fund(address who, uint256 baseAmt, uint256 usdcAmt) internal {
        base.mint(who, baseAmt);
        usdc.mint(who, usdcAmt);
        vm.startPrank(who);
        base.approve(address(margin), baseAmt);
        usdc.approve(address(margin), usdcAmt);
        if (baseAmt > 0) margin.deposit(who, address(base), baseAmt);
        if (usdcAmt > 0) margin.deposit(who, address(usdc), usdcAmt);
        vm.stopPrank();
    }

    /// Places an ask for `who` and returns its id.
    function _ask(address who, uint32 price, uint96 size) internal returns (uint40 id) {
        _fund(who, uint256(size) * 1e8, 0); // size 1e10 = 1e18 base wei
        vm.prank(who);
        book.addSellOrder(price, size, true);
        id = book.s_orderIdCounter();
    }

    function _bid(address who, uint32 price, uint96 size) internal returns (uint40 id) {
        _fund(who, 0, uint256(price) * size / SIZE_PRECISION * 1e6 / PRICE_PRECISION + 1e6);
        vm.prank(who);
        book.addBuyOrder(price, size, true);
        id = book.s_orderIdCounter();
    }

    function _takeAsks(address who, uint32 price, uint96 size) internal {
        _fund(who, 0, uint256(price) * size / SIZE_PRECISION * 1e6 / PRICE_PRECISION + 1e6);
        vm.prank(who);
        book.addBuyOrder(price, size, false);
    }

    function _marginAccount() internal view returns (IKuruMarginAccount) {
        return IKuruMarginAccount(address(margin));
    }
}
