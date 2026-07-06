import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("Liquidation", async function () {
  const { viem } = await network.connect();

  it("should allow liquidation of an underwater position", async function () {
    const [owner, user, liquidator, priceMover] = await viem.getWalletClients();

    const mockUSDC = await viem.deployContract("MockUSDC");
    const vault = await viem.deployContract("Vault", [mockUSDC.address]);

    const initialBase = 1000n * 10n ** 18n;
    const initialQuote = 60_000_000n * 10n ** 18n;

    const perpMarket = await viem.deployContract("PerpMarket", [
      vault.address,
      initialBase,
      initialQuote,
    ]);

    await vault.write.setMarketAuthorization([perpMarket.address, true]);

    // Fund the user and open a highly leveraged long (20x - thin safety margin)
    await mockUSDC.write.faucet([10_000n * 10n ** 18n], { account: user.account });
    await mockUSDC.write.approve([vault.address, 10_000n * 10n ** 18n], { account: user.account });
    await vault.write.deposit([10_000n * 10n ** 18n], { account: user.account });

    await perpMarket.write.openPosition([true, 1000n * 10n ** 18n, 20n], {
      account: user.account,
    });

    console.log("Liquidatable right after opening?", await perpMarket.read.isLiquidatable([user.account.address]));
    console.log("Liquidation price:", await perpMarket.read.getLiquidationPrice([user.account.address]));

    // Fund a second trader who will push the price DOWN hard by opening a big short
    await mockUSDC.write.faucet([50_000n * 10n ** 18n], { account: priceMover.account });
    await mockUSDC.write.approve([vault.address, 50_000n * 10n ** 18n], { account: priceMover.account });
    await vault.write.deposit([50_000n * 10n ** 18n], { account: priceMover.account });

    await perpMarket.write.openPosition([false, 40_000n * 10n ** 18n, 15n], {
      account: priceMover.account,
    });

    const isLiquidatableNow = await perpMarket.read.isLiquidatable([user.account.address]);
    console.log("Liquidatable after price crash?", isLiquidatableNow);
    assert.equal(isLiquidatableNow, true, "user's long position should now be liquidatable");

    // Liquidator (a third party) calls liquidate and earns a reward
    const liquidatorVaultBefore = await vault.read.balanceOf([liquidator.account.address]);

    await perpMarket.write.liquidate([user.account.address], {
      account: liquidator.account,
    });

    const liquidatorVaultAfter = await vault.read.balanceOf([liquidator.account.address]);
    console.log("Liquidator reward:", liquidatorVaultAfter - liquidatorVaultBefore);

    assert.ok(liquidatorVaultAfter > liquidatorVaultBefore, "liquidator should have earned a reward");

    // Position should no longer exist
    const positionAfter = await perpMarket.read.positions([user.account.address]);
    assert.equal(positionAfter[4], false, "position should be closed after liquidation");
  });
});