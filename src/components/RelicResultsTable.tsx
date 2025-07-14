// Purpose: Trading platform-style table for Void Relics with comprehensive refinement analysis
// Shows all refinement levels and market comparison in a data-dense table format

import React, { useState, useEffect, useRef } from 'react';
import { VoidRelic } from '../types';
import { Filter, TrendingUp, RefreshCw, Trash2, Circle, ExternalLink, Zap, MessageCircle, Info, X, AlertCircle, Check, Shield, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { getRelicImagePath } from '../lib/relicUtils';
import { getRelicDropsByName } from '../services/relicDataService';
import { isItemReserved } from '../services/buildPlanService';
import PortalModal from './PortalModal';

interface RelicResultsTableProps {
  results: VoidRelic[];
  isLoading?: boolean;
  onRemoveItem?: (itemName: string) => void;
  onRefreshItem?: (itemName: string) => void;
  showActionButtons?: boolean;
}

interface RelicAnalysis {
  relic: VoidRelic;
  intactValue: number;
  exceptionalValue: number;
  flawlessValue: number;
  radiantValue: number;
  marketValue: number;
  bestOption: 'intact' | 'exceptional' | 'flawless' | 'radiant' | 'market';
  bestValue: number;
  recommendation: 'OPEN_INTACT' | 'OPEN_EXCEPTIONAL' | 'OPEN_FLAWLESS' | 'OPEN_RADIANT' | 'SELL';
}

interface SelectedRelic {
  relic: VoidRelic;
  analysis: RelicAnalysis;
}

// Add new interface for relic detail modal
interface RelicDetailModalProps {
  relic: VoidRelic;
  analysis: RelicAnalysis;
  isOpen: boolean;
  onClose: () => void;
}

const RelicDetailModal: React.FC<RelicDetailModalProps> = ({ relic, analysis, isOpen, onClose }) => {
  if (!isOpen) return null;

  const dropChances = {
    'intact': { 'Common': 25.33, 'Uncommon': 11, 'Rare': 2 },
    'exceptional': { 'Common': 23.33, 'Uncommon': 13, 'Rare': 4 },
    'flawless': { 'Common': 20, 'Uncommon': 17, 'Rare': 6 },
    'radiant': { 'Common': 16.67, 'Uncommon': 20, 'Rare': 10 }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'Rare': return 'text-yellow-400 bg-yellow-400/10';
      case 'Uncommon': return 'text-slate-400 bg-slate-400/10';
      case 'Common': return 'text-amber-700 bg-amber-700/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const formatExpectedValue = (value: number): string => {
    if (value < 0.1) return '< 0.1';
    if (value < 1) return value.toFixed(1);
    return Math.round(value).toString();
  };

  return (
    <PortalModal isOpen={isOpen} onClose={onClose}>
      <div className="bg-gray-900 rounded-lg border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto mx-4 md:mx-0">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-900/50 rounded border border-gray-700/50 overflow-hidden">
              <img
                src={getRelicImagePath(relic.name, relic.rarity)}
                alt={`${relic.name} (${relic.rarity || 'intact'})`}
                className="w-full h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/images/relics/unknown.png';
                }}
              />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{relic.name}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-400 capitalize">
                <Circle size={8} className={`${relic.rarity === 'radiant' ? 'text-yellow-400' : relic.rarity === 'flawless' ? 'text-blue-400' : relic.rarity === 'exceptional' ? 'text-green-400' : 'text-gray-400'}`} fill="currentColor" />
                {relic.rarity || 'intact'} refinement
                {relic.quantity && relic.quantity > 1 && (
                  <span className="ml-2 px-2 py-1 bg-tenno-blue/20 text-tenno-blue border border-tenno-blue/30 rounded text-xs">
                    {relic.quantity} owned
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Best Option Summary */}
        <div className="p-6 border-b border-gray-700">
          <div className="bg-green-900/20 rounded-lg p-4 border border-green-700/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-green-400">Best Option</h3>
              <div className="text-2xl font-bold text-green-400">
                {analysis.bestValue.toFixed(1)}p
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Recommendation</span>
              <span className="text-green-400 font-medium uppercase tracking-wider">
                {analysis.recommendation.replace('OPEN_', '').replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Refinement Analysis */}
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Refinement Analysis</h3>

          {/* Use already-processed relic drops data */}
          {(() => {
            // Use the processed relic drops from the relic object instead of fetching async
            const drops = relic.relicDrops;
            if (!drops || drops.length === 0) {
              return (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle size={48} className="mx-auto mb-4" />
                  <p>Relic drop data not available</p>
                </div>
              );
            }

            const refinementLevels = ['intact', 'exceptional', 'flawless', 'radiant'] as const;

            return (
              <div className="space-y-4">
                {refinementLevels.map((level) => {
                  const isUnavailable = (refinementLevel: string) => {
                    const levels = ['intact', 'exceptional', 'flawless', 'radiant'];
                    const currentIndex = levels.indexOf(relic.rarity || 'intact');
                    const targetIndex = levels.indexOf(refinementLevel);
                    return targetIndex < currentIndex;
                  };

                  const levelValue = analysis[`${level}Value` as keyof RelicAnalysis] as number;
                  const isDisabled = isUnavailable(level);
                  const isBest = analysis.bestOption === level;

                  return (
                    <div key={level} className={`border rounded-lg p-4 ${
                      isBest ? 'bg-green-900/20 border-green-700/50' : 'bg-gray-800/30 border-gray-700/50'
                    } ${isDisabled ? 'opacity-50' : ''}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Circle size={8} className={`${
                            level === 'radiant' ? 'text-yellow-400' :
                            level === 'flawless' ? 'text-blue-400' :
                            level === 'exceptional' ? 'text-green-400' :
                            'text-gray-400'
                          }`} fill="currentColor" />
                          <span className="font-medium text-white capitalize">{level}</span>
                          {isBest && (
                            <span className="px-2 py-1 bg-green-700/50 text-green-400 text-xs font-medium rounded">
                              BEST
                            </span>
                          )}
                        </div>
                        <div className="text-lg font-semibold text-white">
                          {levelValue.toFixed(1)}p
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        {Object.entries(dropChances[level]).map(([rarity, chance]) => {
                          const rarityItems = drops.filter(drop => drop.rarity === rarity);
                          const expectedValue = rarityItems.reduce((sum, item) => {
                            return sum + (item.price || 0) * (chance / 100);
                          }, 0);

                          return (
                            <div key={rarity} className="text-center">
                              <div className={`text-xs font-medium mb-1 ${getRarityColor(rarity).split(' ')[0]}`}>
                                {rarity}
                              </div>
                              <div className="text-sm text-gray-400 mb-1">
                                {chance}%
                              </div>
                              <div className="text-sm font-medium text-white">
                                {formatExpectedValue(expectedValue)}p
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Market Sale Option */}
        <div className="p-6 pt-0">
          <div className={`border rounded-lg p-4 ${
            analysis.bestOption === 'market' ? 'bg-green-900/20 border-green-700/50' : 'bg-gray-800/30 border-gray-700/50'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">Market Sale</span>
                {analysis.bestOption === 'market' && (
                  <span className="px-2 py-1 bg-green-700/50 text-green-400 text-xs font-medium rounded">
                    BEST
                  </span>
                )}
              </div>
              <div className="text-lg font-semibold text-white">
                {analysis.marketValue.toFixed(1)}p
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Sell directly to market</span>
              <div className="flex items-center gap-2">
                {relic.buyerUsername && relic.price && relic.price > 0 ? (
                  <button
                    onClick={() => {
                      const message = `/w ${relic.buyerUsername} Hi! I want to sell: "${relic.name}" for ${relic.price} platinum. (warframe.market)`;
                      navigator.clipboard.writeText(message);
                    }}
                    className="text-tenno-blue hover:text-tenno-light transition-colors"
                    title={`Message ${relic.buyerUsername} (${relic.price}p)`}
                  >
                    <MessageCircle size={16} />
                  </button>
                ) : (
                  <span className="text-gray-600" title="No buyers available">
                    <MessageCircle size={16} />
                  </span>
                )}
                <button
                  onClick={() => {
                    const marketUrl = `https://warframe.market/items/${relic.name.toLowerCase().replace(/ /g, '_')}`;
                    window.open(marketUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                  title="View on Warframe Market"
                >
                  <ExternalLink size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Refinement Analysis */}
        {relic.refinementAnalysis && (
          <div className="p-6 pt-0">
            <div className="border rounded-lg p-4 bg-gray-800/30 border-gray-700/50">
              <h4 className="text-lg font-medium text-white mb-3">Refinement Economics</h4>

              <div className="space-y-3">
                {/* Best Refinement Target */}
                {relic.refinementAnalysis.bestRefinementTarget && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Best Refinement Target:</span>
                    <span className="text-white font-medium capitalize">
                      {relic.refinementAnalysis.bestRefinementTarget}
                    </span>
                  </div>
                )}

                {/* Void Trace Cost */}
                {relic.refinementAnalysis.bestRefinementCost && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Void Trace Cost:</span>
                    <span className="text-white font-medium">
                      {relic.refinementAnalysis.bestRefinementCost} traces
                    </span>
                  </div>
                )}

                {/* Expected Gain */}
                {relic.refinementAnalysis.bestRefinementGain && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Expected Gain:</span>
                    <span className="text-green-400 font-medium">
                      +{formatExpectedValue(relic.refinementAnalysis.bestRefinementGain)}p
                    </span>
                  </div>
                )}

                {/* Efficiency */}
                {relic.refinementAnalysis.platPerVoidTrace && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Efficiency:</span>
                    <span className="text-blue-400 font-medium">
                      {(relic.refinementAnalysis.platPerVoidTrace * 100).toFixed(1)}p per 100 traces
                    </span>
                  </div>
                )}

                {/* Optimal Market Price */}
                {relic.refinementAnalysis.optimalMarketPrice && relic.refinementAnalysis.optimalMarketPrice > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">
                      Optimal Market Price
                      {relic.refinementAnalysis.optimalMarketPriceFallback &&
                       relic.refinementAnalysis.optimalMarketPriceFallback !== 'exact' && (
                        <span className="text-xs text-gray-500 ml-1">
                          ({relic.refinementAnalysis.optimalMarketPriceFallback})
                        </span>
                      )}:
                    </span>
                    <span className="text-yellow-400 font-medium">
                      {formatExpectedValue(relic.refinementAnalysis.optimalMarketPrice)}p
                    </span>
                  </div>
                )}

                {/* Reasoning */}
                {relic.refinementAnalysis.reasoning && (
                  <div className="pt-2 border-t border-gray-700/50">
                    <div className="text-xs text-gray-400 mb-1">Analysis:</div>
                    <div className="text-sm text-gray-300 italic">
                      {relic.refinementAnalysis.reasoning}
                    </div>
                  </div>
                )}

                {/* Comparison */}
                {relic.refinementAnalysis.comparison && (
                  <div className="text-xs text-gray-500">
                    {relic.refinementAnalysis.comparison}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalModal>
  );
};

const RelicResultsTable: React.FC<RelicResultsTableProps> = ({
  results,
  isLoading = false,
  onRemoveItem,
  onRefreshItem,
  showActionButtons = false
}) => {
  const [sortField, setSortField] = useState<'totalValue' | 'bestValue' | 'name' | 'intact' | 'exceptional' | 'flawless' | 'radiant' | 'market'>('totalValue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [showUnreservedOnly, setShowUnreservedOnly] = useState(false);
  const [copiedRelics, setCopiedRelics] = useState<Set<string>>(new Set());
  const [selectedRelic, setSelectedRelic] = useState<SelectedRelic | null>(null);
  const [expandedRelics, setExpandedRelics] = useState<Set<string>>(new Set());

  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClipboardCopy = async (message: string, relicId: string) => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedRelics(prev => new Set([...prev, relicId]));
      setTimeout(() => {
        setCopiedRelics(prev => {
          const newSet = new Set(prev);
          newSet.delete(relicId);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const toggleRelicExpansion = (relicId: string) => {
    setExpandedRelics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(relicId)) {
        newSet.delete(relicId);
      } else {
        newSet.add(relicId);
      }
      return newSet;
    });
  };

  // Calculate expected value for a given refinement level
  const calculateExpectedValueForLevel = (relic: VoidRelic, refinementLevel: VoidRelic['rarity']): number => {
    // Use the already-processed relic drops instead of fetching async
    const drops = relic.relicDrops;
    if (!drops || drops.length === 0) return 0;

    const dropChances = {
      'intact': { 'Common': 25.33, 'Uncommon': 11, 'Rare': 2 },
      'exceptional': { 'Common': 23.33, 'Uncommon': 13, 'Rare': 4 },
      'flawless': { 'Common': 20, 'Uncommon': 17, 'Rare': 6 },
      'radiant': { 'Common': 16.67, 'Uncommon': 20, 'Rare': 10 }
    };

    const levelChances = dropChances[refinementLevel || 'intact'];
    let expectedValue = 0;

    for (const [rarity, chance] of Object.entries(levelChances)) {
      const rarityItems = drops.filter(drop => drop.rarity === rarity);
      // Use the currentPrice from the already processed drops instead of price
      const rarityExpectedValue = rarityItems.reduce((sum, item) => {
        return sum + (item.currentPrice || 0) * (chance / 100);
      }, 0);
      expectedValue += rarityExpectedValue;
    }

    return expectedValue;
  };

  // Analyze relic to determine best option
  const analyzeRelic = (relic: VoidRelic): RelicAnalysis => {
    const intactValue = calculateExpectedValueForLevel(relic, 'intact');
    const exceptionalValue = calculateExpectedValueForLevel(relic, 'exceptional');
    const flawlessValue = calculateExpectedValueForLevel(relic, 'flawless');
    const radiantValue = calculateExpectedValueForLevel(relic, 'radiant');
    const marketValue = relic.price || 0;

    const options = [
      { type: 'intact' as const, value: intactValue, recommendation: 'OPEN_INTACT' as const },
      { type: 'exceptional' as const, value: exceptionalValue, recommendation: 'OPEN_EXCEPTIONAL' as const },
      { type: 'flawless' as const, value: flawlessValue, recommendation: 'OPEN_FLAWLESS' as const },
      { type: 'radiant' as const, value: radiantValue, recommendation: 'OPEN_RADIANT' as const },
      { type: 'market' as const, value: marketValue, recommendation: 'SELL' as const }
    ];

    const bestOption = options.reduce((best, current) =>
      current.value > best.value ? current : best
    );

    return {
      relic,
      intactValue,
      exceptionalValue,
      flawlessValue,
      radiantValue,
      marketValue,
      bestOption: bestOption.type,
      bestValue: bestOption.value,
      recommendation: bestOption.recommendation
    };
  };

  // Apply filters
  const filteredResults = showUnreservedOnly
    ? results.filter(relic => !isItemReserved(relic.name, 'relics').reserved)
    : results;

  // Analyze and sort relics
  const sortedRelics = filteredResults.map(analyzeRelic).sort((a, b) => {
    let valueA: number;
    let valueB: number;

    switch (sortField) {
      case 'totalValue':
        valueA = a.bestValue * (a.relic.quantity || 1);
        valueB = b.bestValue * (b.relic.quantity || 1);
        break;
      case 'bestValue':
        valueA = a.bestValue;
        valueB = b.bestValue;
        break;
      case 'name':
        return sortDirection === 'asc'
          ? a.relic.name.localeCompare(b.relic.name)
          : b.relic.name.localeCompare(a.relic.name);
      case 'intact':
        valueA = a.intactValue;
        valueB = b.intactValue;
        break;
      case 'exceptional':
        valueA = a.exceptionalValue;
        valueB = b.exceptionalValue;
        break;
      case 'flawless':
        valueA = a.flawlessValue;
        valueB = b.flawlessValue;
        break;
      case 'radiant':
        valueA = a.radiantValue;
        valueB = b.radiantValue;
        break;
      case 'market':
        valueA = a.marketValue;
        valueB = b.marketValue;
        break;
      default:
        valueA = a.bestValue;
        valueB = b.bestValue;
    }

    return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
  });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setShowSortOptions(false);
  };

  const getSortLabel = () => {
    const labels = {
      totalValue: 'Total Value',
      bestValue: 'Best Value',
      name: 'Name',
      intact: 'Intact',
      exceptional: 'Exceptional',
      flawless: 'Flawless',
      radiant: 'Radiant',
      market: 'Market'
    };
    return labels[sortField] || 'Sort';
  };

  // Get refinement dot color
  const getRefinementDotColor = (rarity?: string) => {
    switch (rarity) {
      case 'radiant': return 'text-yellow-400';
      case 'flawless': return 'text-blue-400';
      case 'exceptional': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  // Check if refinement level should be greyed out
  const isRefinementDisabled = (relic: VoidRelic, targetLevel: string): boolean => {
    const levels = ['intact', 'exceptional', 'flawless', 'radiant'];
    const currentIndex = levels.indexOf(relic.rarity || 'intact');
    const targetIndex = levels.indexOf(targetLevel);
    return targetIndex < currentIndex;
  };

  const finalFilteredRelics = sortedRelics;

  if (isLoading && filteredResults.length === 0) {
    return (
      <div className="animate-pulse p-4">
        <div className="h-8 bg-gray-800 rounded mb-4"></div>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-gray-800 rounded mb-2"></div>
        ))}
      </div>
    );
  }

  if (filteredResults.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg">
        <p className="text-gray-400">No relics detected yet.</p>
        <p className="text-sm text-gray-500 mt-1">Upload a screenshot to analyze your inventory.</p>
      </div>
    );
  }

  if (finalFilteredRelics.length === 0 && showUnreservedOnly) {
    return (
      <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg">
        <p className="text-gray-400">No unreserved relics found.</p>
        <p className="text-sm text-gray-500 mt-1">All relics are currently reserved for build plans.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            {showUnreservedOnly ? (
              <>
                {finalFilteredRelics.length} of {filteredResults.length} unreserved relic{finalFilteredRelics.length !== 1 ? 's' : ''}
              </>
            ) : (
              <>
                {filteredResults.length} relic{filteredResults.length !== 1 ? 's' : ''}
              </>
            )}
          </div>

          {/* Mobile-friendly Sort Dropdown */}
          <div className="relative" ref={sortDropdownRef}>
            <button
              onClick={() => setShowSortOptions(!showSortOptions)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-colors"
            >
              <Filter size={12} />
              <span className="hidden sm:inline">Sort: {getSortLabel()}</span>
              <span className="sm:hidden">{getSortLabel()}</span>
            </button>

            {showSortOptions && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 min-w-[180px]">
                <div className="p-2 space-y-1">
                  {[
                    { field: 'totalValue' as const, label: 'Total Value' },
                    { field: 'bestValue' as const, label: 'Best Value' },
                    { field: 'name' as const, label: 'Name' },
                    { field: 'intact' as const, label: 'Intact Value' },
                    { field: 'exceptional' as const, label: 'Exceptional Value' },
                    { field: 'flawless' as const, label: 'Flawless Value' },
                    { field: 'radiant' as const, label: 'Radiant Value' },
                    { field: 'market' as const, label: 'Market Sale' }
                  ].map(({ field, label }) => (
                    <button
                      key={field}
                      onClick={() => handleSort(field)}
                      className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                        sortField === field
                          ? 'bg-tenno-blue/20 text-tenno-blue'
                          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      {label} {sortField === field && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowUnreservedOnly(!showUnreservedOnly)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              showUnreservedOnly
                ? 'bg-tenno-blue/20 text-tenno-blue border border-tenno-blue/30'
                : 'bg-gray-800 text-gray-400 hover:text-gray-300'
            }`}
            title={showUnreservedOnly ? 'Show all relics' : 'Show only unreserved relics'}
          >
            {showUnreservedOnly ? <EyeOff size={12} /> : <Eye size={12} />}
            <span className="hidden sm:inline">
              {showUnreservedOnly ? 'Show All' : 'Unreserved Only'}
            </span>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">
            <span className="hidden lg:inline">Trading Platform View • All values in Platinum</span>
            <span className="lg:hidden">All values in Platinum</span>
          </div>
        </div>
      </div>

      {/* Desktop Table (lg and up) */}
      <div className="hidden lg:block bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/80">
            <tr>
              <th className="text-left p-3 font-medium text-gray-300">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  Relic
                  {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="text-center p-3 font-medium text-gray-300 min-w-16">Qty</th>
              <th className="text-center p-3 font-medium text-gray-300 min-w-24">
                <button
                  onClick={() => handleSort('intact')}
                  className="flex items-center justify-center gap-1 hover:text-white transition-colors w-full"
                >
                  <Circle size={6} className="text-gray-400" fill="currentColor" />
                  Intact
                  {sortField === 'intact' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="text-center p-3 font-medium text-gray-300 min-w-24">
                <button
                  onClick={() => handleSort('exceptional')}
                  className="flex items-center justify-center gap-1 hover:text-white transition-colors w-full"
                >
                  <Circle size={6} className="text-green-400" fill="currentColor" />
                  Exceptional
                  {sortField === 'exceptional' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="text-center p-3 font-medium text-gray-300 min-w-24">
                <button
                  onClick={() => handleSort('flawless')}
                  className="flex items-center justify-center gap-1 hover:text-white transition-colors w-full"
                >
                  <Circle size={6} className="text-blue-400" fill="currentColor" />
                  Flawless
                  {sortField === 'flawless' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="text-center p-3 font-medium text-gray-300 min-w-24">
                <button
                  onClick={() => handleSort('radiant')}
                  className="flex items-center justify-center gap-1 hover:text-white transition-colors w-full"
                >
                  <Circle size={6} className="text-yellow-400" fill="currentColor" />
                  Radiant
                  {sortField === 'radiant' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="text-center p-3 font-medium text-gray-300 min-w-24">
                <button
                  onClick={() => handleSort('market')}
                  className="flex items-center justify-center gap-1 hover:text-white transition-colors w-full"
                >
                  Market Sale
                  {sortField === 'market' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="text-center p-3 font-medium text-gray-300">
                <button
                  onClick={() => handleSort('bestValue')}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <TrendingUp size={12} />
                  Best
                  {sortField === 'bestValue' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="text-center p-3 font-medium text-gray-300">
                <button
                  onClick={() => handleSort('totalValue')}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <Zap size={12} />
                  Total
                  {sortField === 'totalValue' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              {showActionButtons && (
                <th className="text-center p-3 font-medium text-gray-300">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {sortedRelics.map((analysis) => {
              const { relic } = analysis;
              const refinementColor = getRefinementDotColor(relic.rarity);

              return (
                <tr
                  key={relic.id}
                  className="hover:bg-gray-800/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedRelic({ relic, analysis })}
                >
                  {/* Relic Info */}
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-900/50 rounded border border-gray-700/50 flex-shrink-0 overflow-hidden">
                        <img
                          src={getRelicImagePath(relic.name, relic.rarity)}
                          alt={`${relic.name} (${relic.rarity || 'intact'})`}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/images/relics/unknown.png';
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-sm truncate">
                          {relic.name}
                        </div>
                        {(() => {
                          const reservation = isItemReserved(relic.name, 'relics');
                          if (reservation.reserved) {
                            const formattedReservations = reservation.reservedFor.length > 2
                              ? `${reservation.reservedFor.slice(0, 2).join(', ')} & ${reservation.reservedFor.length - 2} more`
                              : reservation.reservedFor.join(', ');

                            return (
                              <div className="flex items-center gap-1 mt-1">
                                <Shield size={8} className={reservation.isPriority ? 'text-red-400' : 'text-yellow-400'} />
                                <span className={`text-xs truncate ${reservation.isPriority ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {formattedReservations}
                                  {reservation.isPriority && ' (PRIORITY)'}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {relic.rarity && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 capitalize mt-0.5">
                            <Circle size={4} className={refinementColor} fill="currentColor" />
                            {relic.rarity}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Quantity */}
                  <td className="p-3 text-center">
                    <span className="text-white font-medium">
                      {relic.quantity || 1}
                    </span>
                  </td>

                  {/* Intact Opening Value */}
                  <td className={`p-3 text-center ${analysis.bestOption === 'intact' ? 'bg-green-900/20 text-green-300 font-semibold' : ''} ${isRefinementDisabled(relic, 'intact') ? 'text-gray-500' : 'text-gray-300'}`}>
                    {analysis.intactValue.toFixed(1)}p
                  </td>

                  {/* Exceptional Opening Value */}
                  <td className={`p-3 text-center ${analysis.bestOption === 'exceptional' ? 'bg-green-900/20 text-green-300 font-semibold' : ''} ${isRefinementDisabled(relic, 'exceptional') ? 'text-gray-500' : 'text-gray-300'}`}>
                    {analysis.exceptionalValue.toFixed(1)}p
                  </td>

                  {/* Flawless Opening Value */}
                  <td className={`p-3 text-center ${analysis.bestOption === 'flawless' ? 'bg-green-900/20 text-green-300 font-semibold' : ''} ${isRefinementDisabled(relic, 'flawless') ? 'text-gray-500' : 'text-gray-300'}`}>
                    {analysis.flawlessValue.toFixed(1)}p
                  </td>

                  {/* Radiant Opening Value */}
                  <td className={`p-3 text-center ${analysis.bestOption === 'radiant' ? 'bg-green-900/20 text-green-300 font-semibold' : ''} ${isRefinementDisabled(relic, 'radiant') ? 'text-gray-500' : 'text-gray-300'}`}>
                    {analysis.radiantValue.toFixed(1)}p
                  </td>

                  {/* Market Sale Value */}
                  <td className={`p-3 text-center ${analysis.bestOption === 'market' ? 'bg-green-900/20 text-green-300 font-semibold' : 'text-gray-300'}`}>
                    <div className="flex items-center justify-center gap-1">
                      {analysis.marketValue.toFixed(1)}p
                      {relic.buyerUsername && relic.price && relic.price > 0 ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const message = `/w ${relic.buyerUsername} Hi! I want to sell: "${relic.name}" for ${relic.price} platinum. (warframe.market)`;
                            handleClipboardCopy(message, relic.id);
                          }}
                          className={`text-tenno-blue hover:text-tenno-light transition-colors ${
                            copiedRelics.has(relic.id) ? 'text-green-400' : 'text-tenno-blue'
                          }`}
                          title={`Message ${relic.buyerUsername} (${relic.price}p)`}
                        >
                          {copiedRelics.has(relic.id) ? <Check size={10} /> : <MessageCircle size={10} />}
                        </button>
                      ) : (
                        <span className="text-gray-600" title="No buyers available">
                          <MessageCircle size={10} />
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const marketUrl = `https://warframe.market/items/${relic.name.toLowerCase().replace(/ /g, '_')}`;
                          window.open(marketUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="text-gray-500 hover:text-gray-300 transition-colors"
                        title="View on Warframe Market"
                      >
                        <ExternalLink size={10} />
                      </button>
                    </div>
                  </td>

                  {/* Best Option */}
                  <td className="p-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-green-400 font-semibold">
                        {analysis.bestValue.toFixed(1)}p
                      </span>
                      <span className="text-xs text-gray-400 uppercase tracking-wider">
                        {analysis.recommendation.replace('OPEN_', '').replace('_', ' ')}
                      </span>
                    </div>
                  </td>

                  {/* Total Value */}
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Zap size={12} className="text-yellow-400" />
                      <span className="font-semibold text-yellow-400">
                        {(analysis.bestValue * (relic.quantity || 1)).toFixed(1)}p
                      </span>
                    </div>
                  </td>

                  {/* Actions */}
                  {showActionButtons && (
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        {onRefreshItem && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRefreshItem(relic.name);
                            }}
                            disabled={relic.status === 'loading'}
                            className={`p-1 rounded text-xs transition-colors ${
                              relic.status === 'loading'
                                ? 'text-gray-500 cursor-not-allowed'
                                : 'text-tenno-blue hover:bg-gray-700/50'
                            }`}
                            title="Refresh"
                          >
                            <RefreshCw size={12} className={relic.status === 'loading' ? 'animate-spin' : ''} />
                          </button>
                        )}
                        {onRemoveItem && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveItem(relic.name);
                            }}
                            className="p-1 rounded text-xs text-grineer-red hover:bg-gray-700/50 transition-colors"
                            title="Remove"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards (below lg) */}
      <div className="lg:hidden space-y-3">
        {sortedRelics.map((analysis) => {
          const { relic } = analysis;
          const refinementColor = getRefinementDotColor(relic.rarity);
          const isExpanded = expandedRelics.has(relic.id);

          return (
            <div key={relic.id} className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
              {/* Simplified Header - Always Visible */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-900/50 rounded border border-gray-700/50 flex-shrink-0 overflow-hidden">
                      <img
                        src={getRelicImagePath(relic.name, relic.rarity)}
                        alt={`${relic.name} (${relic.rarity || 'intact'})`}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/relics/unknown.png';
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm leading-tight">
                          {relic.name}
                        </span>
                        {relic.quantity && relic.quantity > 1 && (
                          <span className="inline-flex items-center justify-center w-6 h-5 text-xs font-medium bg-tenno-blue/20 text-tenno-blue border border-tenno-blue/30 rounded">
                            {relic.quantity}
                          </span>
                        )}
                      </div>
                      {(() => {
                        const reservation = isItemReserved(relic.name, 'relics');
                        if (reservation.reserved) {
                          const formattedReservations = reservation.reservedFor.length > 3
                            ? `${reservation.reservedFor.slice(0, 3).join(', ')} & ${reservation.reservedFor.length - 3} more`
                            : reservation.reservedFor.join(', ');

                          return (
                            <div className="flex items-center gap-1 mt-1">
                              <Shield size={10} className={reservation.isPriority ? 'text-red-400' : 'text-yellow-400'} />
                              <span className={`text-xs ${reservation.isPriority ? 'text-red-400' : 'text-yellow-400'}`}>
                                Reserved for: {formattedReservations}
                                {reservation.isPriority && ' (PRIORITY)'}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {relic.rarity && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 capitalize mt-0.5">
                          <Circle size={6} className={refinementColor} fill={refinementColor} />
                          {relic.rarity}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {showActionButtons && (
                      <>
                        {onRefreshItem && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRefreshItem(relic.name);
                            }}
                            disabled={relic.status === 'loading'}
                            className={`p-1.5 rounded text-sm transition-colors ${
                              relic.status === 'loading'
                                ? 'text-gray-500 cursor-not-allowed'
                                : 'text-tenno-blue hover:bg-gray-700/50'
                            }`}
                            title="Refresh"
                          >
                            <RefreshCw size={14} className={relic.status === 'loading' ? 'animate-spin' : ''} />
                          </button>
                        )}
                        {onRemoveItem && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveItem(relic.name);
                            }}
                            className="p-1.5 rounded text-sm text-grineer-red hover:bg-gray-700/50 transition-colors"
                            title="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Compact Summary - Always Visible */}
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Best Option</div>
                    <div className="text-lg font-semibold text-green-400">
                      {analysis.bestValue.toFixed(1)}p
                    </div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider">
                      {analysis.recommendation.replace('OPEN_', '').replace('_', ' ')}
                    </div>
                  </div>

                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Current Price</div>
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-semibold text-gray-300">
                        {analysis.marketValue.toFixed(1)}p
                      </span>
                      {relic.average && (
                        <span className="text-xs text-gray-500">
                          (avg: {relic.average}p)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {relic.buyerUsername && relic.price && relic.price > 0 ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const message = `/w ${relic.buyerUsername} Hi! I want to sell: "${relic.name}" for ${relic.price} platinum. (warframe.market)`;
                            handleClipboardCopy(message, relic.id);
                          }}
                          className={`text-tenno-blue hover:text-tenno-light transition-colors ${
                            copiedRelics.has(relic.id) ? 'text-green-400' : 'text-tenno-blue'
                          }`}
                          title={`Message ${relic.buyerUsername} (${relic.price}p)`}
                        >
                          {copiedRelics.has(relic.id) ? <Check size={12} /> : <MessageCircle size={12} />}
                        </button>
                      ) : (
                        <span className="text-gray-600" title="No buyers available">
                          <MessageCircle size={12} />
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const marketUrl = `https://warframe.market/items/${relic.name.toLowerCase().replace(/ /g, '_')}`;
                          window.open(marketUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="text-gray-500 hover:text-gray-300 transition-colors"
                        title="View on Warframe Market"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Total Value</div>
                    <div className="flex items-center gap-1">
                      <Zap size={14} className="text-yellow-400" />
                      <span className="text-lg font-semibold text-yellow-400">
                        {(analysis.bestValue * (relic.quantity || 1)).toFixed(1)}p
                      </span>
                    </div>
                  </div>
                </div>

                {/* Toggle Button */}
                <button
                  onClick={() => toggleRelicExpansion(relic.id)}
                  className="w-full mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp size={16} />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown size={16} />
                      Show Details
                    </>
                  )}
                </button>
              </div>

              {/* Expandable Detail Section */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-700/50">
                  <div className="space-y-3 pt-3">
                    {/* Opening Values */}
                    <div>
                      <h4 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Opening Values</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className={`flex items-center justify-between p-2 rounded ${analysis.bestOption === 'intact' ? 'bg-green-900/20 text-green-300' : 'bg-gray-800/50'} ${isRefinementDisabled(relic, 'intact') ? 'opacity-50' : ''}`}>
                          <div className="flex items-center gap-1">
                            <Circle size={4} className="text-gray-400" fill="currentColor" />
                            <span>Intact</span>
                          </div>
                          <span className="font-medium">{analysis.intactValue.toFixed(1)}p</span>
                        </div>
                        <div className={`flex items-center justify-between p-2 rounded ${analysis.bestOption === 'exceptional' ? 'bg-green-900/20 text-green-300' : 'bg-gray-800/50'} ${isRefinementDisabled(relic, 'exceptional') ? 'opacity-50' : ''}`}>
                          <div className="flex items-center gap-1">
                            <Circle size={4} className="text-green-400" fill="currentColor" />
                            <span>Exceptional</span>
                          </div>
                          <span className="font-medium">{analysis.exceptionalValue.toFixed(1)}p</span>
                        </div>
                        <div className={`flex items-center justify-between p-2 rounded ${analysis.bestOption === 'flawless' ? 'bg-green-900/20 text-green-300' : 'bg-gray-800/50'} ${isRefinementDisabled(relic, 'flawless') ? 'opacity-50' : ''}`}>
                          <div className="flex items-center gap-1">
                            <Circle size={4} className="text-blue-400" fill="currentColor" />
                            <span>Flawless</span>
                          </div>
                          <span className="font-medium">{analysis.flawlessValue.toFixed(1)}p</span>
                        </div>
                        <div className={`flex items-center justify-between p-2 rounded ${analysis.bestOption === 'radiant' ? 'bg-green-900/20 text-green-300' : 'bg-gray-800/50'} ${isRefinementDisabled(relic, 'radiant') ? 'opacity-50' : ''}`}>
                          <div className="flex items-center gap-1">
                            <Circle size={4} className="text-yellow-400" fill="currentColor" />
                            <span>Radiant</span>
                          </div>
                          <span className="font-medium">{analysis.radiantValue.toFixed(1)}p</span>
                        </div>
                      </div>
                    </div>

                    {/* Relic Contents */}
                    <div>
                      <h4 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Relic Contents</h4>
                      <button
                        onClick={() => setSelectedRelic({ relic, analysis })}
                        className="w-full flex items-center justify-between p-2 rounded bg-gray-800/50 text-sm text-gray-300 hover:bg-gray-700/50 transition-colors"
                      >
                        <span>View detailed drop chances & items</span>
                        <Info size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 text-xs text-gray-500 px-2">
        <div className="flex items-center justify-between">
          <span>💡 Green highlights show the most profitable option • Tap relic names for details</span>
          <span className="hidden lg:inline">Greyed values indicate refinement levels below current relic state</span>
        </div>
      </div>

      {/* Relic Detail Modal */}
      {selectedRelic && (
        <RelicDetailModal
          relic={selectedRelic.relic}
          analysis={selectedRelic.analysis}
          isOpen={!!selectedRelic}
          onClose={() => setSelectedRelic(null)}
        />
      )}
    </div>
  );
};

export default RelicResultsTable;