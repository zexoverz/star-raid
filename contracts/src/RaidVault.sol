// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {KuruBook, IKuruOrderBook, IKuruMarginAccount} from "./lib/KuruBook.sol";
import {PriceAnchor, OracleConfig} from "./lib/PriceAnchor.sol";
import {WallMaker} from "./WallMaker.sol";
import {Terms, RaidStatus, RaidView, AnchorMode, IRaidVault, IRaidRouter} from "./interfaces/IRaid.sol";

interface IEntropyV2 {
    function getFeeV2() external view returns (uint128);
    function requestV2() external payable returns (uint64);
}

/// Holds each raid's terms, base and bounty; places the wall through a per-raid clone; draws the end
/// block from Pyth Entropy; settles. One vault, many raids keyed by id.
contract RaidVault is IRaidVault, Ownable2Step, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    uint64 public constant MIN_WINDOW = 40;
    uint64 public constant MAX_WINDOW = 400;
    uint64 public constant OPEN_EARLY = 10;
    uint64 public constant OPEN_GRACE = 30;
    uint64 public constant ENTROPY_TIMEOUT = 200;
    uint16 public constant MAX_CAP_BPS = 200;
    uint16 public constant MIN_MARKET_CAP_BPS = 20;
    uint256 public constant MAX_MID_OVER_ANCHOR_BPS = 20;
    uint256 public constant TARGET_PER_BOUNTY = 10;
    uint256 public constant MAX_LEVEL_STEPS = 5;

    struct Raid {
        Terms terms;
        address sponsor;
        RaidStatus status;
        uint32 capPrice;
        uint40 wallId;
        address maker;
        uint64 endBlock;
        uint64 entropySeq;
        uint64 requestBlock;
        uint64 settledAt;
        bool won;
        bool wallRecovered;
        uint128 fromRollover;
        uint256 countedTotal;
        uint256 baseAmount;
    }

    IKuruMarginAccount public immutable margin;
    IEntropyV2 public immutable entropy;
    address public immutable makerImpl;

    IRaidRouter public router;
    address public keeper;
    bool public paused;
    uint256 public raidCount;

    mapping(uint256 => Raid) internal _raids;
    mapping(uint256 => mapping(address => bool)) internal _excluded;
    mapping(uint64 => uint256) public raidOfSequence;
    /// Unwon bounties, spendable only by post (SPEC §4.2 step 7). There is no withdraw.
    mapping(address => mapping(address => uint256)) public rollover;
    mapping(address => OracleConfig) public oracleOf;
    /// Kuru markets raids may run on. A sponsor-supplied fake book could report fake wall fills.
    mapping(address => bool) public marketAllowed;

    event RouterSet(address router);
    event KeeperSet(address keeper);
    event Paused(bool paused);
    event MarketAllowed(address indexed market, bool allowed);
    event OracleSet(address indexed market, address chainlink, address pyth, bytes32 pythId);
    event Posted(uint256 indexed raidId, address indexed sponsor, address indexed market, Terms terms, uint128 fromRollover);
    event Opened(uint256 indexed raidId, uint32 capPrice, uint40 wallId, address maker, uint256 anchor, uint256 mid);
    event Aborted(uint256 indexed raidId, uint8 reason);
    event CloseRequested(uint256 indexed raidId, uint64 sequence, uint256 fee);
    event EndDrawn(uint256 indexed raidId, uint64 endBlock, bytes32 randomNumber);
    event Settled(uint256 indexed raidId, bool won, uint256 countedTotal, uint96 wallSold);
    event WallRecovered(uint256 indexed raidId, uint256 baseOut, uint256 quoteOut);
    event WallRecoveryFailed(uint256 indexed raidId, bytes reason);
    event RolloverCredited(address indexed sponsor, address indexed token, uint256 amount, uint256 indexed raidId);

    error NotKeeper();
    error NotRouter();
    error OnlyEntropy();
    error IsPaused();
    error RouterAlreadySet();
    error BadWindow();
    error BadCapBps();
    error BadSize();
    error BadAmounts();
    error BountyTooLarge();
    error BadStatus(RaidStatus status);
    error TooEarly();
    error TooLate();
    error FeeTooLow(uint256 fee);
    error NativeMismatch();
    error RefundFailed();
    error AlreadyRecovered();
    error NotSelf();
    error MarketNotAllowed();

    uint8 internal constant ABORT_MID_OVER_ANCHOR = 10;
    uint8 internal constant ABORT_NO_EMPTY_LEVEL = 11;
    uint8 internal constant ABORT_WALL_FAILED = 12;
    uint8 internal constant ABORT_EXPIRED = 13;
    uint8 internal constant ABORT_CAP_OVERFLOW = 14;

    constructor(address owner_, IKuruMarginAccount margin_, IEntropyV2 entropy_, address keeper_) Ownable(owner_) {
        margin = margin_;
        entropy = entropy_;
        keeper = keeper_;
        makerImpl = address(new WallMaker());
    }

    // ---------------------------------------------------------------- admin

    /// Set once: the router and vault point at each other.
    function setRouter(IRaidRouter router_) external onlyOwner {
        if (address(router) != address(0)) revert RouterAlreadySet();
        router = router_;
        emit RouterSet(address(router_));
    }

    function setKeeper(address keeper_) external onlyOwner {
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    /// Pause blocks post and open only. It never blocks close, settle, recovery or claims.
    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit Paused(paused_);
    }

    function setMarket(address market, bool allowed) external onlyOwner {
        marketAllowed[market] = allowed;
        emit MarketAllowed(market, allowed);
    }

    function setOracle(address market, OracleConfig calldata cfg) external onlyOwner {
        oracleOf[market] = cfg;
        emit OracleSet(market, address(cfg.chainlink), address(cfg.pyth), cfg.pythId);
    }

    // ---------------------------------------------------------------- post

    /// Sponsor posts terms with the wall's base and the bounty. Rollover credit is spent first.
    function post(Terms calldata t, address[] calldata affiliates) external payable nonReentrant returns (uint256 raidId) {
        if (paused) revert IsPaused();
        _checkTerms(t);
        uint256 baseAmount = _baseAmount(t);

        raidId = ++raidCount;
        Raid storage r = _raids[raidId];
        r.terms = t;
        r.sponsor = msg.sender;
        r.status = RaidStatus.Posted;
        r.baseAmount = baseAmount;

        uint256 credit = rollover[msg.sender][t.prizeToken];
        uint128 fromRollover = uint128(credit < t.bounty ? credit : t.bounty);
        rollover[msg.sender][t.prizeToken] = credit - fromRollover;
        r.fromRollover = fromRollover;

        for (uint256 i; i < affiliates.length; ++i) {
            _excluded[raidId][affiliates[i]] = true;
        }

        (,, address base,,,,,,,,) = IKuruOrderBook(t.market).getMarketParams();
        if (base == address(0)) {
            if (msg.value != baseAmount) revert NativeMismatch();
        } else {
            if (msg.value != 0) revert NativeMismatch();
            IERC20(base).safeTransferFrom(msg.sender, address(this), baseAmount);
        }
        if (t.bounty > fromRollover) {
            IERC20(t.prizeToken).safeTransferFrom(msg.sender, address(this), t.bounty - fromRollover);
        }
        emit Posted(raidId, msg.sender, t.market, t, fromRollover);
    }

    function _checkTerms(Terms calldata t) internal view {
        if (!marketAllowed[t.market]) revert MarketNotAllowed();
        if (t.w0 <= block.number + OPEN_EARLY || t.w1 < t.w0 + MIN_WINDOW || t.w1 > t.w0 + MAX_WINDOW) {
            revert BadWindow();
        }
        if (t.capBps > MAX_CAP_BPS || (t.anchorMode != AnchorMode.Fixed && t.capBps < MIN_MARKET_CAP_BPS)) {
            revert BadCapBps();
        }
        if (t.bounty == 0 || t.target == 0 || t.seatCap == 0 || t.prizeToken == address(0)) revert BadAmounts();
        (,,,, address quote,,, uint96 minSize, uint96 maxSize,,) = IKuruOrderBook(t.market).getMarketParams();
        if (t.wallSize < minSize || t.wallSize > maxSize) revert BadSize();
        // H4: a win must buy at least TARGET_PER_BOUNTY times the prize when both are the same token.
        if (t.prizeToken == quote && uint256(t.bounty) * TARGET_PER_BOUNTY > t.target) revert BountyTooLarge();
    }

    function _baseAmount(Terms calldata t) internal view returns (uint256 amount) {
        (, uint96 sizePrecision,, uint256 baseDecimals,,,,,,,) = IKuruOrderBook(t.market).getMarketParams();
        uint256 scaled = uint256(t.wallSize) * (10 ** baseDecimals);
        // Kuru debits size * 10^dec / sizePrecision (OrderBook.sol:260); refuse sizes that leave dust.
        if (scaled % sizePrecision != 0) revert BadSize();
        amount = scaled / sizePrecision;
    }

    // ---------------------------------------------------------------- open

    function open(uint256 raidId) external nonReentrant {
        if (msg.sender != keeper) revert NotKeeper();
        if (paused) revert IsPaused();
        Raid storage r = _raids[raidId];
        if (r.status != RaidStatus.Posted) revert BadStatus(r.status);
        if (block.number + OPEN_EARLY < r.terms.w0) revert TooEarly();
        if (block.number > r.terms.w0 + OPEN_GRACE) revert TooLate();

        IKuruOrderBook book = IKuruOrderBook(r.terms.market);
        (uint32 pp,, address base, uint256 baseDec,, uint256 quoteDec, uint32 tick,,,,) = book.getMarketParams();

        (bool ok, uint256 anchorPrice, uint8 reason) = PriceAnchor.anchor(
            r.terms.anchorMode,
            r.terms.anchorParam,
            PriceAnchor.Market(base, baseDec, quoteDec, pp),
            oracleOf[r.terms.market]
        );
        if (!ok) return _abort(raidId, reason);

        // M3: reference is max(anchor, Kuru mid). A mid far above the anchor means the book was
        // pushed up or the anchor is wrong; either way raiders would overpay, so abort.
        uint256 mid = KuruBook.mid(book, pp);
        uint256 ref = anchorPrice;
        if (mid > anchorPrice) {
            if ((mid - anchorPrice) * 10_000 > anchorPrice * MAX_MID_OVER_ANCHOR_BPS) {
                return _abort(raidId, ABORT_MID_OVER_ANCHOR);
            }
            ref = mid;
        }

        uint256 cap = KuruBook.roundUpToTick(ref * (10_000 + r.terms.capBps) / 10_000, tick);
        cap = _emptyLevel(book, cap, tick);
        if (cap == 0) return _abort(raidId, ABORT_NO_EMPTY_LEVEL);
        if (cap >= type(uint32).max) return _abort(raidId, ABORT_CAP_OVERFLOW);

        _placeWall(raidId, r, book, base, uint32(cap));
        if (r.status == RaidStatus.Open) emit Opened(raidId, r.capPrice, r.wallId, r.maker, anchorPrice, mid);
    }

    /// An empty level means nobody is ahead of the wall in FIFO at its price.
    function _emptyLevel(IKuruOrderBook book, uint256 price, uint32 tick) internal view returns (uint256) {
        for (uint256 i; i <= MAX_LEVEL_STEPS; ++i) {
            (uint40 head,) = book.s_sellPricePoints(price);
            if (head == 0) return price;
            price += tick;
        }
        return 0;
    }

    function _placeWall(uint256 raidId, Raid storage r, IKuruOrderBook book, address base, uint32 cap) internal {
        WallMaker maker = WallMaker(payable(Clones.clone(makerImpl)));
        maker.initialize(address(this), book, margin);
        uint256 value;
        if (base == address(0)) {
            value = r.baseAmount;
        } else {
            IERC20(base).forceApprove(address(maker), r.baseAmount);
        }
        try maker.place{value: value}(cap, r.terms.wallSize, r.baseAmount) returns (uint40 id) {
            r.status = RaidStatus.Open;
            r.capPrice = cap;
            r.wallId = id;
            r.maker = address(maker);
        } catch {
            if (base != address(0)) IERC20(base).forceApprove(address(maker), 0);
            _abort(raidId, ABORT_WALL_FAILED);
        }
    }

    /// A raid that never opened refunds itself (H3).
    function expire(uint256 raidId) external nonReentrant {
        Raid storage r = _raids[raidId];
        if (r.status != RaidStatus.Posted) revert BadStatus(r.status);
        if (block.number <= r.terms.w0 + OPEN_GRACE) revert TooEarly();
        _abort(raidId, ABORT_EXPIRED);
    }

    /// Full refund. The part of the bounty that came from rollover goes back to rollover (H4).
    function _abort(uint256 raidId, uint8 reason) internal {
        Raid storage r = _raids[raidId];
        r.status = RaidStatus.Aborted;
        address prize = r.terms.prizeToken;
        if (r.fromRollover > 0) _creditRollover(r.sponsor, prize, r.fromRollover, raidId);
        uint256 fresh = r.terms.bounty - r.fromRollover;
        if (fresh > 0) IERC20(prize).safeTransfer(r.sponsor, fresh);

        (,, address base,,,,,,,,) = IKuruOrderBook(r.terms.market).getMarketParams();
        _send(base, r.sponsor, r.baseAmount);
        emit Aborted(raidId, reason);
    }

    // ---------------------------------------------------------------- close and the end block

    /// Anyone, after w1: one Entropy request (M2), fee read with getFeeV2. The end block is never
    /// taken from prevrandao or a blockhash (rule 8).
    function close(uint256 raidId) external payable nonReentrant {
        Raid storage r = _raids[raidId];
        if (r.status != RaidStatus.Open) revert BadStatus(r.status);
        if (block.number <= r.terms.w1) revert TooEarly();
        uint256 fee = entropy.getFeeV2();
        if (msg.value < fee) revert FeeTooLow(fee);

        uint64 seq = entropy.requestV2{value: fee}();
        raidOfSequence[seq] = raidId;
        r.entropySeq = seq;
        r.requestBlock = uint64(block.number);
        r.status = RaidStatus.Closing;
        emit CloseRequested(raidId, seq, fee);

        if (msg.value > fee) {
            (bool ok,) = msg.sender.call{value: msg.value - fee}("");
            if (!ok) revert RefundFailed();
        }
    }

    /// Entropy callback (IEntropyConsumer._entropyCallback). Never reverts on a stale sequence, so a
    /// late callback after the timeout cannot jam Entropy's retry.
    function _entropyCallback(uint64 sequence, address, bytes32 randomNumber) external {
        if (msg.sender != address(entropy)) revert OnlyEntropy();
        uint256 raidId = raidOfSequence[sequence];
        Raid storage r = _raids[raidId];
        if (raidId == 0 || r.status != RaidStatus.Closing || r.entropySeq != sequence) return;
        uint64 endBlock = drawEndBlock(r.terms.w0, r.terms.w1, randomNumber);
        r.endBlock = endBlock;
        r.status = RaidStatus.Closed;
        emit EndDrawn(raidId, endBlock, randomNumber);
    }

    /// No callback in ENTROPY_TIMEOUT blocks: the end is the last block of the window (H3).
    function closeWithoutEntropy(uint256 raidId) external {
        Raid storage r = _raids[raidId];
        if (r.status != RaidStatus.Closing) revert BadStatus(r.status);
        if (block.number <= r.requestBlock + ENTROPY_TIMEOUT) revert TooEarly();
        r.endBlock = r.terms.w1;
        r.status = RaidStatus.Closed;
        emit EndDrawn(raidId, r.terms.w1, bytes32(0));
    }

    /// E uniform in the last quarter of [w0, w1] (M1).
    function drawEndBlock(uint64 w0, uint64 w1, bytes32 randomNumber) public pure returns (uint64) {
        uint64 quarter = (w1 - w0) / 4;
        return w1 - quarter + uint64(uint256(randomNumber) % (uint256(quarter) + 1));
    }

    // ---------------------------------------------------------------- settle

    /// Anyone, once E is known. Records the outcome first; the wall is recovered after, under
    /// try/catch, so a Kuru hard pause cannot stop the outcome or the claims (H3).
    function settle(uint256 raidId) external nonReentrant {
        Raid storage r = _raids[raidId];
        if (r.status != RaidStatus.Closed) revert BadStatus(r.status);

        uint256 counted = router.countedTotalAt(raidId, r.endBlock);
        bool won = counted >= r.terms.target;
        uint96 wallSold = r.terms.wallSize - WallMaker(payable(r.maker)).wallRemaining();

        r.status = RaidStatus.Settled;
        r.countedTotal = counted;
        r.won = won;
        r.settledAt = uint64(block.timestamp);

        if (won) {
            IERC20(r.terms.prizeToken).safeTransfer(address(router), r.terms.bounty);
            router.fundPrize(raidId, r.terms.bounty, counted);
        } else {
            _creditRollover(r.sponsor, r.terms.prizeToken, r.terms.bounty, raidId);
        }
        emit Settled(raidId, won, counted, wallSold);

        try this.recoverWallSelf(raidId) {}
        catch (bytes memory reason) {
            emit WallRecoveryFailed(raidId, reason);
        }
    }

    /// Retry the wall sweep after a failed attempt (Kuru paused, or the sponsor refused native).
    function recoverWall(uint256 raidId) external nonReentrant {
        _recoverWall(raidId);
    }

    /// Self-call target so settle can catch a revert. Not callable by anyone else.
    function recoverWallSelf(uint256 raidId) external {
        if (msg.sender != address(this)) revert NotSelf();
        _recoverWall(raidId);
    }

    function _recoverWall(uint256 raidId) internal {
        Raid storage r = _raids[raidId];
        if (r.status != RaidStatus.Settled) revert BadStatus(r.status);
        if (r.wallRecovered) revert AlreadyRecovered();
        r.wallRecovered = true;
        (uint256 baseOut, uint256 quoteOut) = WallMaker(payable(r.maker)).sweep(r.sponsor);
        emit WallRecovered(raidId, baseOut, quoteOut);
    }

    // ---------------------------------------------------------------- rollover and router hooks

    /// The router returns a forfeited prize share; it becomes the sponsor's rollover.
    function creditForfeit(uint256 raidId, uint256 amount) external {
        if (msg.sender != address(router)) revert NotRouter();
        Raid storage r = _raids[raidId];
        _creditRollover(r.sponsor, r.terms.prizeToken, amount, raidId);
    }

    function _creditRollover(address sponsor, address token, uint256 amount, uint256 raidId) internal {
        rollover[sponsor][token] += amount;
        emit RolloverCredited(sponsor, token, amount, raidId);
    }

    function _send(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert RefundFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    // ---------------------------------------------------------------- views

    function raidView(uint256 raidId) external view returns (RaidView memory v) {
        Raid storage r = _raids[raidId];
        if (r.status == RaidStatus.None) return v;
        (,, address base,, address quote,,,,,,) = IKuruOrderBook(r.terms.market).getMarketParams();
        v = RaidView({
            status: r.status,
            sponsor: r.sponsor,
            market: r.terms.market,
            base: base,
            quote: quote,
            prizeToken: r.terms.prizeToken,
            maker: r.maker,
            wallId: r.wallId,
            capPrice: r.capPrice,
            w0: r.terms.w0,
            w1: r.terms.w1,
            endBlock: r.endBlock,
            settledAt: r.settledAt,
            hold: r.terms.hold,
            seatCap: r.terms.seatCap,
            won: r.won
        });
    }

    function raid(uint256 raidId) external view returns (Raid memory) {
        return _raids[raidId];
    }

    function isExcluded(uint256 raidId, address who) external view returns (bool) {
        return who == _raids[raidId].sponsor || _excluded[raidId][who];
    }

    receive() external payable {}
}
