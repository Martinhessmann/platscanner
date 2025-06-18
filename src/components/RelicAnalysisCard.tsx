// Purpose: Clear relic value analysis display focused on decision-making
// Shows "Should I open, refine, or sell?" with prominent recommendations and detailed breakdown

import React, { useState } from 'react';
import { VoidRelic } from '../types';
import {
  Zap,
  TrendingUp,
  Coins,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Dices,
  Package,
  ArrowRight
} from 'lucide-react';

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
      <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
        <div className="flex items-center gap-2 text-gray-400">
          <Dices size={16} />
          <span className="text-sm">Analysis unavailable</span>
        </div>
      </div>
    );
  }

    const hasProfit = (relic.expectedProfit || 0) > 0;
  const profitPercentage = relic.directSalePrice && relic.directSalePrice > 0
    ? Math.round(((relic.expectedDropValue - relic.directSalePrice) / relic.directSalePrice) * 100)
    : 0;

  // Helper function for better expected value display
  const formatExpectedValue = (value: number): string => {
    if (value >= 1) {
      return Math.round(value).toString();
    } else if (value >= 0.1) {
      return value.toFixed(1);
    } else if (value > 0) {
      return '< 0.1';
    } else {
      return '0';
    }
  };

  // Priority indicator based on expected value
  const getPriorityIndicator = () => {
    const expectedValue = relic.expectedDropValue || 0;
    if (expectedValue >= 5) {
      return { text: 'HIGH PRIORITY', color: 'text-green-400', bg: 'bg-green-900/30' };
    } else if (expectedValue >= 1) {
      return { text: 'MEDIUM PRIORITY', color: 'text-yellow-400', bg: 'bg-yellow-900/30' };
    } else if (expectedValue > 0.1) {
      return { text: 'LOW PRIORITY', color: 'text-blue-400', bg: 'bg-blue-900/30' };
    } else {
      return { text: 'MINIMAL VALUE', color: 'text-gray-400', bg: 'bg-gray-900/30' };
    }
  };

  const getRecommendationConfig = () => {
    switch (relic.recommendation) {
      case 'OPEN':
        return {
          action: 'OPEN',
          color: 'text-green-400',
          bgColor: 'bg-green-900/20 border-green-700/50',
          icon: <Dices size={16} className="text-green-400" />,
          description: 'Opening is more profitable than selling'
        };
      case 'SELL':
        return {
          action: 'SELL',
          color: 'text-red-400',
          bgColor: 'bg-red-900/20 border-red-700/50',
          icon: <Coins size={16} className="text-red-400" />,
          description: 'Direct sale is more profitable'
        };
      case 'REFINE_THEN_OPEN':
        return {
          action: 'REFINE → OPEN',
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-900/20 border-yellow-700/50',
          icon: <TrendingUp size={16} className="text-yellow-400" />,
          description: 'Refine to higher tier first, then open'
        };
      default:
        return {
          action: 'OPEN',
          color: 'text-gray-400',
          bgColor: 'bg-gray-900/20 border-gray-700/50',
          icon: <Dices size={16} className="text-gray-400" />,
          description: 'Analysis incomplete'
        };
    }
  };

  const config = getRecommendationConfig();

  return (
    <div className={`rounded-lg border transition-all duration-200 ${config.bgColor}`}>
      {/* Main Analysis Display */}
      <div className="p-3 space-y-3">
        {/* Expected Value vs Direct Sale */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Zap size={14} className="text-orange-400" />
              <span className="text-white font-semibold">Expected: {formatExpectedValue(relic.expectedDropValue)}p</span>
            </div>
                         {relic.directSalePrice && relic.directSalePrice > 0 && (
               <>
                 <span className="text-gray-500">vs</span>
                 <div className="flex items-center gap-1">
                   <Coins size={14} className="text-gray-400" />
                   <span className="text-gray-300">Sell: {relic.directSalePrice}p</span>
                 </div>
               </>
             )}
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

        {/* Profit Analysis */}
        {hasProfit && relic.expectedProfit !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <ArrowRight size={12} className="text-green-400" />
            <span className="text-green-400 font-medium">
              +{formatExpectedValue(relic.expectedProfit)}p profit
            </span>
            {profitPercentage > 0 && (
              <span className="text-green-400/70">
                ({profitPercentage}% gain)
              </span>
            )}
          </div>
        )}

        {/* Recommendation & Priority */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {config.icon}
            <span className={`font-semibold ${config.color}`}>
              {config.action}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              Range: {relic.minDropValue}p - {relic.maxDropValue}p
            </span>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-gray-400 hover:text-white transition-colors"
              title={showDetails ? 'Hide details' : 'Show drop details'}
            >
              {showDetails ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
        </div>

        {/* Priority Indicator */}
        <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getPriorityIndicator().bg} ${getPriorityIndicator().color}`}>
          {getPriorityIndicator().text}
        </div>

        {/* Quick Description */}
        <p className="text-xs text-gray-400">
          {config.description}
        </p>
      </div>

      {/* Detailed Drop Analysis (Expandable) */}
      {showDetails && relic.relicDrops && relic.relicDrops.length > 0 && (
        <div className="border-t border-gray-700/50 p-3 bg-gray-900/30">
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
                          drop.rarity === 'Rare' ? 'bg-yellow-500' :
                          drop.rarity === 'Uncommon' ? 'bg-blue-400' :
                          'bg-gray-500'
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
                        {drop.currentPrice || 0}p
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