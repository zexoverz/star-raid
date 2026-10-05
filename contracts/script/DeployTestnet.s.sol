// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {RaidVault, IEntropyV2} from "../src/RaidVault.sol";
import {RaidRouter} from "../src/RaidRouter.sol";
import {SeatGate} from "../src/SeatGate.sol";
import {IKuruMarginAccount} from "../src/lib/KuruBook.sol";
import {IRaidRouter, IRaidVault} from "../src/interfaces/IRaid.sol";
import {MockERC20} from "../test/utils/MockERC20.sol";
import {MockStars} from "../test/utils/MockStars.sol";

interface IKuruRouter {
    function deployProxy(
        uint8 _type,
        address _baseAssetAddress,
        address _quoteAssetAddress,
        uint96 _sizePrecision,
        uint32 _pricePrecision,
        uint32 _tickSize,
        uint96 _minSize,
        uint96 _maxSize,
        uint256 _takerFeeBps,
        uint256 _makerFeeBps,
        uint96 _kuruAmmSpread
    ) external returns (address proxy);
}

/// Monad testnet (10143): test tokens, test Lil Stars, a fresh Kuru market created through Kuru's
/// testnet Router (deployProxy, not MonadDeployer, so no AMM liquidity is seeded: the wall is the only
/// ask), and the three Star Raid contracts wired together.
///
/// forge script script/DeployTestnet.s.sol --rpc-url $MONAD_TESTNET_RPC --broadcast \
///   --account zexo-main --password-file ~/.config/dominion/testnet-keystore.pass
contract DeployTestnet is Script {
    address constant KURU_ROUTER = 0x7EFbE105Ca7415dE98F96622173458ac1c054630;
    address constant KURU_MARGIN = 0xd029C2D98ff85D8F64799017fE00a59B1159CE02;
    address constant ENTROPY = 0x825c0390f379C631f3Cf11A82a37D20BddF93c07; // Pyth Entropy, monad-testnet

    uint32 constant PRICE_PRECISION = 1e8;
    uint96 constant SIZE_PRECISION = 1e10;
    uint32 constant TICK = 100;
    uint96 constant MIN_SIZE = 1e12; // 100 tSTAR
    uint96 constant MAX_SIZE = 1e20;

    function run() external {
        require(block.chainid == 10143, "testnet only");
        address deployer = msg.sender;
        address keeper = vm.envOr("KEEPER", address(0x720633667161625FC1d7fd86DE6eC06d814a3492));
        address verifier = vm.envOr("VERIFIER", deployer);

        vm.startBroadcast();
        MockERC20 star = new MockERC20("Star Raid Test Token", "tSTAR", 18);
        MockERC20 usdc = new MockERC20("Star Raid Test USDC", "tUSDC", 6);
        MockStars stars = new MockStars();
        address market = IKuruRouter(KURU_ROUTER).deployProxy(
            0, address(star), address(usdc), SIZE_PRECISION, PRICE_PRECISION, TICK, MIN_SIZE, MAX_SIZE, 0, 0, 100
        );

        RaidVault vault = new RaidVault(deployer, IKuruMarginAccount(KURU_MARGIN), IEntropyV2(ENTROPY), keeper);
        SeatGate gate = new SeatGate(deployer, IERC721(address(stars)), verifier);
        RaidRouter router = new RaidRouter(IRaidVault(address(vault)), gate, IKuruMarginAccount(KURU_MARGIN));
        vault.setRouter(IRaidRouter(address(router)));
        vault.setMarket(market, true);
        gate.setRouter(address(router));
        vm.stopBroadcast();

        string memory j = "deploy";
        vm.serializeUint(j, "chainId", block.chainid);
        vm.serializeUint(j, "block", block.number);
        vm.serializeAddress(j, "kuruRouter", KURU_ROUTER);
        vm.serializeAddress(j, "kuruMarginAccount", KURU_MARGIN);
        vm.serializeAddress(j, "entropy", ENTROPY);
        vm.serializeAddress(j, "market", market);
        vm.serializeAddress(j, "baseToken", address(star));
        vm.serializeAddress(j, "quoteToken", address(usdc));
        vm.serializeAddress(j, "lilStars", address(stars));
        vm.serializeAddress(j, "vault", address(vault));
        vm.serializeAddress(j, "wallMakerImpl", vault.makerImpl());
        vm.serializeAddress(j, "seatGate", address(gate));
        vm.serializeAddress(j, "keeper", keeper);
        string memory out = vm.serializeAddress(j, "router", address(router));
        console2.log(out);
    }
}
