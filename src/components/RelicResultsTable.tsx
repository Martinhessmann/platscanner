// Purpose: Trading platform-style table for Void Relics with comprehensive refinement analysis
// Shows all refinement levels and market comparison in a data-dense table format

import React, { useState } from 'react';
import { VoidRelic } from '../types';
import { Filter, TrendingUp, RefreshCw, Trash2, Circle, ExternalLink } from 'lucide-react';
import { getRelicImagePath } from '../lib/relicUtils';

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

const RelicResultsTable: React.FC<RelicResultsTableProps> = ({
  results,
  isLoading = false,
  onRemoveItem,
  onRefreshItem,
  showActionButtons = false
}) => {
  const [sortField, setSortField] = useState<'name' | 'bestValue' | 'profit' | 'intact' | 'exceptional' | 'flawless' | 'radiant' | 'market'>('bestValue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Calculate comprehensive analysis for each relic
  const analyzeRelic = (relic: VoidRelic): RelicAnalysis => {
    // For now, use the current expected value as a base
    // TODO: Implement proper multi-level analysis
    const intactValue = relic.expectedDropValue || 0;
    const exceptionalValue = intactValue * 1.1; // Placeholder calculation
    const flawlessValue = intactValue * 1.2; // Placeholder calculation
    const radiantValue = intactValue * 1.3; // Placeholder calculation
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
      case 'profit':
        valueA = a.bestValue - Math.min(a.intactValue, a.marketValue);
        valueB = b.bestValue - Math.min(b.intactValue, b.marketValue);
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
        <div className="text-xs text-gray-500">
          <span className="hidden lg:inline">Trading Platform View • All values in Platinum</span>
          <span className="lg:hidden">All values in Platinum</span>
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
                        <div className="font-medium text-white text-sm leading-tight">
                          {relic.name}
                        </div>
                        {relic.rarity && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 capitalize mt-0.5">
                            <Circle size={6} className={refinementColor} fill={refinementColor} />
                            {relic.rarity}
                          </div>
                        )}
                      </div>
                    </div>
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
                  <div>
                    <div className="font-medium text-white text-sm leading-tight">
                      {relic.name}
                    </div>
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
                <div className="flex items-center justify-between">
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
          <span>💡 Green highlights show the most profitable option for each relic</span>
          <span className="hidden lg:inline">Greyed values indicate refinement levels below current relic state</span>
        </div>
      </div>
    </div>
  );
};

export default RelicResultsTable;