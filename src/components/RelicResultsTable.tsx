// Purpose: Trading platform-style table for Void Relics with comprehensive refinement analysis
// Shows all refinement levels and market comparison in a data-dense table format

import React, { useState, useEffect } from 'react';
import { VoidRelic } from '../types';
import { Filter, TrendingUp, RefreshCw, Trash2, Circle, ExternalLink, Zap, MessageCircle, Info, X, AlertCircle, Check, Shield } from 'lucide-react';
import { getRelicImagePath } from '../lib/relicUtils';
import { getRelicDropsByName } from '../services/relicDataService';
import { isItemReserved } from '../services/buildPlanService';

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
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-lg border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
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

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Recommendation Summary */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-3">Best Strategy</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-green-400 font-semibold text-xl">
                  {analysis.bestValue.toFixed(1)}p
                </span>
                <span className="text-gray-400">per relic</span>
                {analysis.recommendation.includes('OPEN_') && analysis.recommendation !== 'OPEN_INTACT' && (
                  <span className="text-sm text-blue-400">
                    (Cost: {
                      analysis.recommendation === 'OPEN_EXCEPTIONAL' ? '25' :
                      analysis.recommendation === 'OPEN_FLAWLESS' ? '75' :
                      analysis.recommendation === 'OPEN_RADIANT' ? '150' : '0'
                    } void traces)
                  </span>
                )}
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-green-400 uppercase tracking-wider">
                  {analysis.recommendation.replace('OPEN_', '').replace('_', ' ')}
                </div>
                <div className="text-sm text-gray-400">
                  {relic.quantity && relic.quantity > 1 && (
                    <>Total value: {(analysis.bestValue * relic.quantity).toFixed(1)}p</>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Unified Relic Analysis Table */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Complete Refinement Analysis</h3>
            <div className="bg-gray-800/30 rounded-lg border border-gray-700/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/80">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-300">Item</th>
                    <th className="text-center p-3 font-medium text-gray-300">Rarity</th>
                    <th className="text-center p-3 font-medium text-gray-300">
                      <div className="flex items-center justify-center gap-1">
                        <Circle size={6} className={`text-gray-400 ${(relic.rarity === 'intact') ? '' : 'opacity-50'}`} fill="currentColor" />
                        <span className={`${(relic.rarity === 'intact') ? 'text-white font-semibold' : (relic.rarity && ['exceptional', 'flawless', 'radiant'].includes(relic.rarity)) ? 'text-gray-500' : 'text-gray-300'}`}>
                          Intact
                        </span>
                      </div>
                    </th>
                    <th className="text-center p-3 font-medium text-gray-300">
                      <div className="flex items-center justify-center gap-1">
                        <Circle size={6} className={`text-green-400 ${(relic.rarity === 'exceptional') ? '' : (relic.rarity === 'intact') ? '' : 'opacity-50'}`} fill="currentColor" />
                        <span className={`${(relic.rarity === 'exceptional') ? 'text-white font-semibold' : (relic.rarity && ['flawless', 'radiant'].includes(relic.rarity)) ? 'text-gray-500' : 'text-gray-300'}`}>
                          Exceptional
                        </span>
                      </div>
                    </th>
                    <th className="text-center p-3 font-medium text-gray-300">
                      <div className="flex items-center justify-center gap-1">
                        <Circle size={6} className={`text-blue-400 ${(relic.rarity === 'flawless') ? '' : (relic.rarity && ['intact', 'exceptional'].includes(relic.rarity)) ? '' : 'opacity-50'}`} fill="currentColor" />
                        <span className={`${(relic.rarity === 'flawless') ? 'text-white font-semibold' : (relic.rarity === 'radiant') ? 'text-gray-500' : 'text-gray-300'}`}>
                          Flawless
                        </span>
                      </div>
                    </th>
                    <th className="text-center p-3 font-medium text-gray-300">
                      <div className="flex items-center justify-center gap-1">
                        <Circle size={6} className={`text-yellow-400 ${(relic.rarity === 'radiant') ? '' : ''}`} fill="currentColor" />
                        <span className={`${(relic.rarity === 'radiant') ? 'text-white font-semibold' : 'text-gray-300'}`}>
                          Radiant
                        </span>
                      </div>
                    </th>
                    <th className="text-center p-3 font-medium text-gray-300">Market Price</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Item Rows */}
                  {relic.relicDrops && relic.relicDrops.length > 0 && relic.relicDrops
                    .sort((a, b) => {
                      const rarityOrder = { 'Rare': 3, 'Uncommon': 2, 'Common': 1 };
                      return (rarityOrder[b.rarity as keyof typeof rarityOrder] || 0) - (rarityOrder[a.rarity as keyof typeof rarityOrder] || 0);
                    })
                    .map((drop, index) => {
                      const isUnavailable = (refinementLevel: string) => {
                        const levels = ['intact', 'exceptional', 'flawless', 'radiant'];
                        const currentIndex = levels.indexOf(relic.rarity || 'intact');
                        const targetIndex = levels.indexOf(refinementLevel);
                        return targetIndex < currentIndex;
                      };

                      return (
                        <tr key={index} className="border-t border-gray-700/50">
                          <td className="p-3">
                            <span className="text-white">{drop.itemName}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getRarityColor(drop.rarity)}`}>
                              {drop.rarity}
                            </span>
                          </td>
                          <td className={`p-3 text-center ${isUnavailable('intact') ? 'text-gray-600' : 'text-gray-300'}`}>
                            {dropChances.intact[drop.rarity]}%
                          </td>
                          <td className={`p-3 text-center ${isUnavailable('exceptional') ? 'text-gray-600' : 'text-gray-300'}`}>
                            {dropChances.exceptional[drop.rarity]}%
                          </td>
                          <td className={`p-3 text-center ${isUnavailable('flawless') ? 'text-gray-600' : 'text-gray-300'}`}>
                            {dropChances.flawless[drop.rarity]}%
                          </td>
                          <td className="p-3 text-center text-gray-300">
                            {dropChances.radiant[drop.rarity]}%
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-white font-medium">
                              {drop.currentPrice ? `${formatExpectedValue(drop.currentPrice)}p` : 'no buyers'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                  {/* Expected Value Row */}
                  <tr className="border-t-2 border-yellow-600/50 bg-yellow-900/10">
                    <td className="p-3">
                      <span className="text-yellow-400 font-semibold">Expected Value</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-xs text-gray-400">Per Opening</span>
                    </td>
                    <td className={`p-3 text-center ${analysis.bestOption === 'intact' ? 'bg-green-900/30 text-green-300 font-semibold' : 'text-yellow-300'} ${(relic.rarity && ['exceptional', 'flawless', 'radiant'].includes(relic.rarity)) ? 'text-gray-600' : ''}`}>
                      {analysis.intactValue.toFixed(1)}p
                      {analysis.bestOption === 'intact' && <div className="text-xs text-green-400">BEST</div>}
                    </td>
                    <td className={`p-3 text-center ${analysis.bestOption === 'exceptional' ? 'bg-green-900/30 text-green-300 font-semibold' : 'text-yellow-300'} ${(relic.rarity && ['flawless', 'radiant'].includes(relic.rarity)) ? 'text-gray-600' : ''}`}>
                      {analysis.exceptionalValue.toFixed(1)}p
                      {analysis.bestOption === 'exceptional' && <div className="text-xs text-green-400">BEST</div>}
                      <div className="text-xs text-blue-400">25 traces</div>
                    </td>
                    <td className={`p-3 text-center ${analysis.bestOption === 'flawless' ? 'bg-green-900/30 text-green-300 font-semibold' : 'text-yellow-300'} ${(relic.rarity === 'radiant') ? 'text-gray-600' : ''}`}>
                      {analysis.flawlessValue.toFixed(1)}p
                      {analysis.bestOption === 'flawless' && <div className="text-xs text-green-400">BEST</div>}
                      <div className="text-xs text-blue-400">75 traces</div>
                    </td>
                    <td className={`p-3 text-center ${analysis.bestOption === 'radiant' ? 'bg-green-900/30 text-green-300 font-semibold' : 'text-yellow-300'}`}>
                      {analysis.radiantValue.toFixed(1)}p
                      {analysis.bestOption === 'radiant' && <div className="text-xs text-green-400">BEST</div>}
                      <div className="text-xs text-blue-400">150 traces</div>
                    </td>
                    <td className="p-3 text-center text-gray-400">
                      <span className="text-xs">Varies by item</span>
                    </td>
                  </tr>

                  {/* Market Sale Row */}
                  <tr className="border-t border-gray-700/50 bg-gray-800/20">
                    <td className="p-3">
                      <span className="text-white font-medium">Market Sale (Intact)</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-xs text-gray-400">Direct Sale</span>
                    </td>
                    <td colSpan={4} className={`p-3 text-center ${analysis.bestOption === 'market' ? 'bg-green-900/30 text-green-300 font-semibold' : 'text-gray-300'}`}>
                      <div className="flex items-center justify-center gap-2">
                        <span>{analysis.marketValue.toFixed(1)}p</span>
                        {analysis.bestOption === 'market' && <span className="text-xs text-green-400 font-medium">BEST</span>}
                        <button
                          onClick={() => {
                            const marketUrl = `https://warframe.market/items/${relic.name.toLowerCase().replace(/ /g, '_')}`;
                            window.open(marketUrl, '_blank', 'noopener,noreferrer');
                          }}
                          className="text-gray-500 hover:text-gray-300 transition-colors"
                          title="View on Warframe Market"
                        >
                          <ExternalLink size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-sm text-gray-400">No additional cost</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const RelicResultsTable: React.FC<RelicResultsTableProps> = ({
  results,
  isLoading = false,
  onRemoveItem,
  onRefreshItem,
  showActionButtons = false
}) => {
  const [sortField, setSortField] = useState<'name' | 'intact' | 'exceptional' | 'flawless' | 'radiant' | 'market' | 'bestValue' | 'totalValue'>('totalValue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedRelic, setSelectedRelic] = useState<SelectedRelic | null>(null);
  const [copiedRelics, setCopiedRelics] = useState<Set<string>>(new Set());

  const handleClipboardCopy = async (message: string, relicId: string) => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedRelics(prev => new Set([...prev, relicId]));
      // Reset the icon after 2 seconds
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

  // Helper function to calculate expected value for a refinement level
  const calculateExpectedValueForLevel = (relic: VoidRelic, refinementLevel: VoidRelic['rarity']): number => {
    if (!relic.relicDrops || relic.relicDrops.length === 0) {
      return relic.expectedDropValue || 0; // Fallback to current calculation
    }

    // Drop chances by refinement level (from the game data)
    const dropChances = {
      'intact': { 'Common': 25.33, 'Uncommon': 11, 'Rare': 2 },
      'exceptional': { 'Common': 23.33, 'Uncommon': 13, 'Rare': 4 },
      'flawless': { 'Common': 20, 'Uncommon': 17, 'Rare': 6 },
      'radiant': { 'Common': 16.67, 'Uncommon': 20, 'Rare': 10 }
    };

    const targetDropChances = dropChances[refinementLevel || 'intact'];

    let expectedValue = 0;
    relic.relicDrops.forEach(drop => {
      const adjustedChance = targetDropChances[drop.rarity] || drop.dropChance;
      const price = drop.currentPrice || 0;
      expectedValue += price * (adjustedChance / 100);
    });

    return parseFloat(expectedValue.toFixed(2));
  };

  // Calculate comprehensive analysis for each relic with real refinement data
  const analyzeRelic = (relic: VoidRelic): RelicAnalysis => {
    // Calculate expected values for all refinement levels using real drop data
    const intactValue = calculateExpectedValueForLevel(relic, 'intact');
    const exceptionalValue = calculateExpectedValueForLevel(relic, 'exceptional');
    const flawlessValue = calculateExpectedValueForLevel(relic, 'flawless');
    const radiantValue = calculateExpectedValueForLevel(relic, 'radiant');
    const marketValue = relic.directSalePrice || 0;

    // Find the best option
    const options = {
      intact: intactValue,
      exceptional: exceptionalValue,
      flawless: flawlessValue,
      radiant: radiantValue,
      market: marketValue
    };

    const bestOption = Object.entries(options).reduce((best, [key, value]) =>
      value > options[best] ? key as keyof typeof options : best
    , 'intact' as keyof typeof options);

    const bestValue = options[bestOption];

    // Determine recommendation
    let recommendation: RelicAnalysis['recommendation'];
    switch (bestOption) {
      case 'intact': recommendation = 'OPEN_INTACT'; break;
      case 'exceptional': recommendation = 'OPEN_EXCEPTIONAL'; break;
      case 'flawless': recommendation = 'OPEN_FLAWLESS'; break;
      case 'radiant': recommendation = 'OPEN_RADIANT'; break;
      case 'market': recommendation = 'SELL'; break;
    }

    return {
      relic,
      intactValue,
      exceptionalValue,
      flawlessValue,
      radiantValue,
      marketValue,
      bestOption,
      bestValue,
      recommendation
    };
  };

  const analyzedRelics = results.map(analyzeRelic);

    // Sort relics
  const sortedRelics = [...analyzedRelics].sort((a, b) => {
    let valueA: number, valueB: number;

    switch (sortField) {
      case 'name':
        return sortDirection === 'asc' ?
          a.relic.name.localeCompare(b.relic.name) :
          b.relic.name.localeCompare(a.relic.name);
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
      case 'bestValue':
        valueA = a.bestValue;
        valueB = b.bestValue;
        break;
      case 'totalValue':
        valueA = a.bestValue * (a.relic.quantity || 1);
        valueB = b.bestValue * (b.relic.quantity || 1);
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

  if (isLoading && results.length === 0) {
    return (
      <div className="animate-pulse p-4">
        <div className="h-8 bg-gray-800 rounded mb-4"></div>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-gray-800 rounded mb-2"></div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg">
        <p className="text-gray-400">No relics detected yet.</p>
        <p className="text-sm text-gray-500 mt-1">Upload a screenshot to analyze your inventory.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="text-sm text-gray-400">
          {results.length} relic{results.length !== 1 ? 's' : ''}
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
                  Total Value
                  {sortField === 'totalValue' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              {showActionButtons && <th className="text-center p-3 font-medium text-gray-300 w-20">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sortedRelics.map((analysis) => {
              const { relic } = analysis;
              const refinementColor = getRefinementDotColor(relic.rarity);

              return (
                <tr key={relic.id} className="border-t border-gray-700/50 hover:bg-gray-800/30 transition-colors">
                  {/* Relic Name */}
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
                      <div>
                        <button
                          onClick={() => setSelectedRelic({ relic, analysis })}
                          className="font-medium text-white text-sm leading-tight hover:text-tenno-blue transition-colors text-left"
                          title="Click to view relic details"
                        >
                          {relic.name}
                        </button>
                        {(() => {
                          const reservation = isItemReserved(relic.name, 'relics');
                          if (reservation.reserved) {
                            return (
                              <div className="flex items-center gap-1 mt-1">
                                <Shield size={10} className={reservation.isPriority ? 'text-red-400' : 'text-yellow-400'} />
                                <span className={`text-xs ${reservation.isPriority ? 'text-red-400' : 'text-yellow-400'}`}>
                                  Reserved for: {reservation.reservedFor.join(', ')}
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
                  </td>

                  {/* Quantity */}
                  <td className="p-3 text-center">
                    <span className={`inline-flex items-center justify-center min-w-8 h-6 rounded text-xs font-medium ${
                      (relic.quantity && relic.quantity > 1)
                        ? 'bg-tenno-blue/20 text-tenno-blue border border-tenno-blue/30'
                        : 'text-gray-400'
                    }`}>
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
                          onClick={() => {
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
                        onClick={() => {
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
                            onClick={() => onRefreshItem(relic.name)}
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
                            onClick={() => onRemoveItem(relic.name)}
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

          return (
            <div key={relic.id} className="bg-gray-900/50 rounded-lg border border-gray-700 p-4">
              {/* Relic Header */}
              <div className="flex items-center justify-between mb-4">
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
                      <button
                        onClick={() => setSelectedRelic({ relic, analysis })}
                        className="font-medium text-white text-sm leading-tight hover:text-tenno-blue transition-colors text-left"
                        title="Click to view relic details"
                      >
                        {relic.name}
                      </button>
                      {relic.quantity && relic.quantity > 1 && (
                        <span className="inline-flex items-center justify-center w-6 h-5 text-xs font-medium bg-tenno-blue/20 text-tenno-blue border border-tenno-blue/30 rounded">
                          {relic.quantity}
                        </span>
                      )}
                    </div>
                    {(() => {
                      const reservation = isItemReserved(relic.name, 'relics');
                      if (reservation.reserved) {
                        return (
                          <div className="flex items-center gap-1 mt-1">
                            <Shield size={10} className={reservation.isPriority ? 'text-red-400' : 'text-yellow-400'} />
                            <span className={`text-xs ${reservation.isPriority ? 'text-red-400' : 'text-yellow-400'}`}>
                              Reserved for: {reservation.reservedFor.join(', ')}
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
                {showActionButtons && (
                  <div className="flex items-center gap-2">
                    {onRefreshItem && (
                      <button
                        onClick={() => onRefreshItem(relic.name)}
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
                        onClick={() => onRemoveItem(relic.name)}
                        className="p-1.5 rounded text-sm text-grineer-red hover:bg-gray-700/50 transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Best Option Highlight */}
              <div className="bg-green-900/20 rounded-lg p-3 mb-4 border border-green-700/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">Best Option</span>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-green-400">
                      {analysis.bestValue.toFixed(1)}p
                    </div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider">
                      {analysis.recommendation.replace('OPEN_', '').replace('_', ' ')}
                    </div>
                  </div>
                </div>
                {/* Total Value Row */}
                <div className="flex items-center justify-between pt-2 border-t border-green-700/30">
                  <span className="text-sm text-gray-400">Total Value</span>
                  <div className="flex items-center gap-1">
                    <Zap size={14} className="text-yellow-400" />
                    <span className="text-lg font-semibold text-yellow-400">
                      {(analysis.bestValue * (relic.quantity || 1)).toFixed(1)}p
                    </span>
                  </div>
                </div>
              </div>

              {/* Values Grid */}
              <div className="space-y-3">
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

                {/* Market Sale */}
                <div>
                  <h4 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Market</h4>
                  <div className={`flex items-center justify-between p-2 rounded ${analysis.bestOption === 'market' ? 'bg-green-900/20 text-green-300' : 'bg-gray-800/50'}`}>
                    <span>Market Sale</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{analysis.marketValue.toFixed(1)}p</span>
                      {relic.buyerUsername && relic.price && relic.price > 0 ? (
                        <button
                          onClick={() => {
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
                        onClick={() => {
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
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 text-xs text-gray-500 px-2">
        <div className="flex items-center justify-between">
          <span>💡 Green highlights show the most profitable option for each relic • Click relic names for details</span>
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