import React, { useState, useEffect } from 'react';
import { DetectedItem } from '../types';
import {
  Zap,
  Coins,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Trash2,
  MessageCircle,
  Check,
  AlertCircle,
  Shield,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  X,
  Package,
  Hexagon,
  Circle
} from 'lucide-react';
import { isItemReserved } from '../services/buildPlanService';
import { getImageUrlSync } from '../services/unifiedImageService';
import LastRefreshInfo from './LastRefreshInfo';

// Helper: treat all prime parts as tradeable in UI
const isPrimePartTradeable = (_item: DetectedItem): boolean => true;

interface PrimePartsProps {
  results: DetectedItem[];
  isLoading?: boolean;
  onRemoveItem?: (itemName: string) => void;
  onRefreshItem?: (itemName: string) => void;
  showActionButtons?: boolean;
  lastRefreshTime?: Date | null;
  setProgressData?: Map<string, any>;
}

const PrimeParts: React.FC<PrimePartsProps> = ({
  results,
  isLoading = false,
  onRemoveItem,
  onRefreshItem,
  showActionButtons = false,
  lastRefreshTime,
  setProgressData
}) => {
  const [sortField, setSortField] = useState<'price' | 'name' | 'ducats' | 'totalValue' | 'completion'>('price');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [showUnreservedOnly, setShowUnreservedOnly] = useState(false);
  const [hideReservedMissing, setHideReservedMissing] = useState(false);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());

  // Helper function to get the correct image URL for items
  const getItemImageUrl = (item: DetectedItem): string => {
    if (item.category === 'prime_sets') {
      // For Prime Sets, use the set name directly with unified image service
      const imageUrl = getImageUrlSync(item.name);
      return imageUrl || '/images/primeparts/unknown.png';
    } else if (item.category === 'prime_parts') {
      // For prime parts, use the unified image service to get parent set image
      const imageUrl = getImageUrlSync(item.name);
      return imageUrl || '/images/primeparts/unknown.png';
    }
    // For other categories, use the original imgUrl
    return item.imgUrl || '';
  };

  const handleSort = (field: 'price' | 'name' | 'ducats' | 'totalValue' | 'completion') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
    setShowSortOptions(false);
  };

  const handleClipboardCopy = async (message: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedItems(prev => new Set([...prev, itemId]));
      // Reset the icon after 2 seconds
      setTimeout(() => {
        setCopiedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const toggleSetExpansion = (setId: string) => {
    setExpandedSets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(setId)) {
        newSet.delete(setId);
      } else {
        newSet.add(setId);
      }
      return newSet;
    });
  };

  // Apply filters
  let filteredResults = results;

  if (showUnreservedOnly) {
    filteredResults = filteredResults.filter(item => !isItemReserved(item.name, 'prime_parts').reserved);
  }

  const sortedResults = [...filteredResults].sort((a, b) => {
    if (sortField === 'price') {
      const priceA = a.price || 0;
      const priceB = b.price || 0;
      const result = sortDirection === 'asc' ? priceA - priceB : priceB - priceA;
      return result;
    } else if (sortField === 'ducats') {
      const ducatsA = a.ducats || 0;
      const ducatsB = b.ducats || 0;
      const result = sortDirection === 'asc' ? ducatsA - ducatsB : ducatsB - ducatsA;
      return result;
    } else if (sortField === 'totalValue') {
      const totalValueA = (a.price || 0) * (a.quantity || 1);
      const totalValueB = (b.price || 0) * (b.quantity || 1);
      const result = sortDirection === 'asc' ? totalValueA - totalValueB : totalValueB - totalValueA;
      return result;
    } else if (sortField === 'completion') {
      // Only applies to prime_sets - sort by completion percentage
      const completionA = a.setData?.completionPercentage || 0;
      const completionB = b.setData?.completionPercentage || 0;
      const result = sortDirection === 'asc' ? completionA - completionB : completionB - completionA;
      return result;
    } else {
      const result = sortDirection === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
      return result;
    }
  });


  if (isLoading && results.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-2 p-2 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-16 bg-gray-800 rounded"></div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg">
        <p className="text-gray-400">No prime parts detected yet.</p>
        <p className="text-sm text-gray-500 mt-1">Upload a screenshot to analyze your inventory.</p>
      </div>
    );
  }

  if (filteredResults.length === 0 && showUnreservedOnly) {
    return (
      <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg">
        <p className="text-gray-400">No unreserved items found.</p>
        <p className="text-sm text-gray-500 mt-1">All items are currently reserved for build plans.</p>
      </div>
    );
  }

  const getSortLabel = () => {
    switch (sortField) {
      case 'price': return 'Price';
      case 'ducats': return 'Ducats';
      case 'totalValue': return 'Total Value';
      case 'completion': return 'Completion';
      case 'name': return 'Name';
      default: return 'Price';
    }
  };

  return (
    <div className="w-full">
      {/* Mobile View */}
      <div className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-400">
              {filteredResults.length} of {results.length} item{results.length !== 1 ? 's' : ''}
              {showUnreservedOnly && ' filtered'}
            </div>

            <button
              onClick={() => setShowUnreservedOnly(!showUnreservedOnly)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                showUnreservedOnly
                  ? 'bg-tenno-blue/20 text-tenno-blue border border-tenno-blue/30'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-300'
              }`}
              title={showUnreservedOnly ? 'Show all items' : 'Show only unreserved items'}
            >
              {showUnreservedOnly ? <Eye size={12} /> : <EyeOff size={12} />}
              <span className="hidden sm:inline">
                {showUnreservedOnly ? 'Show All' : 'Unreserved'}
              </span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            {lastRefreshTime && (
              <LastRefreshInfo
                lastRefreshDate={lastRefreshTime}
                className="text-xs text-gray-500"
              />
            )}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSortOptions(!showSortOptions);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <ArrowUpDown size={14} />
                {getSortLabel()}
              </button>

              {showSortOptions && (
                <div className="absolute right-0 top-full mt-1 bg-gray-800 rounded-lg border border-gray-700 shadow-xl z-50 min-w-32">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSort('price');
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded-t-lg flex items-center gap-2"
                >
                  <Zap size={12} className="text-gray-300" />
                  Plat {sortField === 'price' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSort('ducats');
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                >
                  <Coins size={12} className="text-yellow-500" />
                  Ducats {sortField === 'ducats' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSort('totalValue');
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                >
                  <Zap size={12} className="text-yellow-400" />
                  Total Value {sortField === 'totalValue' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSort('completion');
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                >
                  <Shield size={12} className="text-blue-400" />
                  Completion {sortField === 'completion' && (sortDirection === 'asc' ? '↑' : '↓')}
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
        </div>

        {/* Mobile cards */}
        <div key={`${sortField}-${sortDirection}`} className="space-y-2 p-3">
        {sortedResults.map((item) => (
          <div
            key={item.id}
            className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-3"
          >
            {/* Compact Item Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-900/50 rounded border border-gray-700/50 flex-shrink-0 overflow-hidden">
                  {(() => {
                    const imageUrl = getItemImageUrl(item);
                    return imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/primeparts/unknown.png';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <AlertCircle size={12} className="text-gray-500" />
                      </div>
                    );
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-white text-sm leading-tight truncate">
                      {item.name}
                    </div>
                    {item.quantity && item.quantity > 1 && (
                      <span className="inline-flex items-center justify-center w-5 h-4 text-xs font-medium bg-tenno-blue/20 text-tenno-blue border border-tenno-blue/30 rounded">
                        {item.quantity}
                      </span>
                    )}
                  </div>
                  {/* Set Analysis Info for Prime Sets */}
                  {item.category === 'prime_sets' && item.setData && (() => {
                    const setData = item.setData;
                    return (
                      <div className="mt-2 space-y-1">
                        {/* Progress Bar */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {setData.ownedParts}/{setData.totalParts} parts
                          </span>
                          <div className="flex items-center gap-1">
                            <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-tenno-blue transition-all duration-300"
                                style={{ width: `${setData.completionPercentage}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400">
                              {Math.round(setData.completionPercentage)}%
                            </span>
                          </div>
                        </div>

                        {/* Farming Analysis */}
                        <div className="text-xs text-gray-500 space-y-0.5">
                          {setData.obtainableFromRelics && setData.obtainableFromRelics.length > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                              <span>{setData.obtainableFromRelics.length} from relics</span>
                            </div>
                          )}
                          {setData.investmentAnalysis?.missingPartsToBuy && setData.investmentAnalysis.missingPartsToBuy.length > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                              <span>{setData.investmentAnalysis.missingPartsToBuy.length} need to buy</span>
                            </div>
                          )}
                          {/* Individual Parts Value (for comparison) */}
                          {setData.individualPartsValue !== undefined && setData.individualPartsValue > 0 && (
                            <div className="flex items-center gap-1 mt-1 pt-1 border-t border-gray-600/50">
                              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                              <span className="text-blue-400">
                                Parts Value: {setData.individualPartsValue}p
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {(() => {
                    const reservation = isItemReserved(item.name, 'prime_parts');
                    if (reservation.reserved) {
                      return (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Shield size={8} className={reservation.isPriority ? 'text-red-400' : 'text-yellow-400'} />
                          <span className={`text-xs truncate ${reservation.isPriority ? 'text-red-400' : 'text-yellow-400'}`}>
                            {reservation.isPriority ? 'Priority' : 'Reserved'}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {item.status === 'error' && item.error && (
                    <div className="text-xs text-grineer-red mt-0.5 truncate">
                      {item.error}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {showActionButtons && (
                <div className="flex items-center gap-1">
                  {onRefreshItem && isPrimePartTradeable(item) && (
                    <button
                      onClick={() => onRefreshItem(item.name)}
                      disabled={item.status === 'loading'}
                      className={`p-1 rounded text-xs transition-colors ${
                        item.status === 'loading'
                          ? 'text-gray-500 cursor-not-allowed'
                          : 'text-tenno-blue hover:bg-gray-700/50'
                      }`}
                      title="Refresh price"
                    >
                      <RefreshCw size={12} className={item.status === 'loading' ? 'animate-spin' : ''} />
                    </button>
                  )}
                  {onRemoveItem && (
                    <button
                      onClick={() => onRemoveItem(item.name)}
                      className="p-1 rounded text-xs text-grineer-red hover:bg-gray-700/50 transition-colors"
                      title="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Price and Info Display */}
            {isPrimePartTradeable(item) ? (
              // Tradeable items: Show full price info (hide Ducats for prime_sets)
              <div className={`grid ${item.category === 'prime_sets' ? 'grid-cols-2' : 'grid-cols-3'} gap-2 text-sm mb-2`}>
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">Current / Avg</div>
                  {item.status === 'loading' ? (
                    <div className="h-5 w-12 bg-gray-700 rounded animate-pulse mx-auto"></div>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <Zap size={12} className="text-gray-300" />
                      <span className="font-semibold text-gray-300">
                        {item.category === 'prime_sets' && item.setData ? (
                          // For Prime Sets, show complete set price
                          item.setData.completeSetPrice && item.setData.completeSetPrice > 0
                            ? `${item.setData.completeSetPrice}p`
                            : 'No buyers'
                        ) : (
                          // For individual parts, show individual price
                          item.price && item.price > 0 ? `${item.price}p` : 'No buyers'
                        )}
                        {item.category === 'prime_sets' && item.setData?.completeSetAverage && item.setData.completeSetAverage !== item.setData.completeSetPrice && (
                          <span className="text-gray-500 ml-1">/ {item.setData.completeSetAverage}p</span>
                        )}
                        {item.category !== 'prime_sets' && item.average && item.average !== item.price && (
                          <span className="text-gray-500 ml-1">/ {item.average}p</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Only show Ducats for non-prime_sets items */}
                {item.category !== 'prime_sets' && (
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-1">Ducats</div>
                    {item.ducats ? (
                      <div className="flex items-center justify-center gap-1">
                        <Coins size={12} className="text-yellow-500" />
                        <span className="font-semibold text-yellow-500">
                          {item.ducats}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-600 text-xs">-</span>
                    )}
                  </div>
                )}

                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">Total</div>
                  <div className="flex items-center justify-center gap-1">
                    <Zap size={12} className="text-yellow-400" />
                    <span className="font-semibold text-yellow-400">
                      {item.category === 'prime_sets' && item.setData ? (
                        // For Prime Sets, show complete set price as total value
                        item.setData.completeSetPrice && item.setData.completeSetPrice > 0
                          ? `${item.setData.completeSetPrice}p`
                          : '0p'
                      ) : (
                        // For individual parts, show quantity * price
                        `${((item.price || 0) * (item.quantity || 1))}p`
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              // Non-tradeable items: Show only ducats and "Not Tradeable" message
              <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">Ducats</div>
                  {item.ducats ? (
                    <div className="flex items-center justify-center gap-1">
                      <Coins size={12} className="text-yellow-500" />
                      <span className="font-semibold text-yellow-500">
                        {item.ducats}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-600 text-xs">-</span>
                  )}
                </div>

                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">Status</div>
                  <span className="text-xs text-orange-400">Not Tradeable</span>
                </div>
              </div>
            )}

            {/* Market Actions - Only show for tradeable items */}
            {isPrimePartTradeable(item) && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
                <div className="flex items-center gap-3">
                  {item.volume && (
                    <div className="text-xs text-gray-500">
                      Vol: {item.volume}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {item.buyerUsername && item.price && item.price > 0 && !isItemReserved(item.name, 'prime_parts').reserved ? (
                    <button
                    onClick={() => {
                      const message = `/w ${item.buyerUsername} Hi! I want to sell: "${item.name}" for ${item.price} platinum. (warframe.market)`;
                      handleClipboardCopy(message, item.id);
                    }}
                    className={`flex items-center gap-1 text-tenno-blue hover:text-tenno-light transition-colors text-xs ${
                      copiedItems.has(item.id) ? 'text-tenno-light' : ''
                    }`}
                  >
                    {copiedItems.has(item.id) ? <Check size={10} /> : <MessageCircle size={10} />}
                    <span className="hidden sm:inline">Message</span>
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-gray-600 text-xs">
                    <MessageCircle size={10} />
                    <span className="hidden sm:inline">
                      {isItemReserved(item.name, 'prime_parts').reserved ? "Reserved" : "No buyers"}
                    </span>
                  </span>
                )}
                <a
                  href={`https://warframe.market/items/${item.category === 'prime_sets'
                    ? item.name.toLowerCase().replace(/ /g, '_') + '_set'
                    : item.name.toLowerCase().replace(/ /g, '_')
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors text-xs"
                >
                  <ExternalLink size={10} />
                  <span className="hidden sm:inline">Market</span>
                </a>
                </div>
              </div>
            )}

            {/* Toggle Button & Expandable Details for Prime Sets */}
            {item.category === 'prime_sets' && item.setData && (() => {
              const isExpanded = expandedSets.has(item.id);
              const setData = item.setData;

              return (
                <>
                  {/* Toggle Button */}
                  <button
                    onClick={() => toggleSetExpansion(item.id)}
                    className="w-full mt-2 pt-2 border-t border-gray-700/50 flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
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

                  {/* Expandable Detail Section */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-700/50 space-y-3">
                      {/* Legend */}
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <div className="flex items-center gap-1">
                          <Package size={12} className="text-green-400" />
                          <span>In Inventory</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Hexagon size={12} className="text-yellow-400" />
                          <span>From Relics</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Circle size={12} className="text-gray-500" />
                          <span>Market Only</span>
                        </div>
                      </div>

                      {/* Parts List */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-400/70">Part</span>
                          <span className="text-gray-400/70">Source</span>
                        </div>
                        {setData.ownedParts?.map((partName: string, index: number) => (
                          <div key={`owned-${index}`} className="flex items-center justify-between text-xs bg-gray-800/20 rounded px-2 py-1">
                            <div className="flex items-center gap-1 text-green-400">
                              <Package size={12} />
                              <span className="truncate">{partName}</span>
                            </div>
                            <span className="text-green-400 text-xs">In Inventory</span>
                          </div>
                        ))}

                        {setData.obtainableFromRelics?.map((partName: string, index: number) => (
                          <div key={`relic-${index}`} className="flex items-center justify-between text-xs bg-gray-800/20 rounded px-2 py-1">
                            <div className="flex items-center gap-1 text-yellow-400">
                              <Hexagon size={12} />
                              <span className="truncate">{partName}</span>
                            </div>
                            <span className="text-yellow-400 text-xs">From Relics</span>
                          </div>
                        ))}

                        {setData.investmentAnalysis?.missingPartsToBuy?.map((partName: string, index: number) => (
                          <div key={`missing-${index}`} className="flex items-center justify-between text-xs bg-gray-800/20 rounded px-2 py-1">
                            <div className="flex items-center gap-1 text-gray-500">
                              <Circle size={12} />
                              <span className="truncate">{partName}</span>
                            </div>
                            <span className="text-gray-500 text-xs">Market only</span>
                          </div>
                        ))}
                      </div>

                      {/* Trading Comparison (if available) */}
                      {setData.completeSetPrice && setData.individualPartsValue && (
                        <div className="p-2 bg-gray-800/30 rounded border border-gray-700/50">
                          <div className="text-xs text-gray-400 mb-2">Trading Comparison</div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span>Sell as Complete Set:</span>
                              <span className="text-green-400">{setData.completeSetPrice}p</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Sell Individual Parts:</span>
                              <span className="text-blue-400">{setData.individualPartsValue}p</span>
                            </div>
                            {setData.profitDifference !== undefined && (
                              <div className="flex justify-between border-t border-gray-700/50 pt-1">
                                <span>Difference:</span>
                                <span className={setData.profitDifference > 0 ? 'text-green-400' : 'text-red-400'}>
                                  {setData.profitDifference > 0 ? '+' : ''}{setData.profitDifference}p
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ))}
        </div>
      </div>

      {/* Tap outside to close sort options */}
      {showSortOptions && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSortOptions(false)}
        />
      )}

      {/* Tap outside to close action menu */}
      {activeActionMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setActiveActionMenu(null)}
        />
      )}
    </div>
  );
};

export default PrimeParts;