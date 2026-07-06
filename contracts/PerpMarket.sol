// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IVault {
    function lockMargin(address user, uint256 amount) external;
    function creditUser(address user, uint256 amount) external;
}

contract PerpMarket {
    IVault public immutable vault;
    address public owner;

    uint256 public virtualBaseReserve;
    uint256 public virtualQuoteReserve;
    uint256 public constant k_PRECISION = 1e18;

    // Maintenance margin ratio: if a position's remaining equity falls below
    // this % of its original size, it can be liquidated. 500 = 5% (basis points / 100)
    uint256 public constant MAINTENANCE_MARGIN_BPS = 500; // 5%
    uint256 public constant LIQUIDATION_REWARD_BPS = 1000; // 10% of remaining margin goes to liquidator

    struct Position {
        bool isLong;
        uint256 margin;
        uint256 size;
        uint256 entryPrice;
        bool isOpen;
    }

    mapping(address => Position) public positions;

    event PositionOpened(address indexed user, bool isLong, uint256 margin, uint256 size, uint256 entryPrice);
    event PositionClosed(address indexed user, int256 pnl, uint256 payout);
    event PositionLiquidated(address indexed user, address indexed liquidator, uint256 reward);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address _vault, uint256 _initialBaseReserve, uint256 _initialQuoteReserve) {
        vault = IVault(_vault);
        owner = msg.sender;
        virtualBaseReserve = _initialBaseReserve;
        virtualQuoteReserve = _initialQuoteReserve;
    }

    function getMarkPrice() public view returns (uint256) {
        return (virtualQuoteReserve * k_PRECISION) / virtualBaseReserve;
    }

    function openPosition(bool isLong, uint256 margin, uint256 leverage) external {
        require(!positions[msg.sender].isOpen, "position already open");
        require(leverage >= 1 && leverage <= 20, "leverage out of range");

        vault.lockMargin(msg.sender, margin);

        uint256 size = margin * leverage;
        uint256 entryPrice = getMarkPrice();

        if (isLong) {
            uint256 quoteIn = size;
            uint256 newQuoteReserve = virtualQuoteReserve + quoteIn;
            uint256 newBaseReserve = (virtualBaseReserve * virtualQuoteReserve) / newQuoteReserve;
            virtualQuoteReserve = newQuoteReserve;
            virtualBaseReserve = newBaseReserve;
        } else {
            uint256 baseIn = (size * k_PRECISION) / entryPrice;
            uint256 newBaseReserve = virtualBaseReserve + baseIn;
            uint256 newQuoteReserve = (virtualBaseReserve * virtualQuoteReserve) / newBaseReserve;
            virtualBaseReserve = newBaseReserve;
            virtualQuoteReserve = newQuoteReserve;
        }

        positions[msg.sender] = Position({
            isLong: isLong,
            margin: margin,
            size: size,
            entryPrice: entryPrice,
            isOpen: true
        });

        emit PositionOpened(msg.sender, isLong, margin, size, entryPrice);
    }

    // Calculates current PnL for a position without closing it
    function getPnl(address user) public view returns (int256) {
        Position memory pos = positions[user];
        if (!pos.isOpen) return 0;

        uint256 currentPrice = getMarkPrice();
        int256 priceDelta = int256(currentPrice) - int256(pos.entryPrice);

        if (pos.isLong) {
            return (priceDelta * int256(pos.size)) / int256(pos.entryPrice);
        } else {
            return (-priceDelta * int256(pos.size)) / int256(pos.entryPrice);
        }
    }

    // Returns remaining equity = margin + pnl (can be negative in theory, floored at 0 here)
    function getEquity(address user) public view returns (uint256) {
        Position memory pos = positions[user];
        if (!pos.isOpen) return 0;

        int256 pnl = getPnl(user);
        int256 equity = int256(pos.margin) + pnl;
        return equity > 0 ? uint256(equity) : 0;
    }

    // A position is liquidatable if equity falls below the maintenance margin
    // requirement relative to its size
    function isLiquidatable(address user) public view returns (bool) {
        Position memory pos = positions[user];
        if (!pos.isOpen) return false;

        uint256 equity = getEquity(user);
        uint256 maintenanceRequirement = (pos.size * MAINTENANCE_MARGIN_BPS) / 10000;

        return equity < maintenanceRequirement;
    }

    // Approximate liquidation price for a position - useful for your heatmap!
    function getLiquidationPrice(address user) public view returns (uint256) {
        Position memory pos = positions[user];
        if (!pos.isOpen) return 0;

        uint256 maintenanceRequirement = (pos.size * MAINTENANCE_MARGIN_BPS) / 10000;
        // How much loss (in quote terms) can be absorbed before hitting maintenance margin
        uint256 maxLoss = pos.margin > maintenanceRequirement ? pos.margin - maintenanceRequirement : 0;
        uint256 priceMove = (maxLoss * pos.entryPrice) / pos.size;

        if (pos.isLong) {
            return pos.entryPrice > priceMove ? pos.entryPrice - priceMove : 0;
        } else {
            return pos.entryPrice + priceMove;
        }
    }

    function closePosition() external {
        Position memory pos = positions[msg.sender];
        require(pos.isOpen, "no open position");

        uint256 payout = getEquity(msg.sender);
        int256 pnl = getPnl(msg.sender);

        delete positions[msg.sender];

        if (payout > 0) {
            vault.creditUser(msg.sender, payout);
        }

        emit PositionClosed(msg.sender, pnl, payout);
    }

    // Anyone can call this to liquidate an undercollateralized position and earn a reward
    function liquidate(address user) external {
        require(isLiquidatable(user), "position not liquidatable");

        uint256 equity = getEquity(user);

        uint256 reward = (equity * LIQUIDATION_REWARD_BPS) / 10000;
        uint256 remainder = equity - reward;

        delete positions[user];

        if (remainder > 0) {
            vault.creditUser(user, remainder);
        }
        if (reward > 0) {
            vault.creditUser(msg.sender, reward);
        }

        emit PositionLiquidated(user, msg.sender, reward);
    }
}