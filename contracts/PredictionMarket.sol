// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title PredictionMarket
/// @notice A single binary (YES/NO) prediction market using a constant-product
/// market maker (CPMM), similar in spirit to early Augur/Polymarket designs.
contract PredictionMarket {
    using SafeERC20 for IERC20;

    IERC20 public immutable collateralToken;
    address public immutable admin;

    string public question;
    uint256 public constant PRECISION = 1e18;

    // Virtual share reserves for the CPMM
    uint256 public yesReserve;
    uint256 public noReserve;

    // User share balances
    mapping(address => uint256) public yesShares;
    mapping(address => uint256) public noShares;

    enum Outcome {
        Unresolved,
        Yes,
        No
    }
    Outcome public outcome;
    bool public resolved;

    event SharesPurchased(address indexed user, bool isYes, uint256 amountIn, uint256 sharesOut);
    event MarketResolved(Outcome outcome);
    event Redeemed(address indexed user, uint256 amount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    modifier notResolved() {
        require(!resolved, "market already resolved");
        _;
    }

    constructor(
        address _collateralToken,
        string memory _question,
        uint256 _initialLiquidity
    ) {
        collateralToken = IERC20(_collateralToken);
        admin = msg.sender;
        question = _question;

        // Seed both reserves equally, implying a starting 50/50 probability
        yesReserve = _initialLiquidity;
        noReserve = _initialLiquidity;
    }

    /// @notice Current implied probability of YES, scaled to 1e18 (e.g. 0.5e18 = 50%)
    function getYesPrice() public view returns (uint256) {
        return (noReserve * PRECISION) / (yesReserve + noReserve);
    }

    /// @notice Current implied probability of NO, scaled to 1e18
    function getNoPrice() public view returns (uint256) {
        return (yesReserve * PRECISION) / (yesReserve + noReserve);
    }

    /// @notice Buy YES or NO shares by depositing collateral
    function buyShares(bool isYes, uint256 amountIn) external notResolved {
        require(amountIn > 0, "amount must be positive");
        collateralToken.safeTransferFrom(msg.sender, address(this), amountIn);

        if (isYes) {
            // Buying YES: amountIn goes into noReserve side (paying with the "other" side),
            // shares out come from yesReserve shrinking, following x*y=k
            uint256 newNoReserve = noReserve + amountIn;
            uint256 newYesReserve = (yesReserve * noReserve) / newNoReserve;
            uint256 sharesOut = yesReserve - newYesReserve;

            yesReserve = newYesReserve;
            noReserve = newNoReserve;
            yesShares[msg.sender] += sharesOut;

            emit SharesPurchased(msg.sender, true, amountIn, sharesOut);
        } else {
            uint256 newYesReserve = yesReserve + amountIn;
            uint256 newNoReserve = (yesReserve * noReserve) / newYesReserve;
            uint256 sharesOut = noReserve - newNoReserve;

            yesReserve = newYesReserve;
            noReserve = newNoReserve;
            noShares[msg.sender] += sharesOut;

            emit SharesPurchased(msg.sender, false, amountIn, sharesOut);
        }
    }

    /// @notice Admin resolves the market once the real-world outcome is known
    function resolveMarket(bool isYes) external onlyAdmin notResolved {
        outcome = isYes ? Outcome.Yes : Outcome.No;
        resolved = true;
        emit MarketResolved(outcome);
    }

    /// @notice Winning shareholders redeem their shares 1:1 for collateral
    function redeem() external {
        require(resolved, "market not resolved yet");

        uint256 payout;
        if (outcome == Outcome.Yes) {
            payout = yesShares[msg.sender];
            yesShares[msg.sender] = 0;
        } else {
            payout = noShares[msg.sender];
            noShares[msg.sender] = 0;
        }

        require(payout > 0, "nothing to redeem");
        collateralToken.safeTransfer(msg.sender, payout);
        emit Redeemed(msg.sender, payout);
    }
}