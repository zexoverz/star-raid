// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {KuruBook, IKuruOrderBook, IKuruMarginAccount} from "./lib/KuruBook.sol";

/// One minimal clone per raid (SPEC §16 H2). It owns the wall on Kuru, so the wall's margin balance
/// is never mixed with another raid's, and settle sweeps exactly this clone.
contract WallMaker {
    using SafeERC20 for IERC20;

    address public vault;
    IKuruOrderBook public book;
    IKuruMarginAccount public margin;
    address public base;
    address public quote;
    uint40 public wallId;

    error OnlyVault();
    error AlreadyInitialized();
    error WallNotPlaced();
    error NativeMismatch();
    error NativeSendFailed();

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    function initialize(address vault_, IKuruOrderBook book_, IKuruMarginAccount margin_) external {
        if (vault != address(0)) revert AlreadyInitialized();
        vault = vault_;
        book = book_;
        margin = margin_;
        (,, base,, quote,,,,,,) = book_.getMarketParams();
    }

    receive() external payable {}

    /// Deposits `amount` of base and places a postOnly ask. Base comes from the vault: ERC-20 by
    /// transferFrom, native as msg.value. Reverts if anything matches (OrderBook.sol:266-268).
    function place(uint32 price, uint96 size, uint256 amount) external payable onlyVault returns (uint40 id) {
        if (base == address(0)) {
            if (msg.value != amount) revert NativeMismatch();
            margin.deposit{value: amount}(address(this), address(0), amount);
        } else {
            if (msg.value != 0) revert NativeMismatch();
            IERC20(base).safeTransferFrom(msg.sender, address(this), amount);
            IERC20(base).forceApprove(address(margin), amount);
            margin.deposit(address(this), base, amount);
        }
        book.addSellOrder(price, size, true);
        // New id = counter after the call (OrderBook.sol:272-273); prove it is ours at our price.
        id = book.s_orderIdCounter();
        (address owner,,,,, uint32 p,, bool isBuy) = book.s_orders(id);
        if (owner != address(this) || p != price || isBuy) revert WallNotPlaced();
        wallId = id;
    }

    /// Wall size still resting, read through the level head (rule 4).
    function wallRemaining() external view returns (uint96) {
        return KuruBook.remaining(book, wallId);
    }

    /// Cancels the wall only if the head says it is active (rule 7), then withdraws every margin
    /// balance and sends base and quote to `to`. Works on active, filled, partial and admin-cancelled
    /// walls.
    function sweep(address to) external onlyVault returns (uint256 baseOut, uint256 quoteOut) {
        if (KuruBook.status(book, wallId) == KuruBook.Status.Active) {
            uint40[] memory ids = new uint40[](1);
            ids[0] = wallId;
            book.batchCancelOrders(ids);
        }
        baseOut = _drain(base, to);
        quoteOut = _drain(quote, to);
    }

    function _drain(address token, address to) private returns (uint256 out) {
        uint256 inMargin = margin.getBalance(address(this), token);
        if (inMargin > 0) margin.withdraw(inMargin, token);
        if (token == address(0)) {
            out = address(this).balance;
            if (out > 0) {
                (bool ok,) = to.call{value: out}("");
                if (!ok) revert NativeSendFailed();
            }
        } else {
            out = IERC20(token).balanceOf(address(this));
            if (out > 0) IERC20(token).safeTransfer(to, out);
        }
    }
}
