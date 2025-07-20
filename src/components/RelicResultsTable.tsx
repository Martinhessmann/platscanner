// Purpose: Trading platform-style table for Void Relics with comprehensive refinement analysis
// Shows all refinement levels and market comparison in a data-dense table format

import React, { useState, useEffect, useRef } from 'react';
import { VoidRelic } from '../types';
import { Filter, TrendingUp, RefreshCw, Trash2, Circle, ExternalLink, Zap, MessageCircle, Info, X, AlertCircle, Check, Shield, Eye, EyeOff, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { getRelicImagePath } from '../lib/relicUtils';
import { getRelicDropsByName } from '../services/relicDataService';
import { isItemReserved } from '../services/buildPlanService';
import LastRefreshInfo from './LastRefreshInfo';

interface RelicResultsTableProps {
  results: VoidRelic[];
  isLoading?: boolean;
  onRemoveItem?: (itemName: string) => void;
  onRefreshItem?: (itemName: string) => void;
  showActionButtons?: boolean;
  lastRefreshTime?: Date | null;
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

const RelicResultsTable: React.FC<RelicResultsTableProps> = ({
  results,
  isLoading = false,
  onRemoveItem,
  onRefreshItem,
  showActionButtons = false,
  lastRefreshTime
}) => {
  const [sortField, setSortField] = useState<'totalValue' | 'bestValue' | 'name' | 'intact' | 'exceptional' | 'flawless' | 'radiant' | 'market'>('totalValue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [showUnreservedOnly, setShowUnreservedOnly] = useState(false);
  const [copiedRelics, setCopiedRelics] = useState<Set<string>>(new Set());
  const [expandedRelics, setExpandedRelics] = useState<Set<string>>(new Set());
  const [activeEraFilters, setActiveEraFilters] = useState<Set<string>>(new Set(['all']));

  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Extract era from relic name (Lith, Meso, Neo, Axi, Requiem)
  const getRelicEra = (relicName: string): string => {
    const eraMatch = relicName.match(/^(Lith|Meso|Neo|Axi|Requiem)/i);
    return eraMatch ? eraMatch[1].toLowerCase() : 'unknown';
  };

  // Toggle era filter
  const toggleEraFilter = (era: string) => {
    setActiveEraFilters(prev => {
      const newFilters = new Set(prev);
      
      if (era === 'all') {
        // If clicking "all", clear all other filters and set only "all"
        return new Set(['all']);
      } else {
        // Remove "all" if it exists
        newFilters.delete('all');
        
        // Toggle the specific era
        if (newFilters.has(era)) {
          newFilters.delete(era);
        } else {
          newFilters.add(era);
        }
        
        // If no filters selected, default back to "all"
        if (newFilters.size === 0) {
          newFilters.add('all');
        }
      }
      
      return newFilters;
    });
  };

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

  // Apply filters
  let filteredResults = results;
  
  // Apply unreserved filter
  if (showUnreservedOnly) {
    filteredResults = filteredResults.filter(relic => !isItemReserved(relic.name, 'relics').reserved);
  }

  // Apply era filters
  if (!activeEraFilters.has('all')) {
    filteredResults = filteredResults.filter(relic => {
      const relicEra = getRelicEra(relic.name);
      return activeEraFilters.has(relicEra);
    });
  }

  // Analyze and sort relics
  const sortedRelics = filteredResults.map(analyzeRelic).sort((a, b) => {
    let valueA: number;
    let valueB: number;

    switch (sortField) {
      case 'totalValue':
        valueA = a.marketValue * (a.relic.quantity || 1);
        valueB = b.marketValue * (b.relic.quantity || 1);
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

  if (finalFilteredRelics.length === 0 && (showUnreservedOnly || !activeEraFilters.has('all'))) {
    return (
      <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg">
        <p className="text-gray-400">No relics match the current filters.</p>
        <p className="text-sm text-gray-500 mt-1">
          {showUnreservedOnly && 'All relics are reserved for build plans. '}
          {!activeEraFilters.has('all') && `Active era filters: ${Array.from(activeEraFilters).join(', ')}`}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm text-gray-400">
            {finalFilteredRelics.length} of {results.length} relic{results.length !== 1 ? 's' : ''}
            {(showUnreservedOnly || !activeEraFilters.has('all')) && ' filtered'}
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
              {showUnreservedOnly ? 'Show All' : 'Unreserved'}
            </span>
          </button>

          {/* Era Filter Pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {['all', 'lith', 'meso', 'neo', 'axi', 'requiem'].map((era) => {
              const isActive = activeEraFilters.has(era);
              const eraCount = era === 'all' 
                ? results.length 
                : results.filter(relic => getRelicEra(relic.name) === era).length;
              
              // Don't show era pills with 0 count unless it's "all"
              if (eraCount === 0 && era !== 'all') return null;
              
              return (
                <button
                  key={era}
                  onClick={() => toggleEraFilter(era)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                    isActive
                      ? 'bg-orokin-gold/20 text-orokin-gold border border-orokin-gold/30'
                      : 'bg-gray-800/50 text-gray-400 hover:text-gray-300'
                  }`}
                  title={`${era === 'all' ? 'All eras' : era.charAt(0).toUpperCase() + era.slice(1)} relics (${eraCount})`}
                >
                  <span className="capitalize">{era}</span>
                  <span className={`text-[10px] ${isActive ? 'text-orokin-gold/70' : 'text-gray-500'}`}>
                    {eraCount}
                  </span>
                </button>
              );
            })}
          </div>

          {lastRefreshTime && (
            <LastRefreshInfo 
              lastRefreshDate={lastRefreshTime} 
              className="text-xs text-gray-500"
            />
          )}
        </div>
      </div>

      {/* Desktop Table (lg and up) */}
      <div className="hidden lg:block space-y-2">
        {sortedRelics.map((analysis) => {
          const { relic } = analysis;
          const refinementColor = getRefinementDotColor(relic.rarity);
          const isExpanded = expandedRelics.has(relic.id);

          return (
            <div key={relic.id} className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
              {/* Main row */}
              <div className="grid grid-cols-12 gap-4 items-center p-3 hover:bg-gray-800/30 transition-colors">
                {/* Relic Info + Contents */}
                <div className="col-span-3 flex items-center gap-3">
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
                    <div className="font-medium text-white text-sm">
                      {relic.name}
                    </div>
                    {relic.rarity && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 capitalize mt-0.5">
                        <Circle size={4} className={refinementColor} fill="currentColor" />
                        {relic.rarity}
                      </div>
                    )}
                    {/* Relic Contents */}
                    {relic.relicDrops && relic.relicDrops.length > 0 && (
                      <div className="text-xs text-gray-400 mt-1">
                        {relic.relicDrops
                          .sort((a, b) => (b.currentPrice || 0) - (a.currentPrice || 0))
                          .map((drop, index) => {
                            const reservation = isItemReserved(drop.itemName, 'prime_parts');
                            const isReserved = reservation.reserved;
                            return (
                              <span key={index} className="inline-block mr-1">
                                <span
                                  className={`${isReserved ? 'text-yellow-400' : 'text-gray-300'}`}
                                >
                                  {isReserved && <Shield size={8} className="inline mr-0.5 text-yellow-400" />}
                                  {drop.itemName}
                                </span>
                                {index < relic.relicDrops.length - 1 && ', '}
                              </span>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quantity */}
                <div className="col-span-1 text-center">
                  <span className="text-white font-medium">
                    {relic.quantity || 1}
                  </span>
                </div>

                {/* Opening Values */}
                <div className={`col-span-1 text-center ${analysis.bestOption === 'intact' ? 'bg-green-900/20 text-green-300 font-semibold rounded px-2 py-1' : ''} ${isRefinementDisabled(relic, 'intact') ? 'text-gray-500' : 'text-gray-300'}`}>
                  {analysis.intactValue.toFixed(1)}p
                </div>
                <div className={`col-span-1 text-center ${analysis.bestOption === 'exceptional' ? 'bg-green-900/20 text-green-300 font-semibold rounded px-2 py-1' : ''} ${isRefinementDisabled(relic, 'exceptional') ? 'text-gray-500' : 'text-gray-300'}`}>
                  {analysis.exceptionalValue.toFixed(1)}p
                </div>
                <div className={`col-span-1 text-center ${analysis.bestOption === 'flawless' ? 'bg-green-900/20 text-green-300 font-semibold rounded px-2 py-1' : ''} ${isRefinementDisabled(relic, 'flawless') ? 'text-gray-500' : 'text-gray-300'}`}>
                  {analysis.flawlessValue.toFixed(1)}p
                </div>
                <div className={`col-span-1 text-center ${analysis.bestOption === 'radiant' ? 'bg-green-900/20 text-green-300 font-semibold rounded px-2 py-1' : ''} ${isRefinementDisabled(relic, 'radiant') ? 'text-gray-500' : 'text-gray-300'}`}>
                  {analysis.radiantValue.toFixed(1)}p
                </div>

                {/* Market Sale */}
                <div className={`col-span-1 text-center ${analysis.bestOption === 'market' ? 'bg-green-900/20 text-green-300 font-semibold rounded px-2 py-1' : 'text-gray-300'}`}>
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
                  </div>
                </div>

                {/* Best Option */}
                <div className="col-span-1 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-green-400 font-semibold">
                      {analysis.bestValue.toFixed(1)}p
                    </span>
                    <span className="text-xs text-gray-400 uppercase tracking-wider">
                      {analysis.recommendation.replace('OPEN_', '').replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Total Value */}
                <div className="col-span-1 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Zap size={12} className="text-yellow-400" />
                    <span className="font-semibold text-yellow-400">
                      {(analysis.marketValue * (relic.quantity || 1)).toFixed(1)}p
                    </span>
                  </div>
                </div>

                {/* Expand button and actions */}
                <div className="col-span-1 flex items-center justify-center gap-1">
                  <button
                    onClick={() => toggleRelicExpansion(relic.id)}
                    className="p-1 rounded text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 transition-colors"
                    title={isExpanded ? "Hide details" : "Show details"}
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {showActionButtons && (
                    <>
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
                    </>
                  )}
                </div>
              </div>

              {/* Expandable Details */}
              {isExpanded && (
                <div className="border-t border-gray-700/50 p-4 bg-gray-800/30">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Detailed Drop Analysis */}
                    {relic.relicDrops && relic.relicDrops.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                          <Package size={14} />
                          Detailed Drop Analysis
                        </h4>
                        <div className="space-y-2">
                          {relic.relicDrops
                            .sort((a, b) => (b.currentPrice || 0) - (a.currentPrice || 0))
                            .map((drop, index) => {
                              const reservation = isItemReserved(drop.itemName, 'prime_parts');
                              const isReserved = reservation.reserved;
                              return (
                                <div
                                  key={index}
                                  className="flex items-center justify-between text-xs py-2 px-3 bg-gray-900/50 rounded"
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        drop.rarity === 'Rare' ? 'bg-yellow-400' :
                                        drop.rarity === 'Uncommon' ? 'bg-slate-400' :
                                        'bg-amber-700'
                                      }`}
                                    />
                                    <span className={`font-medium ${
                                      drop.rarity === 'Rare' ? 'text-yellow-400' :
                                      drop.rarity === 'Uncommon' ? 'text-slate-400' :
                                      'text-amber-700'
                                    }`}>
                                      {drop.rarity}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      {isReserved && <Shield size={10} className="text-yellow-400" />}
                                      <span className={`${isReserved ? 'text-yellow-400' : 'text-gray-300'}`}>
                                        {drop.itemName}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 text-right">
                                    <span className="text-gray-400">
                                      {drop.dropChance}%
                                    </span>
                                    <span className="text-white font-medium min-w-12">
                                      {drop.currentPrice ? formatExpectedValue(drop.currentPrice) + 'p' : 'no buyers'}
                                    </span>
                                    <span className="text-orange-400 font-medium min-w-12">
                                      {drop.currentPrice ? formatExpectedValue(drop.currentPrice * (drop.dropChance / 100)) + 'p' : '0p'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                        <div className="pt-3 border-t border-gray-700/30 text-xs text-gray-400 mt-3">
                          <div className="flex justify-between">
                            <span>Weighted Expected Value:</span>
                            <span className="text-orange-400 font-medium">
                              {formatExpectedValue(relic.expectedDropValue)}p
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Refinement Economics */}
                    {relic.refinementAnalysis && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 mb-3">Refinement Economics</h4>
                        <div className="bg-gray-900/50 rounded p-3 space-y-2 text-xs">
                          {relic.refinementAnalysis.bestRefinementTarget && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Best Refinement Target:</span>
                              <span className="text-white font-medium capitalize">
                                {relic.refinementAnalysis.bestRefinementTarget}
                              </span>
                            </div>
                          )}
                          {relic.refinementAnalysis.bestRefinementCost && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Void Trace Cost:</span>
                              <span className="text-white font-medium">
                                {relic.refinementAnalysis.bestRefinementCost} traces
                              </span>
                            </div>
                          )}
                          {relic.refinementAnalysis.bestRefinementGain && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Expected Gain:</span>
                              <span className="text-green-400 font-medium">
                                +{formatExpectedValue(relic.refinementAnalysis.bestRefinementGain)}p
                              </span>
                            </div>
                          )}
                          {relic.refinementAnalysis.platPerVoidTrace && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Efficiency:</span>
                              <span className="text-blue-400 font-medium">
                                {(relic.refinementAnalysis.platPerVoidTrace * 100).toFixed(1)}p per 100 traces
                              </span>
                            </div>
                          )}
                          {relic.refinementAnalysis.reasoning && (
                            <div className="pt-2 border-t border-gray-700/50">
                              <div className="text-xs text-gray-400 mb-1">Analysis:</div>
                              <div className="text-sm text-gray-300 italic">
                                {relic.refinementAnalysis.reasoning}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile Cards (below lg) - Simplified to remove duplication */}
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
                        {(analysis.marketValue * (relic.quantity || 1)).toFixed(1)}p
                      </span>
                    </div>
                  </div>
                </div>

                {/* Relic Contents Preview - Show/Hide via toggle */}
                {isExpanded && relic.relicDrops && relic.relicDrops.length > 0 && (
                  <div className="mt-3 text-xs text-gray-400 px-2 py-2 bg-gray-800/30 rounded">
                    <div className="flex items-center gap-1 mb-2">
                      <Package size={12} />
                      <span className="font-medium">Contents:</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {relic.relicDrops
                        .sort((a, b) => (b.currentPrice || 0) - (a.currentPrice || 0))
                        .map((drop, index) => {
                          const reservation = isItemReserved(drop.itemName, 'prime_parts');
                          const isReserved = reservation.reserved;
                          return (
                            <div key={index} className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    drop.rarity === 'Rare' ? 'bg-yellow-400' :
                                    drop.rarity === 'Uncommon' ? 'bg-slate-400' :
                                    'bg-amber-700'
                                  }`}
                                />
                                <div className="flex items-center gap-1">
                                  {isReserved && <Shield size={8} className="text-yellow-400" />}
                                  <span className={`${isReserved ? 'text-yellow-400' : 'text-gray-300'} truncate max-w-32`}>
                                    {drop.itemName}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-right">
                                <span className="text-gray-500 text-xs">
                                  {drop.dropChance}%
                                </span>
                                <span className="text-white font-medium min-w-8">
                                  {drop.currentPrice ? formatExpectedValue(drop.currentPrice) + 'p' : 'no buyers'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Toggle Button */}
                <button
                  onClick={() => toggleRelicExpansion(relic.id)}
                  className="w-full mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp size={16} />
                      Hide Contents
                    </>
                  ) : (
                    <>
                      <ChevronDown size={16} />
                      Show Contents
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 text-xs text-gray-500 px-2">
        <div className="flex items-center justify-between">
          <span>💡 Green highlights show most profitable option • Filter by era (Lith, Meso, Neo, Axi, Requiem)</span>
          <span className="hidden lg:inline">Yellow items with shield icons are reserved for builds</span>
        </div>
      </div>
    </div>
  );
};

export default RelicResultsTable;