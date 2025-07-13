import React, { useState } from 'react';
import { DetectedItem } from '../types';
import { ArrowUpDown, ExternalLink, AlertCircle, Coins, Trash2, RefreshCw, Filter, Zap, MoreVertical, MessageCircle, Check, Shield, Eye, EyeOff } from 'lucide-react';
import { isItemReserved } from '../services/buildPlanService';

interface ResultsTableProps {
  results: DetectedItem[];
  isLoading?: boolean;
  onRemoveItem?: (itemName: string) => void;
  onRefreshItem?: (itemName: string) => void;
  showActionButtons?: boolean;
}

const ResultsTable: React.FC<ResultsTableProps> = ({
  results,
  isLoading = false,
  onRemoveItem,
  onRefreshItem,
  showActionButtons = false
}) => {
  const [sortField, setSortField] = useState<'price' | 'name' | 'ducats' | 'totalValue'>('price');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());
  const [showUnreservedOnly, setShowUnreservedOnly] = useState(false);

  const handleSort = (field: 'price' | 'name' | 'ducats' | 'totalValue') => {
    console.log(`>>> [ResultsTable] Sort clicked: ${field}, current: ${sortField}, direction: ${sortDirection} <<<`);

    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
    setShowSortOptions(false);

    console.log(`>>> [ResultsTable] Sort applied: field=${field}, direction=${sortDirection === 'asc' ? 'desc' : 'asc'} <<<`);
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

  // Apply filter for unreserved items only
  const filteredResults = showUnreservedOnly
    ? results.filter(item => !isItemReserved(item.name, 'prime_parts').reserved)
    : results;

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
    } else {
      const result = sortDirection === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
      return result;
    }
  });

  // Debug logging
  console.log(`>>> [ResultsTable] Sorting by ${sortField} ${sortDirection}, first 3 items:`,
    sortedResults.slice(0, 3).map(item => ({
      name: item.name,
      price: item.price,
      ducats: item.ducats
    }))
  );

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
              {showUnreservedOnly ? (
                <>
                  {filteredResults.length} of {results.length} unreserved
                </>
              ) : (
                <>
                  {results.length} item{results.length !== 1 ? 's' : ''}
                </>
              )}
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
              {showUnreservedOnly ? <EyeOff size={12} /> : <Eye size={12} />}
              <span className="hidden sm:inline">
                {showUnreservedOnly ? 'Show All' : 'Unreserved Only'}
              </span>
            </button>
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
                  {item.imgUrl ? (
                    <img
                      src={item.imgUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <AlertCircle size={12} className="text-gray-500" />
                    </div>
                  )}
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
                  {(() => {
                    const reservation = isItemReserved(item.name, 'prime_parts');
                    if (reservation.reserved) {
                      return (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Shield size={8} className={reservation.isPriority ? 'text-red-400' : 'text-yellow-400'} />
                          <span className={`text-xs truncate ${reservation.isPriority ? 'text-red-400' : 'text-yellow-400'}`}>
                            {reservation.reservedFor.join(', ')}
                            {reservation.isPriority && ' (PRIORITY)'}
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
                  {onRefreshItem && (
                    <button
                      onClick={() => onRefreshItem(item.name)}
                      disabled={item.status === 'loading'}
                      className={`p-1 rounded text-xs transition-colors ${
                        item.status === 'loading'
                          ? 'text-gray-500 cursor-not-allowed'
                          : 'text-tenno-blue hover:bg-gray-700/50'
                      }`}
                      title="Refresh"
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

            {/* Compact Price Display */}
            <div className="grid grid-cols-3 gap-2 text-sm mb-2">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Current</div>
                {item.status === 'loading' ? (
                  <div className="h-5 w-12 bg-gray-700 rounded animate-pulse mx-auto"></div>
                ) : (
                  <div className="flex items-center justify-center gap-1">
                    <Zap size={12} className="text-gray-300" />
                    <span className="font-semibold text-gray-300">
                      {item.price || 0}p
                    </span>
                  </div>
                )}
              </div>
              
              {item.average && (
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">Average</div>
                  <div className="flex items-center justify-center gap-1">
                    <Zap size={12} className="text-gray-500" />
                    <span className="font-semibold text-gray-500">
                      {item.average}p
                    </span>
                  </div>
                </div>
              )}
              
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Total</div>
                <div className="flex items-center justify-center gap-1">
                  <Zap size={12} className="text-yellow-400" />
                  <span className="font-semibold text-yellow-400">
                    {((item.price || 0) * (item.quantity || 1))}p
                  </span>
                </div>
              </div>
            </div>

            {/* Compact Ducats & Market Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
              <div className="flex items-center gap-3">
                {item.ducats && (
                  <div className="flex items-center gap-1">
                    <Coins size={12} className="text-yellow-500" />
                    <span className="text-sm font-medium text-yellow-500">
                      {item.ducats}
                    </span>
                  </div>
                )}
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
                  href={`https://warframe.market/items/${item.name.toLowerCase().replace(/ /g, '_')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors text-xs"
                >
                  <ExternalLink size={10} />
                  <span className="hidden sm:inline">Market</span>
                </a>
              </div>
            </div>
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

export default ResultsTable;