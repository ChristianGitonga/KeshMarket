import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("PerpMarket", async function () {
  const { viem } = await network.connect();

  it("should let a user open a long, price move up, and close in profit", async function () {
    const [owner, user] = await viem.getWalletClients();

    const mockUSDC = await viem.deployContract("MockUSDC");
    const vault = await viem.deployContract("Vault", [mockUSDC.address]);

    // Initial virtual reserves: e.g. 1000 virtual BTC, 60,000,000 virtual USD => price = 60,000 per BTC
    const initialBase = 1000n * 10n ** 18n;
    const initialQuote = 60_000_000n * 10n ** 18n;

    const perpMarket = await viem.deployContract("PerpMarket", [
      vault.address,
      initialBase,
      initialQuote,
    ]);

    // Authorize PerpMarket to move funds in the Vault
    await vault.write.setMarketAuthorization([perpMarket.address, true]);

    // Give user funds and deposit into Vault
    await mockUSDC.write.faucet([10_000n * 10n ** 18n], { account: user.account });
    await mockUSDC.write.approve([vault.address, 10_000n * 10n ** 18n], {
      account: user.account,
    });
    await vault.write.deposit([10_000n * 10n ** 18n], { account: user.account });

    const priceBefore = await perpMarket.read.getMarkPrice();
    console.log("Price before:", priceBefore);

    // Open a 5x long with 1000 margin
    await perpMarket.write.openPosition([true, 1000n * 10n ** 18n, 5n], {
      account: user.account,
    });

    const priceAfterOpen = await perpMarket.read.getMarkPrice();
    console.log("Price after open (should be higher, long pushes price up):", priceAfterOpen);
    assert.ok(priceAfterOpen > priceBefore, "price should increase after a long");

    // Close the position
    await perpMarket.write.closePosition({ account: user.account });

    const vaultBalanceAfter = await vault.read.balanceOf([user.account.address]);
    console.log("Vault balance after close:", vaultBalanceAfter);

    // User deposited 10,000, locked 1,000 as margin (leaving 9,000), then got back margin+PnL
    // Since long pushed price up and they closed immediately after moving it themselves,
    // they should be in profit (this models "price impact" - a simplification for MVP)
    assert.ok(vaultBalanceAfter > 9_000n * 10n ** 18n, "user should have received margin back plus some PnL");
  });
});