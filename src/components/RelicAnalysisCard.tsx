// Purpose: Clear relic value analysis display focused on decision-making
// Shows "Should I open, refine, or sell?" with prominent recommendations and detailed breakdown

import React, { useState } from 'react';
import { VoidRelic } from '../types';
import {
  Zap,
  Coins,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Dices,
  Package,
  Circle
} from 'lucide-react';
import { getRelicImagePath } from '../lib/relicUtils';

interface RelicAnalysisCardProps {
  relic: VoidRelic;
  onOpenMarket?: () => void;
}

const RelicAnalysisCard: React.FC<RelicAnalysisCardProps> = ({
  relic,
  onOpenMarket
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Early return if no analysis data
  if (!relic.expectedDropValue || !relic.recommendation) {
    return (
      <div className="bg-gray-800/30 rounded-lg p-3">
        <div className="flex items-center gap-2 text-gray-400">
          <Dices size={16} />
          <span className="text-sm">Analysis unavailable</span>
        </div>
      </div>
    );
  }

  // Improved helper function for better expected value display with proper precision
  const formatExpectedValue = (value: number): string => {
    if (value >= 10) {
      return value.toFixed(1); // e.g., "12.5p"
    } else if (value >= 1) {
      return value.toFixed(1); // e.g., "3.2p"
    } else if (value >= 0.1) {
      return value.toFixed(2); // e.g., "0.65p"
    } else if (value > 0) {
      return '< 0.1'; // For very small amounts
    } else {
      return '0';
    }
  };

  const getRecommendationConfig = () => {
    switch (relic.recommendation) {
      case 'OPEN':
        return {
          action: 'OPEN',
          color: 'text-orange-400',
          bgColor: 'bg-orange-900/20',
          icon: <Dices size={16} className="text-orange-400" />
        };
      case 'SELL':
        return {
          action: 'SELL',
          color: 'text-green-400',
          bgColor: 'bg-green-900/20',
          icon: <Coins size={16} className="text-green-400" />
        };
      case 'REFINE_THEN_OPEN':
        return {
          action: 'OPEN',
          color: 'text-orange-400',
          bgColor: 'bg-orange-900/20',
          icon: <Dices size={16} className="text-orange-400" />
        };
      default:
        return {
          action: 'OPEN',
          color: 'text-gray-400',
          bgColor: 'bg-gray-900/20',
          icon: <Dices size={16} className="text-gray-400" />
        };
    }
  };

  // Get the highest value (either sell or open)
  const getHighestValue = (): number => {
    const openValue = relic.expectedDropValue || 0;
    const sellValue = relic.directSalePrice || 0;
    return Math.max(openValue, sellValue);
  };

  const config = getRecommendationConfig();
  const highestValue = getHighestValue();

  // Calculate profit or loss
  const calculateProfitDisplay = () => {
    if (!relic.directSalePrice || relic.directSalePrice === 0) {
      return null; // No market price to compare
    }

    const diff = (relic.expectedDropValue || 0) - relic.directSalePrice;

    if (relic.recommendation === 'SELL') {
      // If selling is recommended, show the profit in green
      return (
        <span className="text-green-400 font-medium">
          +{formatExpectedValue(Math.abs(diff))}p
        </span>
      );
    } else {
      // If opening is recommended, show the expected gain in orange
      return (
        <span className="text-orange-400 font-medium">
          -{formatExpectedValue(Math.abs(diff))}p
        </span>
      );
    }
  };

  // Get refinement dot color
  const getRefinementDotColor = () => {
    switch (relic.rarity) {
      case 'radiant':
        return 'text-yellow-400';
      case 'flawless':
        return 'text-blue-400';
      case 'exceptional':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div>
      {/* Main Analysis Display */}
      <div className="space-y-3">
        {/* Combined Value Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {relic.recommendation === 'SELL' ? (
              <Coins size={14} className="text-green-400" />
            ) : (
              <Zap size={14} className="text-orange-400" />
            )}
            <span className="text-white font-medium">
              {relic.recommendation === 'SELL'
                ? `Market: ${relic.directSalePrice}p vs Items: ${formatExpectedValue(relic.expectedDropValue)}p`
                : `Items: ${formatExpectedValue(relic.expectedDropValue)}p vs Market: ${relic.directSalePrice || 0}p`}
              {calculateProfitDisplay() && (
                <span className="ml-1">({calculateProfitDisplay()})</span>
              )}
            </span>
          </div>

          {onOpenMarket && (
            <button
              onClick={onOpenMarket}
              className="text-tenno-blue hover:text-tenno-light p-1"
              title="View on Warframe Market"
            >
              <ExternalLink size={14} />
            </button>
          )}
        </div>

        {/* Range as main action */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={`w-full flex items-center justify-between p-2 rounded transition-colors ${config.bgColor} hover:bg-opacity-70`}
        >
          <div className="flex items-center gap-2">
            {config.icon}
            <span className={`font-semibold ${config.color}`}>
              {config.action}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-300">
              Range: {formatExpectedValue(relic.minDropValue || 0)}p - {formatExpectedValue(relic.maxDropValue || 0)}p
            </span>
            {showDetails ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </button>
      </div>

      {/* Detailed Drop Analysis (Expandable) */}
      {showDetails && relic.relicDrops && relic.relicDrops.length > 0 && (
        <div className="border-t border-gray-700/50 p-3 bg-gray-900/30 mt-3 rounded-b">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Package size={14} />
              Drop Analysis
            </h4>
            <div className="space-y-1">
              {relic.relicDrops
                .sort((a, b) => (b.currentPrice || 0) - (a.currentPrice || 0))
                .map((drop, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-xs py-1"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          drop.rarity === 'Rare' ? 'bg-yellow-400' : // 🥇 Gold for Rare
                          drop.rarity === 'Uncommon' ? 'bg-slate-400' : // 🥈 Silver for Uncommon
                          'bg-amber-700' // 🥉 Bronze for Common
                        }`}
                      />
                      <span className="text-gray-300 truncate max-w-32">
                        {drop.itemName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <span className="text-gray-400">
                        {drop.dropChance}%
                      </span>
                      <span className="text-white font-medium min-w-8">
                        {drop.currentPrice ? formatExpectedValue(drop.currentPrice) + 'p' : 'no buyers'}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
            <div className="pt-2 border-t border-gray-700/30 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>Weighted Expected Value:</span>
                <span className="text-orange-400 font-medium">
                  {formatExpectedValue(relic.expectedDropValue)}p
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelicAnalysisCard;