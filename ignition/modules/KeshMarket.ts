import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("KeshMarketModule", (m) => {
  // Deploy the collateral token
  const mockUSDC = m.contract("MockUSDC");

  // Deploy the Vault, pointing at MockUSDC
  const vault = m.contract("Vault", [mockUSDC]);

  // Market 1: SCOM-PERP (Safaricom synthetic) - starting price ~60,000 (scaled units)
  const scomBase = 1000n * 10n ** 18n;
  const scomQuote = 60_000_000n * 10n ** 18n;
  const scomMarket = m.contract("PerpMarket", [vault, scomBase, scomQuote], {
    id: "ScomMarket",
  });

  // Market 2: EQTY-PERP (Equity Group synthetic) - starting price ~45,000 (scaled units)
  const eqtyBase = 1000n * 10n ** 18n;
  const eqtyQuote = 45_000_000n * 10n ** 18n;
  const eqtyMarket = m.contract("PerpMarket", [vault, eqtyBase, eqtyQuote], {
    id: "EqtyMarket",
  });

  // Authorize both markets to move funds in the Vault
  m.call(vault, "setMarketAuthorization", [scomMarket, true], {
    id: "AuthorizeScom",
  });
  m.call(vault, "setMarketAuthorization", [eqtyMarket, true], {
    id: "AuthorizeEqty",
  });

  return { mockUSDC, vault, scomMarket, eqtyMarket };
});