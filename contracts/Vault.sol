// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Vault {
    using SafeERC20 for IERC20;

    IERC20 public immutable collateralToken;
    mapping(address => uint256) public balanceOf;
    mapping(address => bool) public authorizedMarkets;
    address public owner;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyAuthorizedMarket() {
        require(authorizedMarkets[msg.sender], "not authorized market");
        _;
    }

    constructor(address _collateralToken) {
        collateralToken = IERC20(_collateralToken);
        owner = msg.sender;
    }

    function setMarketAuthorization(address market, bool allowed) external onlyOwner {
        authorizedMarkets[market] = allowed;
    }

    function deposit(uint256 amount) external {
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        collateralToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // Called by PerpMarket contracts to deduct margin when opening a position
    function lockMargin(address user, uint256 amount) external onlyAuthorizedMarket {
        require(balanceOf[user] >= amount, "insufficient balance");
        balanceOf[user] -= amount;
    }

    // Called by PerpMarket contracts to return margin + PnL when closing a position
    function creditUser(address user, uint256 amount) external onlyAuthorizedMarket {
        balanceOf[user] += amount;
    }
}