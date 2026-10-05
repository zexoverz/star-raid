// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {KuruBook, IKuruOrderBook, IKuruMarginAccount} from "./lib/KuruBook.sol";
import {SeatGate} from "./SeatGate.sol";
import {RaidView, RaidStatus, IRaidVault, IRaidRouter} from "./interfaces/IRaid.sol";

/// Every raid buy goes through here: a capped limit buy at the wall's price, any remainder cancelled
/// in the same transaction, attribution by margin balance difference, wall fill by the wall's
/// remaining size before and after. Seats' base is escrowed until claim.
contract RaidRouter is IRaidRouter, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    struct Checkpoint {
        uint64 blockNumber;
        uint192 value;
    }

    struct SeatState {
        address player;
        uint128 escrowBase; // base bought, held until claim
        uint128 cum; // uncapped counted wall fill, quote units
        bool done; // claimed or exited
        Checkpoint[] history; // cum after each block with a counted buy
    }

    struct Buy {
        uint256 baseOut;
        uint256 quoteSpent;
        uint256 wallFillQuote;
        uint40 cancelledId;
    }

    IRaidVault public immutable vault;
    SeatGate public immutable gate;
    IKuruMarginAccount public immutable margin;

    mapping(uint256 => mapping(bytes32 => SeatState)) internal _seats;
    mapping(uint256 => Checkpoint[]) internal _totals; // capped total after each block
    mapping(uint256 => uint256) public prizePot;
    mapping(uint256 => uint256) public countedAtSettle;
    mapping(uint256 => uint256) public nonSeatBuys;
    mapping(uint256 => uint256) public seatBuys;
    /// base held for seats, per base token; equals Σ unclaimed escrowBase
    mapping(address => uint256) public escrowed;

    event Raided(
        uint256 indexed raidId,
        address indexed player,
        bytes32 indexed seatKey,
        uint256 blockNumber,
        uint256 baseOut,
        uint256 quoteSpent,
        uint256 wallFillQuote,
        uint256 countedAdded
    );
    event PrizeFunded(uint256 indexed raidId, uint256 amount, uint256 countedTotal);
    event Claimed(uint256 indexed raidId, bytes32 indexed seatKey, address indexed player, uint256 base, uint256 prize);
    event ExitedEarly(uint256 indexed raidId, bytes32 indexed seatKey, address indexed player, uint256 base, uint256 forfeited);

    error NotOpen();
    error OutsideWindow();
    error Excluded();
    error NativeNotAccepted();
    error NativeMismatch();
    error SizeTooSmall();
    error SizeTooLarge();
    error OnlyVault();
    error NotSettled();
    error NoSeat();
    error AlreadyDone();
    error HoldNotOver();
    error SendFailed();

    constructor(IRaidVault vault_, SeatGate gate_, IKuruMarginAccount margin_) {
        vault = vault_;
        gate = gate_;
        margin = margin_;
    }

    receive() external payable {}

    // ---------------------------------------------------------------- raid

    /// One raid buy. Raiders pay in the market's quote: ERC-20 by allowance (rule 9: no msg.value), or
    /// native MON only on a MON-quoted market.
    function raid(uint256 raidId, uint128 quoteIn, SeatGate.Seat calldata seat) external payable nonReentrant {
        RaidView memory v = vault.raidView(raidId);
        if (v.status != RaidStatus.Open) revert NotOpen();
        if (block.number < v.w0 || block.number > v.w1) revert OutsideWindow();
        if (vault.isExcluded(raidId, msg.sender)) revert Excluded();
        (bytes32 key, address holder) = gate.use(raidId, seat, msg.sender);
        if (holder != address(0) && vault.isExcluded(raidId, holder)) revert Excluded();

        _pullQuote(v.quote, quoteIn);
        Buy memory b = _cappedBuy(v, quoteIn);

        // Base comes out of margin on every buy (M9); leftover quote goes straight back.
        if (b.baseOut > 0) margin.withdraw(b.baseOut, v.base);
        uint256 refund = quoteIn - b.quoteSpent;
        if (refund > 0) {
            margin.withdraw(refund, v.quote);
            _send(v.quote, msg.sender, refund);
        }

        uint256 added;
        if (key == bytes32(0)) {
            ++nonSeatBuys[raidId];
            _send(v.base, msg.sender, b.baseOut);
        } else {
            ++seatBuys[raidId];
            added = _record(raidId, key, msg.sender, b, v);
        }
        emit Raided(raidId, msg.sender, key, block.number, b.baseOut, b.quoteSpent, b.wallFillQuote, added);
    }

    function _pullQuote(address quote, uint256 quoteIn) internal {
        if (quote == address(0)) {
            if (msg.value != quoteIn) revert NativeMismatch();
            margin.deposit{value: quoteIn}(address(this), address(0), quoteIn);
        } else {
            if (msg.value != 0) revert NativeNotAccepted();
            IERC20(quote).safeTransferFrom(msg.sender, address(this), quoteIn);
            IERC20(quote).forceApprove(address(margin), quoteIn);
            margin.deposit(address(this), quote, quoteIn);
        }
    }

    /// Rule 5: addBuyOrder at the cap, never a market buy. Rule 7: the remainder is cancelled only if
    /// the head says it is active. Rule 6: amounts are margin differences around our own calls.
    function _cappedBuy(RaidView memory v, uint256 quoteIn) internal returns (Buy memory b) {
        IKuruOrderBook book = IKuruOrderBook(v.market);
        (uint32 pp, uint96 sp,,,, uint256 quoteDec,, uint96 minSize, uint96 maxSize,,) = book.getMarketParams();
        uint256 size = KuruBook.sizeFor(quoteIn, v.capPrice, sp, pp, quoteDec);
        if (size < minSize) revert SizeTooSmall();
        if (size > maxSize) revert SizeTooLarge();

        uint256 b0 = margin.getBalance(address(this), v.base);
        uint256 q0 = margin.getBalance(address(this), v.quote);
        uint40 c0 = book.s_orderIdCounter();
        uint96 wall0 = KuruBook.remaining(book, v.wallId);

        book.addBuyOrder(v.capPrice, uint96(size), false);

        // The resting remainder, if any, is the last order created (OrderBook.sol:205-209).
        uint40 c1 = book.s_orderIdCounter();
        if (c1 > c0) {
            (address owner,,,,,,, bool isBuy) = book.s_orders(c1);
            if (owner == address(this) && isBuy && KuruBook.status(book, c1) == KuruBook.Status.Active) {
                uint40[] memory ids = new uint40[](1);
                ids[0] = c1;
                book.batchCancelOrders(ids);
                b.cancelledId = c1;
            }
        }

        b.baseOut = margin.getBalance(address(this), v.base) - b0;
        b.quoteSpent = q0 - margin.getBalance(address(this), v.quote);
        uint96 wallFill = wall0 - KuruBook.remaining(book, v.wallId);
        b.wallFillQuote = KuruBook.quoteFor(wallFill, v.capPrice, sp, pp, quoteDec);
    }

    /// Escrows the seat's base and adds its wall fill to the per-block running totals, capped per seat.
    function _record(uint256 raidId, bytes32 key, address player, Buy memory b, RaidView memory v)
        internal
        returns (uint256 added)
    {
        SeatState storage s = _seats[raidId][key];
        s.player = player;
        s.escrowBase += uint128(b.baseOut);
        escrowed[v.base] += b.baseOut;
        if (b.wallFillQuote == 0) return 0;

        uint256 before = s.cum < v.seatCap ? s.cum : v.seatCap;
        s.cum += uint128(b.wallFillQuote);
        uint256 afterCap = s.cum < v.seatCap ? s.cum : v.seatCap;
        added = afterCap - before;
        _push(s.history, s.cum);

        Checkpoint[] storage t = _totals[raidId];
        uint256 total = t.length == 0 ? 0 : t[t.length - 1].value;
        _push(t, total + added);
    }

    function _push(Checkpoint[] storage cps, uint256 value) internal {
        uint256 n = cps.length;
        if (n > 0 && cps[n - 1].blockNumber == block.number) {
            cps[n - 1].value = uint192(value);
        } else {
            cps.push(Checkpoint(uint64(block.number), uint192(value)));
        }
    }

    /// Value of the last checkpoint at or before `blockNumber`, 0 if none.
    function _at(Checkpoint[] storage cps, uint64 blockNumber) internal view returns (uint256) {
        uint256 lo;
        uint256 hi = cps.length;
        while (lo < hi) {
            uint256 mid = (lo + hi) / 2;
            if (cps[mid].blockNumber > blockNumber) hi = mid;
            else lo = mid + 1;
        }
        return lo == 0 ? 0 : cps[lo - 1].value;
    }

    // ---------------------------------------------------------------- counting

    function countedTotalAt(uint256 raidId, uint64 endBlock) public view returns (uint256) {
        return _at(_totals[raidId], endBlock);
    }

    /// The seat's counted wall fill at the end block, capped.
    function countedOf(uint256 raidId, bytes32 key) public view returns (uint256) {
        RaidView memory v = vault.raidView(raidId);
        uint64 e = v.endBlock == 0 ? type(uint64).max : v.endBlock;
        uint256 c = _at(_seats[raidId][key].history, e);
        return c < v.seatCap ? c : v.seatCap;
    }

    function fundPrize(uint256 raidId, uint256 amount, uint256 countedTotal) external {
        if (msg.sender != address(vault)) revert OnlyVault();
        prizePot[raidId] = amount;
        countedAtSettle[raidId] = countedTotal;
        emit PrizeFunded(raidId, amount, countedTotal);
    }

    // ---------------------------------------------------------------- claims

    function prizeOf(uint256 raidId, bytes32 key) public view returns (uint256) {
        uint256 total = countedAtSettle[raidId];
        if (total == 0) return 0;
        return prizePot[raidId] * countedOf(raidId, key) / total;
    }

    /// After the hold on a win (or right after settle on a loss): base plus the prize share.
    function claim(uint256 raidId) external nonReentrant {
        (RaidView memory v, bytes32 key, SeatState storage s) = _settledSeat(raidId);
        if (v.won && block.timestamp < uint256(v.settledAt) + v.hold) revert HoldNotOver();
        uint256 prize = v.won ? prizeOf(raidId, key) : 0;
        uint256 baseAmt = s.escrowBase;
        s.done = true;
        s.escrowBase = 0;
        escrowed[v.base] -= baseAmt;
        _send(v.base, msg.sender, baseAmt);
        if (prize > 0) IERC20(v.prizeToken).safeTransfer(msg.sender, prize);
        emit Claimed(raidId, key, msg.sender, baseAmt, prize);
    }

    /// Any time after settle: base now, the prize share forfeited to the sponsor's next raid.
    function exitEarly(uint256 raidId) external nonReentrant {
        (RaidView memory v, bytes32 key, SeatState storage s) = _settledSeat(raidId);
        uint256 forfeit = v.won ? prizeOf(raidId, key) : 0;
        uint256 baseAmt = s.escrowBase;
        s.done = true;
        s.escrowBase = 0;
        escrowed[v.base] -= baseAmt;
        _send(v.base, msg.sender, baseAmt);
        if (forfeit > 0) {
            IERC20(v.prizeToken).safeTransfer(address(vault), forfeit);
            vault.creditForfeit(raidId, forfeit);
        }
        emit ExitedEarly(raidId, key, msg.sender, baseAmt, forfeit);
    }

    function _settledSeat(uint256 raidId)
        internal
        view
        returns (RaidView memory v, bytes32 key, SeatState storage s)
    {
        v = vault.raidView(raidId);
        if (v.status != RaidStatus.Settled) revert NotSettled();
        key = gate.playerSeat(raidId, msg.sender);
        s = _seats[raidId][key];
        if (key == bytes32(0) || s.player != msg.sender) revert NoSeat();
        if (s.done) revert AlreadyDone();
    }

    function _send(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert SendFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    // ---------------------------------------------------------------- views

    function seatOf(uint256 raidId, bytes32 key)
        external
        view
        returns (address player, uint256 escrowBase, uint256 cum, bool done)
    {
        SeatState storage s = _seats[raidId][key];
        return (s.player, s.escrowBase, s.cum, s.done);
    }

    function totalsLength(uint256 raidId) external view returns (uint256) {
        return _totals[raidId].length;
    }
}
