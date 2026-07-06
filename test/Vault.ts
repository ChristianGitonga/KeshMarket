import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("Vault", async function () {
  const { viem } = await network.connect();

  it("should let a user deposit and withdraw collateral", async function () {
    const [owner, user] = await viem.getWalletClients();

    // Deploy MockUSDC
    const mockUSDC = await viem.deployContract("MockUSDC");

    // Deploy Vault, pointing at MockUSDC
    const vault = await viem.deployContract("Vault", [mockUSDC.address]);

    // Give the user some mock USDC from the faucet
    await mockUSDC.write.faucet([1000n * 10n ** 18n], { account: user.account });

    // User approves the Vault to pull their tokens
    await mockUSDC.write.approve([vault.address, 500n * 10n ** 18n], {
      account: user.account,
    });

    // User deposits into the Vault
    await vault.write.deposit([500n * 10n ** 18n], { account: user.account });

    const balance = await vault.read.balanceOf([user.account.address]);
    assert.equal(balance, 500n * 10n ** 18n);

    // User withdraws half back out
    await vault.write.withdraw([200n * 10n ** 18n], { account: user.account });

    const balanceAfter = await vault.read.balanceOf([user.account.address]);
    assert.equal(balanceAfter, 300n * 10n ** 18n);
  });
});