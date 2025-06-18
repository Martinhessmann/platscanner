// Purpose: Specialized results table for Void Relics with decision-focused analysis
// Uses RelicAnalysisCard for clear "open vs sell" decision-making

import React, { useState } from 'react';
import { VoidRelic } from '../types';
import { Filter, Zap, TrendingUp, Coins, MoreVertical, RefreshCw, Trash2 } from 'lucide-react';
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
  const [sortField, setSortField] = useState<'expectedValue' | 'name' | 'recommendation'>('expectedValue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);

  const handleSort = (field: 'expectedValue' | 'name' | 'recommendation') => {
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

  const sortedResults = [...results].sort((a, b) => {
    if (sortField === 'expectedValue') {
      const valueA = a.expectedDropValue || 0;
      const valueB = b.expectedDropValue || 0;
      return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    } else if (sortField === 'recommendation') {
      const getRecommendationOrder = (rec?: string) => {
        switch (rec) {
          case 'OPEN': return 1;
          case 'REFINE_THEN_OPEN': return 2;
          case 'SELL': return 3;
          default: return 4;
        }
      };
      const orderA = getRecommendationOrder(a.recommendation);
      const orderB = getRecommendationOrder(b.recommendation);
      return sortDirection === 'asc' ? orderA - orderB : orderB - orderA;
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
      case 'expectedValue': return `Expected ${direction}`;
      case 'recommendation': return `Action ${direction}`;
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
                  handleSort('expectedValue');
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded-t-lg flex items-center gap-2"
              >
                <Zap size={12} className="text-orange-400" />
                Expected {sortField === 'expectedValue' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSort('recommendation');
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
              >
                <TrendingUp size={12} className="text-green-400" />
                Action {sortField === 'recommendation' && (sortDirection === 'asc' ? '↑' : '↓')}
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
        {sortedResults.map((relic) => (
          <div key={relic.id} className="relative">
            <div className="flex items-stretch gap-2">
              {/* Relic image */}
              <div className="w-16 h-16 bg-gray-900 rounded-lg border border-gray-700 flex-shrink-0 overflow-hidden">
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

              {/* Relic info and analysis */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-white text-sm leading-tight truncate">
                      {relic.name}
                    </h3>
                    {relic.rarity && (
                      <span className="text-xs text-gray-400 capitalize">
                        {relic.rarity}
                      </span>
                    )}
                  </div>

                  {/* Action menu */}
                  {showActionButtons && (onRefreshItem || onRemoveItem) && (
                    <div className="relative flex-shrink-0 ml-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveActionMenu(activeActionMenu === relic.id ? null : relic.id);
                        }}
                        className="p-1 rounded text-gray-400 hover:text-white transition-colors"
                        title="Actions"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {activeActionMenu === relic.id && (
                        <div className="absolute right-0 top-full mt-1 bg-gray-800 rounded-lg border border-gray-700 shadow-xl z-50 min-w-32">
                          {onRefreshItem && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onRefreshItem(relic.name);
                                setActiveActionMenu(null);
                              }}
                              disabled={relic.status === 'loading'}
                              className={`w-full text-left px-3 py-2 text-sm rounded-t-lg flex items-center gap-2 transition-colors ${
                                relic.status === 'loading'
                                  ? 'text-gray-500 cursor-not-allowed'
                                  : 'text-tenno-blue hover:bg-gray-700'
                              }`}
                            >
                              <RefreshCw size={12} className={relic.status === 'loading' ? 'animate-spin' : ''} />
                              Refresh analysis
                            </button>
                          )}
                          {onRemoveItem && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onRemoveItem(relic.name);
                                setActiveActionMenu(null);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-grineer-red hover:bg-gray-700 rounded-b-lg flex items-center gap-2 transition-colors"
                            >
                              <Trash2 size={12} />
                              Remove
                            </button>
                          )}
                        </div>
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
          </div>
        ))}
      </div>

      {/* Click outside handlers */}
      {showSortOptions && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSortOptions(false)}
        />
      )}

      {activeActionMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setActiveActionMenu(null)}
        />
      )}
    </div>
  );
};

export default RelicResultsTable;