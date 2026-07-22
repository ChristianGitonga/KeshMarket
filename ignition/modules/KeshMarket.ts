import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("KeshMarketModule", (m) => {
  // Deploy the collateral token
  const mockUSDC = m.contract("MockUSDC");

  // Deploy the Vault, pointing at MockUSDC
  const vault = m.contract("Vault", [mockUSDC]);

  // --- Perpetual markets ---
  // Each is seeded with 1000 virtual base reserve; quote reserve sets the starting price.

  const scomMarket = m.contract(
    "PerpMarket",
    [vault, 1000n * 10n ** 18n, 60_000_000n * 10n ** 18n],
    { id: "ScomMarket" }
  );
  const eqtyMarket = m.contract(
    "PerpMarket",
    [vault, 1000n * 10n ** 18n, 45_000_000n * 10n ** 18n],
    { id: "EqtyMarket" }
  );
  const kcbMarket = m.contract(
    "PerpMarket",
    [vault, 1000n * 10n ** 18n, 38_000_000n * 10n ** 18n],
    { id: "KcbMarket" }
  );
  const eablMarket = m.contract(
    "PerpMarket",
    [vault, 1000n * 10n ** 18n, 150_000_000n * 10n ** 18n],
    { id: "EablMarket" }
  );
  const coopMarket = m.contract(
    "PerpMarket",
    [vault, 1000n * 10n ** 18n, 12_000_000n * 10n ** 18n],
    { id: "CoopMarket" }
  );
  const batMarket = m.contract(
    "PerpMarket",
    [vault, 1000n * 10n ** 18n, 380_000_000n * 10n ** 18n],
    { id: "BatMarket" }
  );

  // Authorize every market to move funds in the Vault
  m.call(vault, "setMarketAuthorization", [scomMarket, true], { id: "AuthorizeScom" });
  m.call(vault, "setMarketAuthorization", [eqtyMarket, true], { id: "AuthorizeEqty" });
  m.call(vault, "setMarketAuthorization", [kcbMarket, true], { id: "AuthorizeKcb" });
  m.call(vault, "setMarketAuthorization", [eablMarket, true], { id: "AuthorizeEabl" });
  m.call(vault, "setMarketAuthorization", [coopMarket, true], { id: "AuthorizeCoop" });
  m.call(vault, "setMarketAuthorization", [batMarket, true], { id: "AuthorizeBat" });

  // --- Prediction markets ---
  // Each seeded with 10,000 virtual liquidity per side (50/50 starting odds)
  const predictionLiquidity = 10_000n * 10n ** 18n;

  const kesUsdMarket = m.contract(
    "PredictionMarket",
    [mockUSDC, "Will the Kenya Shilling weaken past 145/USD by year end?", predictionLiquidity],
    { id: "KesUsdMarket" }
  );
  const cbkRateMarket = m.contract(
    "PredictionMarket",
    [mockUSDC, "Will the CBK cut the base lending rate this quarter?", predictionLiquidity],
    { id: "CbkRateMarket" }
  );
  const rainfallMarket = m.contract(
    "PredictionMarket",
    [mockUSDC, "Will Nairobi receive above-average rainfall this season?", predictionLiquidity],
    { id: "RainfallMarket" }
  );
  const inflationMarket = m.contract(
    "PredictionMarket",
    [mockUSDC, "Will Kenya's inflation rate fall below 5% by year end?", predictionLiquidity],
    { id: "InflationMarket" }
  );
  const scomPriceMarket = m.contract(
    "PredictionMarket",
    [mockUSDC, "Will Safaricom's share price close above KES 20 this quarter?", predictionLiquidity],
    { id: "ScomPriceMarket" }
  );
  const nseIndexMarket = m.contract(
    "PredictionMarket",
    [mockUSDC, "Will the NSE 20 Share Index close the year above 2,000 points?", predictionLiquidity],
    { id: "NseIndexMarket" }
  );

  return {
    mockUSDC,
    vault,
    scomMarket,
    eqtyMarket,
    kcbMarket,
    eablMarket,
    coopMarket,
    batMarket,
    kesUsdMarket,
    cbkRateMarket,
    rainfallMarket,
    inflationMarket,
    scomPriceMarket,
    nseIndexMarket,
  };
});