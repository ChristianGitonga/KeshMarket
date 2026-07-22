import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("PredictionMarket", async function () {
  const { viem } = await network.connect();

  it("should let users buy shares, resolve the market, and redeem winnings", async function () {
    const [owner, alice, bob] = await viem.getWalletClients();

    const mockUSDC = await viem.deployContract("MockUSDC");

    const initialLiquidity = 10_000n * 10n ** 18n;
    const market = await viem.deployContract("PredictionMarket", [
      mockUSDC.address,
      "Will KES weaken past 145/USD by year end?",
      initialLiquidity,
    ]);

    // Fund Alice and Bob
    await mockUSDC.write.faucet([5_000n * 10n ** 18n], { account: alice.account });
    await mockUSDC.write.faucet([5_000n * 10n ** 18n], { account: bob.account });

    // Check starting odds - should be 50/50
    const yesPriceBefore = await market.read.getYesPrice();
    console.log("YES price before any trades (should be ~0.5e18):", yesPriceBefore);

    // Alice buys YES shares
    await mockUSDC.write.approve([market.address, 1_000n * 10n ** 18n], { account: alice.account });
    await market.write.buyShares([true, 1_000n * 10n ** 18n], { account: alice.account });

    const yesPriceAfter = await market.read.getYesPrice();
    console.log("YES price after Alice buys YES (should be > 0.5e18):", yesPriceAfter);
    assert.ok(yesPriceAfter > yesPriceBefore, "YES price should increase after YES shares are bought");

    // Bob buys NO shares
    await mockUSDC.write.approve([market.address, 500n * 10n ** 18n], { account: bob.account });
    await market.write.buyShares([false, 500n * 10n ** 18n], { account: bob.account });

    const aliceYesShares = await market.read.yesShares([alice.account.address]);
    console.log("Alice's YES shares:", aliceYesShares);
    assert.ok(aliceYesShares > 0n, "Alice should have received YES shares");

    // Admin resolves the market as YES
    await market.write.resolveMarket([true], { account: owner.account });

    const isResolved = await market.read.resolved();
    assert.equal(isResolved, true, "market should be resolved");

    // Alice redeems her winning YES shares
    const aliceBalanceBefore = await mockUSDC.read.balanceOf([alice.account.address]);
    await market.write.redeem({ account: alice.account });
    const aliceBalanceAfter = await mockUSDC.read.balanceOf([alice.account.address]);

    console.log("Alice's payout:", aliceBalanceAfter - aliceBalanceBefore);
    assert.ok(aliceBalanceAfter > aliceBalanceBefore, "Alice should receive a payout for winning shares");

    // Bob (NO shares, wrong outcome) should have nothing to redeem
    await assert.rejects(
      market.write.redeem({ account: bob.account }),
      /nothing to redeem/,
      "Bob should not be able to redeem losing shares"
    );
  });
});