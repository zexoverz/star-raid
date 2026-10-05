// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// Who may hold a counted seat in a raid.
///   kind 0: no seat. The buy goes through and is never counted (SPEC §16 M6).
///   kind 1: a Lil Stars holder. The seat is the holder wallet, one per raid (C2), proven by any token
///           it owns. Another wallet may raid for it under an EIP-712 Bind signed by the holder (H7).
///   kind 2: a personhood seat, an EIP-712 Human attestation from our verifier (M5).
contract SeatGate is EIP712, Ownable2Step {
    uint8 public constant NONE = 0;
    uint8 public constant STAR = 1;
    uint8 public constant HUMAN = 2;

    bytes32 public constant BIND_TYPEHASH = keccak256("Bind(address holder,address player,uint64 expiry)");
    bytes32 public constant HUMAN_TYPEHASH =
        keccak256("Human(address player,bytes32 humanId,uint256 raidId,uint64 expiry)");

    struct Seat {
        uint8 kind;
        address holder; // kind 1
        uint256 tokenId; // kind 1: a Star the holder owns now
        bytes32 humanId; // kind 2
        uint64 expiry; // Bind or Human expiry, unix seconds
        bytes sig; // kind 1 when player != holder: holder's Bind; kind 2: verifier's Human
    }

    IERC721 public immutable lilStars;
    address public router;
    address public verifier;

    /// raidId => tokenId => holder that first used it
    mapping(uint256 => mapping(uint256 => address)) public tokenHolder;
    /// raidId => seatKey => player bound to the seat
    mapping(uint256 => mapping(bytes32 => address)) public seatPlayer;
    /// raidId => player => seatKey
    mapping(uint256 => mapping(address => bytes32)) public playerSeat;

    event RouterSet(address router);
    event VerifierSet(address verifier);
    event SeatBound(
        uint256 indexed raidId, bytes32 indexed seatKey, address indexed player, uint8 kind, address holder, uint256 tokenId
    );

    error OnlyRouter();
    error RouterAlreadySet();
    error BadKind();
    error NotStarOwner();
    error TokenUsed();
    error BadBind();
    error BadHuman();
    error Expired();
    error SeatTaken();
    error PlayerHasSeat();
    error HolderNeedsStarSeat();

    constructor(address owner_, IERC721 lilStars_, address verifier_) EIP712("StarRaid SeatGate", "1") Ownable(owner_) {
        lilStars = lilStars_;
        verifier = verifier_;
    }

    function setRouter(address router_) external onlyOwner {
        if (router != address(0)) revert RouterAlreadySet();
        router = router_;
        emit RouterSet(router_);
    }

    function setVerifier(address verifier_) external onlyOwner {
        verifier = verifier_;
        emit VerifierSet(verifier_);
    }

    /// Checks the seat for `player` and binds it on first use. Returns the seat key (0 for no seat)
    /// and the holder wallet the sponsor exclusion must also be checked against.
    function use(uint256 raidId, Seat calldata seat, address player) external returns (bytes32 key, address holder) {
        if (msg.sender != router) revert OnlyRouter();
        if (seat.kind == NONE) return (bytes32(0), address(0));
        if (seat.kind == STAR) {
            holder = seat.holder;
            if (lilStars.ownerOf(seat.tokenId) != holder) revert NotStarOwner();
            address first = tokenHolder[raidId][seat.tokenId];
            if (first != address(0) && first != holder) revert TokenUsed();
            if (first == address(0)) tokenHolder[raidId][seat.tokenId] = holder;
            if (player != holder) _checkBind(seat, player);
            key = keccak256(abi.encode(STAR, holder));
        } else if (seat.kind == HUMAN) {
            _checkHuman(raidId, seat, player);
            if (lilStars.balanceOf(player) > 0) revert HolderNeedsStarSeat();
            key = keccak256(abi.encode(HUMAN, seat.humanId));
        } else {
            revert BadKind();
        }
        _bind(raidId, key, player, seat.kind, holder, seat.kind == STAR ? seat.tokenId : 0);
    }

    function _bind(uint256 raidId, bytes32 key, address player, uint8 kind, address holder, uint256 tokenId)
        internal
    {
        address bound = seatPlayer[raidId][key];
        if (bound == player) return;
        if (bound != address(0)) revert SeatTaken();
        if (playerSeat[raidId][player] != bytes32(0)) revert PlayerHasSeat();
        seatPlayer[raidId][key] = player;
        playerSeat[raidId][player] = key;
        emit SeatBound(raidId, key, player, kind, holder, tokenId); // tokenId lets the app show the Star
    }

    function _checkBind(Seat calldata seat, address player) internal view {
        if (seat.expiry < block.timestamp) revert Expired();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(BIND_TYPEHASH, seat.holder, player, seat.expiry)));
        if (!SignatureChecker.isValidSignatureNow(seat.holder, digest, seat.sig)) revert BadBind();
    }

    function _checkHuman(uint256 raidId, Seat calldata seat, address player) internal view {
        if (seat.expiry < block.timestamp) revert Expired();
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(HUMAN_TYPEHASH, player, seat.humanId, raidId, seat.expiry))
        );
        if (!SignatureChecker.isValidSignatureNow(verifier, digest, seat.sig)) revert BadHuman();
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
