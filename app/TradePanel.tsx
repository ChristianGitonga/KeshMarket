"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useState } from "react";
import PerpMarketArtifact from "../contracts/PerpMarket.json";
import { MARKETS } from "../contracts/addresses";

export function TradePanel() {
  const { address, isConnected } = useAccount();
  const [marketIndex, setMarketIndex] = useState(0);
  const [margin, setMargin] = useState("50");
  const [leverage, setLeverage] = useState(5);

  const market = MARKETS[marketIndex];
  const marketAddress = market.address as `0x${string}`;

  const { data: markPrice } = useReadContract({
    address: marketAddress,
    abi: PerpMarketArtifact.abi,
    functionName: "getMarkPrice",
    query: { refetchInterval: 3000 },
  });

  const { data: position } = useReadContract({
    address: marketAddress,
    abi: PerpMarketArtifact.abi,
    functionName: "positions",
    args: [address],
    query: { enabled: !!address, refetchInterval: 3000 },
  });

  const { data: pnl } = useReadContract({
    address: marketAddress,
    abi: PerpMarketArtifact.abi,
    functionName: "getPnl",
    args: [address],
    query: { enabled: !!address, refetchInterval: 3000 },
  });

  const { data: liquidationPrice } = useReadContract({
    address: marketAddress,
    abi: PerpMarketArtifact.abi,
    functionName: "getLiquidationPrice",
    args: [address],
    query: { enabled: !!address, refetchInterval: 3000 },
  });

  const { writeContract: openPosition, data: openHash } = useWriteContract();
  const { isLoading: openPending } = useWaitForTransactionReceipt({ hash: openHash });

  const { writeContract: closePosition, data: closeHash } = useWriteContract();
  const { isLoading: closePending } = useWaitForTransactionReceipt({ hash: closeHash });

  const isPositionOpen = position ? (position as unknown[])[4] === true : false;

  const handleOpen = (isLong: boolean) => {
    const marginAmount = BigInt(Math.floor(Number(margin) * 1e18));
    openPosition({
      address: marketAddress,
      abi: PerpMarketArtifact.abi,
      functionName: "openPosition",
      args: [isLong, marginAmount, BigInt(leverage)],
    });
  };

  const handleClose = () => {
    closePosition({
      address: marketAddress,
      abi: PerpMarketArtifact.abi,
      functionName: "closePosition",
      args: [],
    });
  };

  const formatUsd = (val: unknown) => {
    if (val === undefined) return "0.00";
    return (Number(val as bigint) / 1e18).toFixed(2);
  };

  const formatPnl = (val: unknown) => {
    if (val === undefined) return "0.00";
    const num = Number(val as bigint) / 1e18;
    return num >= 0 ? `+${num.toFixed(2)}` : num.toFixed(2);
  };

  if (!isConnected) {
    return <p className="text-center text-[#8B9198] font-body">Connect your wallet to trade.</p>;
  }

  return (
    <div className="w-full max-w-md kesh-card p-6">
      <div className="flex gap-2 mb-5">
        {MARKETS.map((m, i) => (
          <button
            key={m.id}
            onClick={() => setMarketIndex(i)}
            className={`flex-1 px-3 py-2 text-sm font-body font-medium rounded border transition-colors ${
              i === marketIndex
                ? "bg-[#C9A24B] text-[#0F1113] border-[#C9A24B]"
                : "bg-[#0F1113] text-[#8B9198] border-[#2A2E33] hover:border-[#C9A24B]"
            }`}
          >
            {m.symbol}
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center mb-5 pb-5 border-b border-[#2A2E33]">
        <div>
          <span className="font-display text-sm font-semibold tracking-wide text-[#8B9198] uppercase block mb-1">
            {market.symbol}
          </span>
          <span className="text-xs text-[#8B9198] font-body">{market.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="pulse-dot" />
          <span className="font-mono text-xl text-[#EDEAE2]">${formatUsd(markPrice)}</span>
        </div>
      </div>

      {isPositionOpen ? (
        <div>
          <div className="flex justify-between text-sm mb-3">
            <span className="text-[#8B9198] font-body">Side</span>
            <span
              className={`font-mono font-semibold ${
                (position as unknown[])[0] ? "text-[#1E7F4C]" : "text-[#A2222E]"
              }`}
            >
              {(position as unknown[])[0] ? "LONG" : "SHORT"}
            </span>
          </div>
          <div className="flex justify-between text-sm mb-3">
            <span className="text-[#8B9198] font-body">Entry Price</span>
            <span className="font-mono text-[#EDEAE2]">${formatUsd((position as unknown[])[3])}</span>
          </div>
          <div className="flex justify-between text-sm mb-3">
            <span className="text-[#8B9198] font-body">Liquidation Price</span>
            <span className="font-mono text-[#C9A24B]">${formatUsd(liquidationPrice)}</span>
          </div>
          <div className="flex justify-between text-sm mb-5 pb-5 border-b border-[#2A2E33]">
            <span className="text-[#8B9198] font-body">Unrealized PnL</span>
            <span className={`font-mono font-semibold ${Number(pnl) >= 0 ? "text-[#1E7F4C]" : "text-[#A2222E]"}`}>
              ${formatPnl(pnl)}
            </span>
          </div>
          <button
            onClick={handleClose}
            disabled={closePending}
            className="w-full px-4 py-2.5 font-body text-sm font-medium bg-[#181B1F] border border-[#2A2E33] text-[#EDEAE2] rounded hover:border-[#A2222E] hover:text-[#A2222E] transition-colors disabled:opacity-50"
          >
            {closePending ? "Closing..." : "Close Position"}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-5">
            <label className="flex justify-between text-sm mb-2">
              <span className="text-[#8B9198] font-body">Margin</span>
              <span className="font-mono text-[#EDEAE2]">{margin} mUSDC</span>
            </label>
            <input
              type="number"
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
              className="w-full px-3 py-2.5 font-mono text-sm bg-[#0F1113] border border-[#2A2E33] rounded text-[#EDEAE2] focus:outline-none focus:border-[#C9A24B]"
            />
          </div>

          <div className="mb-6">
            <label className="flex justify-between text-sm mb-2">
              <span className="text-[#8B9198] font-body">Leverage</span>
              <span className="font-mono text-[#C9A24B] font-semibold">{leverage}x</span>
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full accent-[#C9A24B]"
            />
            <div className="flex justify-between text-xs font-mono text-[#8B9198] mt-1">
              <span>1x</span>
              <span>20x</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleOpen(true)}
              disabled={openPending}
              className="flex-1 px-4 py-3 font-body font-semibold bg-[#1E7F4C] hover:bg-[#25955a] text-white rounded transition-colors disabled:opacity-50"
            >
              {openPending ? "Opening..." : "Long"}
            </button>
            <button
              onClick={() => handleOpen(false)}
              disabled={openPending}
              className="flex-1 px-4 py-3 font-body font-semibold bg-[#A2222E] hover:bg-[#b8323e] text-white rounded transition-colors disabled:opacity-50"
            >
              {openPending ? "Opening..." : "Short"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}