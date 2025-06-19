// Purpose: Specialized results table for Void Relics with decision-focused analysis
// Uses RelicAnalysisCard for clear "open vs sell" decision-making

import React, { useState } from 'react';
import { VoidRelic } from '../types';
import { Filter, Zap, TrendingUp, Coins, RefreshCw, Trash2, Circle } from 'lucide-react';
import RelicAnalysisCard from './RelicAnalysisCard';
import { getRelicImagePath } from '../lib/relicUtils';

interface RelicResultsTableProps {
  results: VoidRelic[];
  isLoading?: boolean;
  onRemoveItem?: (itemName: string) => void;
  onRefreshItem?: (itemName: string) => void;
  showActionButtons?: boolean;
}

const RelicResultsTable: React.FC<RelicResultsTableProps> = ({
  results,
  isLoading = false,
  onRemoveItem,
  onRefreshItem,
  showActionButtons = false
}) => {
  const [sortField, setSortField] = useState<'highestValue' | 'name' | 'recommendation'>('highestValue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSortOptions, setShowSortOptions] = useState(false);

  const handleSort = (field: 'highestValue' | 'name' | 'recommendation') => {
    console.log(`>>> [RelicResultsTable] Sort clicked: ${field}, current: ${sortField}, direction: ${sortDirection} <<<`);

    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
    setShowSortOptions(false);

    console.log(`>>> [RelicResultsTable] Sort applied: field=${field}, direction=${sortDirection === 'asc' ? 'desc' : 'asc'} <<<`);
  };

  // Helper function to get the highest value (either sell or open)
  const getHighestValue = (relic: VoidRelic): number => {
    const openValue = relic.expectedDropValue || 0;
    const sellValue = relic.directSalePrice || 0;
    return Math.max(openValue, sellValue);
  };

  // Get recommendation config for styling
  const getRecommendationConfig = (relic: VoidRelic) => {
    switch (relic.recommendation) {
      case 'OPEN':
        return {
          bgColor: 'bg-orange-900/10',
          borderColor: 'border-orange-700/30'
        };
      case 'SELL':
        return {
          bgColor: 'bg-green-900/10',
          borderColor: 'border-green-700/30'
        };
      case 'REFINE_TO_EXCEPTIONAL':
        return {
          bgColor: 'bg-blue-900/10',
          borderColor: 'border-blue-700/30'
        };
      case 'REFINE_TO_FLAWLESS':
        return {
          bgColor: 'bg-cyan-900/10',
          borderColor: 'border-cyan-700/30'
        };
      case 'REFINE_TO_RADIANT':
        return {
          bgColor: 'bg-yellow-900/10',
          borderColor: 'border-yellow-700/30'
        };
      default:
        return {
          bgColor: 'bg-gray-800/30',
          borderColor: 'border-gray-700/30'
        };
    }
  };

  /**
   * NEW: Calculate efficiency score for investment-based sorting
   *
   * This algorithm prioritizes relics based on practical economics and resource constraints.
   * The key insight is that we need to normalize by IMPROVEMENT PER RESOURCE INVESTED:
   *
   * 1. SELL: Sort by absolute profit (immediate gain, no investment)
   *    Example: 8p profit from selling = 8p gain for 0 investment
   *
   * 2. REFINE: Sort by plat per void trace efficiency (gain per resource)
   *    Example: 11.8p gain for 175 traces = 0.067p/trace efficiency
   *    This properly accounts for void trace scarcity and investment size
   *
   * 3. OPEN: Sort by expected profit (baseline when no better option)
   *    Example: 2.4p from opening vs 0p market = 2.4p gain
   *
   * The normalization prevents skewed comparisons where a 12p refinement gain
   * requiring 200 traces incorrectly beats a 8p immediate sale requiring 0 traces.
   */
  const getEfficiencyScore = (relic: VoidRelic): number => {
    const recommendation = relic.recommendation;
    const expectedProfit = relic.expectedProfit || 0;
    const directSalePrice = relic.directSalePrice || 0;
    const expectedDropValue = relic.expectedDropValue || 0;

    console.log(`>>> [Efficiency Score] ${relic.name}: ${recommendation}, profit: ${expectedProfit}p <<<`);

    switch (recommendation) {
      case 'SELL':
        // SELL: Sort by absolute profit (no investment needed)
        // This represents immediate gain: market_price - expected_drop_value
        const sellGain = Math.abs(expectedProfit); // Use absolute value in case of negative
        const sellScore = sellGain * 1000; // High priority for immediate gains
        console.log(`>>> [Efficiency Score] SELL: ${sellGain}p gain = score ${sellScore} <<<`);
        return sellScore;

      case 'REFINE_TO_EXCEPTIONAL':
      case 'REFINE_TO_FLAWLESS':
      case 'REFINE_TO_RADIANT':
        // REFINE: Sort by plat per void trace efficiency (gain per resource invested)
        const platPerTrace = relic.refinementAnalysis?.platPerVoidTrace || 0;

        // FIX: If platPerTrace is 0 but we still have a REFINE recommendation,
        // fall back to absolute profit scoring to prevent 0 scores
        if (platPerTrace === 0 && expectedProfit > 0) {
          const fallbackScore = Math.abs(expectedProfit) * 500; // Medium priority between SELL and OPEN
          console.log(`>>> [Efficiency Score] REFINE (fallback): ${expectedProfit}p profit = score ${fallbackScore} <<<`);
          return fallbackScore;
        }

        const refinementScore = platPerTrace * 10000; // High multiplier for efficient refinements
        console.log(`>>> [Efficiency Score] REFINE: ${platPerTrace}p/trace = score ${refinementScore} <<<`);
        return refinementScore;

      case 'OPEN':
        // OPEN: Sort by expected profit (baseline priority)
        // This represents: expected_drop_value - market_price (gain from opening vs selling)
        const openGain = Math.abs(expectedProfit);
        const openScore = openGain * 100; // Lower priority than immediate sales
        console.log(`>>> [Efficiency Score] OPEN: ${openGain}p gain = score ${openScore} <<<`);
        return openScore;

      default:
        console.log(`>>> [Efficiency Score] UNKNOWN: score 0 <<<`);
        return 0;
    }
  };

  // Get refinement dot color
  const getRefinementDotColor = (rarity?: string) => {
    switch (rarity) {
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

  const sortedResults = [...results].sort((a, b) => {
    if (sortField === 'highestValue') {
      const valueA = getHighestValue(a);
      const valueB = getHighestValue(b);
      return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    } else if (sortField === 'recommendation') {
      // NEW: Sort by investment efficiency instead of fixed recommendation priority
      const efficiencyA = getEfficiencyScore(a);
      const efficiencyB = getEfficiencyScore(b);

      console.log(`>>> [RelicResultsTable] Sorting ${a.name} (${efficiencyA}) vs ${b.name} (${efficiencyB}) <<<`);

      return sortDirection === 'asc' ? efficiencyA - efficiencyB : efficiencyB - efficiencyA;
    } else {
      const result = sortDirection === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
      return result;
    }
  });

  if (isLoading && results.length === 0) {
    return (
      <div className="space-y-3 p-2 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-gray-800 rounded-lg h-24 opacity-60"></div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center p-8 m-4 border border-dashed border-gray-700 rounded-lg">
        <p className="text-gray-400">No relics detected yet.</p>
        <p className="text-sm text-gray-500 mt-1">Upload a screenshot to analyze your inventory.</p>
      </div>
    );
  }

  const getSortLabel = () => {
    const direction = sortDirection === 'asc' ? '↑' : '↓';
    switch (sortField) {
      case 'highestValue': return `Highest Value ${direction}`;
      case 'recommendation': return `Efficiency ${direction}`;
      case 'name': return `Name ${direction}`;
    }
  };

  return (
    <div className="w-full">
      {/* Sort header */}
      <div className="flex items-center justify-between p-3 bg-gray-900/50">
        <div className="text-sm text-gray-400">
          {results.length} relic{results.length !== 1 ? 's' : ''}
        </div>
        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowSortOptions(!showSortOptions);
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <Filter size={14} />
            {getSortLabel()}
          </button>

          {showSortOptions && (
            <div className="absolute right-0 top-full mt-1 bg-gray-800 rounded-lg border border-gray-700 shadow-xl z-50 min-w-36">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSort('highestValue');
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded-t-lg flex items-center gap-2"
              >
                <Zap size={12} className="text-orange-400" />
                Highest Value {sortField === 'highestValue' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSort('recommendation');
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                title="Sort by investment efficiency: SELL by profit, REFINE by plat/void trace ratio"
              >
                <TrendingUp size={12} className="text-green-400" />
                Efficiency {sortField === 'recommendation' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSort('name');
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded-b-lg flex items-center gap-2"
              >
                Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Relic cards list */}
      <div key={`${sortField}-${sortDirection}`} className="space-y-3 p-2">
        {sortedResults.map((relic) => {
          const config = getRecommendationConfig(relic);
          const refinementColor = getRefinementDotColor(relic.rarity);

          return (
            <div key={relic.id} className={`relative rounded-lg ${config.bgColor} ${config.borderColor} border`}>
              <div className="p-3">
                {/* Relic header with image, title and actions */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {/* Relic image */}
                    <div className="w-12 h-12 bg-gray-900/50 rounded-md border border-gray-700/50 flex-shrink-0 overflow-hidden">
                      <img
                        src={getRelicImagePath(relic.name, relic.rarity)}
                        alt={`${relic.name} (${relic.rarity || 'intact'})`}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          // Fallback to a default image if the specific one fails to load
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/relics/unknown.png';
                        }}
                      />
                    </div>

                    <div>
                      <h3 className="font-medium text-white text-sm leading-tight">
                        {relic.name}
                      </h3>
                      {relic.rarity && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 capitalize">
                          <Circle size={8} className={refinementColor} fill={refinementColor} />
                          {relic.rarity}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  {showActionButtons && (onRefreshItem || onRemoveItem) && (
                    <div className="flex items-center gap-2">
                      {onRefreshItem && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onRefreshItem(relic.name);
                          }}
                          disabled={relic.status === 'loading'}
                          className={`p-1.5 rounded text-sm transition-colors ${
                            relic.status === 'loading'
                              ? 'text-gray-500 cursor-not-allowed'
                              : 'text-tenno-blue hover:bg-gray-700/50'
                          }`}
                          title="Refresh analysis"
                        >
                          <RefreshCw size={14} className={relic.status === 'loading' ? 'animate-spin' : ''} />
                        </button>
                      )}
                      {onRemoveItem && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onRemoveItem(relic.name);
                          }}
                          className="p-1.5 rounded text-sm text-grineer-red hover:bg-gray-700/50 transition-colors"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Relic Analysis Card */}
                <RelicAnalysisCard
                  relic={relic}
                  onOpenMarket={() => {
                    const marketUrl = `https://warframe.market/items/${relic.name.toLowerCase().replace(/ /g, '_')}`;
                    window.open(marketUrl, '_blank', 'noopener,noreferrer');
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Click outside handlers */}
      {showSortOptions && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSortOptions(false)}
        />
      )}
    </div>
  );
};

export default RelicResultsTable;