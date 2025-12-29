import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DetectedItem } from '../types';
import {
  Zap,
  Coins,
  ArrowUpDown,
  RefreshCw,
  Trash2,
  MessageCircle,
  Check,
  AlertCircle,
  Shield,
  ExternalLink,
  Package,
  Star,
  Circle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { isItemReserved } from '../services/buildPlanService';
import { getImageUrlSync } from '../services/unifiedImageService';
import LastRefreshInfo from './LastRefreshInfo';
import { getPrimeSetsCache } from '../services/staticDataService';

// Helper: Check if a prime part is tradeable
// Built warframe components (chassis, systems, neuroptics without blueprint) are NOT tradeable
const isPrimePartTradeable = (itemName: string): boolean => {
  const lowerName = itemName.toLowerCase();
  
  // Check if it's a blueprint - blueprints are always tradeable
  if (lowerName.includes('blueprint')) {
    return true;
  }
  
  // Check if it's a warframe component (chassis, systems, neuroptics)
  const warframeComponents = ['chassis', 'systems', 'neuroptics'];
  const matchingComponent = warframeComponents.find(component => lowerName.includes(component));
  
  if (!matchingComponent) {
    // Not a warframe component, so it's tradeable (weapons, etc.)
    return true;
  }
  
  // It's a warframe component without "blueprint" - check if it belongs to a warframe set
  const primeSets = getPrimeSetsCache();
  if (!primeSets || primeSets.length === 0) {
    // Can't determine, assume tradeable to be safe
    return true;
  }
  
  // Extract the prime set name from the item name
  // Pattern: "Wisp Prime Chassis" -> "Wisp Prime"
  // Pattern: "Harrow Prime Systems" -> "Harrow Prime"
  const words = itemName.split(' ');
  const primeIndex = words.findIndex(w => w.toLowerCase() === 'prime');
  
  if (primeIndex === -1 || primeIndex === 0) {
    // No "Prime" found or it's the first word, assume tradeable
    return true;
  }
  
  // Extract set name: everything up to and including "Prime"
  const setName = words.slice(0, primeIndex + 1).join(' ');
  
  // Check if this set exists and is a Warframe
  const matchingSet = primeSets.find(set => 
    set.name.toLowerCase() === setName.toLowerCase() && set.type === 'Warframe'
  );
  
  if (matchingSet) {
    // It's a built warframe component - NOT tradeable
    return false;
  }
  
  // Not found in warframe sets, assume tradeable (might be a weapon component with similar name)
  return true;
};

interface PrimePartsProps {
  results: DetectedItem[];
  isLoading?: boolean;
  onRemoveItem?: (itemName: string) => void;
  onRefreshItem?: (itemName: string) => void;
  showActionButtons?: boolean;
  lastRefreshTime?: Date | null;
  onFilteredItemsChange?: (items: DetectedItem[]) => void;
}

const PrimeParts: React.FC<PrimePartsProps> = ({
  results,
  isLoading = false,
  onRemoveItem,
  onRefreshItem,
  showActionButtons = false,
  lastRefreshTime,
  onFilteredItemsChange
}) => {
  const [sortField, setSortField] = useState<'price' | 'name' | 'ducats' | 'totalValue' | 'ratio'>('price');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['all']));
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());

  // Helper function to get the correct image URL for items
  const getItemImageUrl = (item: DetectedItem): string => {
    if (item.category === 'prime_parts') {
      // For prime parts, use the unified image service to get parent set image
      const imageUrl = getImageUrlSync(item.name);
      return imageUrl || '/images/primeparts/unknown.png';
    }
    // For other categories, use the original imgUrl
    return item.imgUrl || '';
  };

  // Helper function to calculate plat/ducat ratio
  const calculateRatio = (item: DetectedItem): number => {
    if (!item.ducats || item.ducats === 0) return Infinity;
    return (item.price || 0) / (item.ducats * 0.1);
  };

  const handleSort = (field: 'price' | 'name' | 'ducats' | 'totalValue' | 'ratio') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      // Default direction: ascending for ratio and name, descending for others
      if (field === 'ratio' || field === 'name') {
        setSortDirection('asc');
      } else {
        setSortDirection('desc');
      }
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

  // Toggle filter function
  const toggleFilter = (filterId: string) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (filterId === 'all') {
        return new Set(['all']);
      } else {
        newFilters.delete('all');
        // Mutually exclusive pairs
        if (filterId === 'blueprints') newFilters.delete('components');
        if (filterId === 'components') newFilters.delete('blueprints');
        if (filterId === 'above_average') newFilters.delete('below_average');
        if (filterId === 'below_average') newFilters.delete('above_average');
        if (filterId === 'reserved') newFilters.delete('not_reserved');
        if (filterId === 'not_reserved') newFilters.delete('reserved');
        if (newFilters.has(filterId)) {
          newFilters.delete(filterId);
        } else {
          newFilters.add(filterId);
        }
        if (newFilters.size === 0) {
          newFilters.add('all');
        }
      }
      return newFilters;
    });
  };

  // Apply smart filters
  let filteredResults = results;

  if (!activeFilters.has('all')) {
    filteredResults = filteredResults.filter(item => {
      return Array.from(activeFilters).every(filterId => {
        switch (filterId) {
          case 'has_buyers': return (item.price || 0) > 0;
          case 'blueprints': return item.name.includes('Blueprint');
          case 'components': return !item.name.includes('Blueprint');
          case 'reserved': return isItemReserved(item.name, 'prime_parts').reserved;
          case 'not_reserved': return !isItemReserved(item.name, 'prime_parts').reserved;
          case 'above_average': return (item.price || 0) > (item.average || 0);
          case 'below_average': return (item.price || 0) < (item.average || 0);
          case 'prime_junk': {
            const ratio = calculateRatio(item);
            return ratio < 1.0 && (item.ducats || 0) > 0;
          }
          default: return true;
        }
      });
    });
  }

  const sortedResults = useMemo(() => {
    return [...filteredResults].sort((a, b) => {
      if (sortField === 'price') {
        const priceA = a.price || 0;
        const priceB = b.price || 0;
        return sortDirection === 'asc' ? priceA - priceB : priceB - priceA;
      } else if (sortField === 'ducats') {
        const ducatsA = a.ducats || 0;
        const ducatsB = b.ducats || 0;
        return sortDirection === 'asc' ? ducatsA - ducatsB : ducatsB - ducatsA;
      } else if (sortField === 'totalValue') {
        const totalValueA = (a.price || 0) * (a.quantity || 1);
        const totalValueB = (b.price || 0) * (b.quantity || 1);
        return sortDirection === 'asc' ? totalValueA - totalValueB : totalValueB - totalValueA;
      } else if (sortField === 'ratio') {
        const ratioA = calculateRatio(a);
        const ratioB = calculateRatio(b);
        return sortDirection === 'asc' ? ratioA - ratioB : ratioB - ratioA;
      } else {
        const nameComp = sortDirection === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
        return nameComp;
      }
    });
  }, [filteredResults, sortField, sortDirection]);

  // Report filtered items to parent (with stable reference to prevent infinite loops)
  const previousResultsRef = useRef<string>('');
  useEffect(() => {
    if (onFilteredItemsChange) {
      // Create a stable identifier based on the actual content
      const currentKey = sortedResults.map(r => r.id).join(',');
      if (currentKey !== previousResultsRef.current) {
        previousResultsRef.current = currentKey;
        onFilteredItemsChange(sortedResults);
      }
    }
  }, [sortedResults, onFilteredItemsChange]);


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

  const getSortLabel = () => {
    switch (sortField) {
      case 'price': return 'Price';
      case 'ducats': return 'Ducats';
      case 'totalValue': return 'Total Value';
      case 'name': return 'Name';
      case 'ratio': return 'Ratio';
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
              {sortedResults.length} of {results.length} item{results.length !== 1 ? 's' : ''}
            </div>
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
                      handleSort('ratio');
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Zap size={12} className="text-blue-400" />
                    Ratio {sortField === 'ratio' && (sortDirection === 'asc' ? '↑' : '↓')}
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

        {/* Smart Filter Tags */}
        <div className="px-3 py-2 bg-gray-900/30 border-t border-gray-700/50">
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => toggleFilter('all')} 
              className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                activeFilters.has('all')
                  ? 'bg-blue-900/50 border-blue-500/50 text-blue-400 ring-1 ring-blue-500/30'
                  : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
              }`}
            >
              <Shield size={16} />
              <span>All Parts</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilters.has('all') ? 'bg-blue-800/50 text-blue-300' : 'bg-gray-800/50 text-gray-400'
              }`}>
                {results?.length || 0}
              </span>
            </button>
            <button 
              onClick={() => toggleFilter('has_buyers')} 
              className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                activeFilters.has('has_buyers')
                  ? 'bg-green-900/50 border-green-500/50 text-green-400 ring-1 ring-green-500/30'
                  : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
              }`}
            >
              <Zap size={16} />
              <span>Has Buyers</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilters.has('has_buyers') ? 'bg-green-800/50 text-green-300' : 'bg-gray-800/50 text-gray-400'
              }`}>
                {(results || []).filter(i => i && (i.price || 0) > 0).length}
              </span>
            </button>
            <button 
              onClick={() => toggleFilter('blueprints')} 
              className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                activeFilters.has('blueprints')
                  ? 'bg-blue-900/50 border-blue-500/50 text-blue-400 ring-1 ring-blue-500/30'
                  : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
              }`}
            >
              <Package size={16} />
              <span>Blueprints</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilters.has('blueprints') ? 'bg-blue-800/50 text-blue-300' : 'bg-gray-800/50 text-gray-400'
              }`}>
                {(results || []).filter(i => i && i.name && i.name.includes('Blueprint')).length}
              </span>
            </button>
            <button 
              onClick={() => toggleFilter('components')} 
              className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                activeFilters.has('components')
                  ? 'bg-cyan-900/50 border-cyan-500/50 text-cyan-400 ring-1 ring-cyan-500/30'
                  : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
              }`}
            >
              <Shield size={16} />
              <span>Components</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilters.has('components') ? 'bg-cyan-800/50 text-cyan-300' : 'bg-gray-800/50 text-gray-400'
              }`}>
                {(results || []).filter(i => i && i.name && !i.name.includes('Blueprint')).length}
              </span>
            </button>
            <button 
              onClick={() => toggleFilter('reserved')} 
              className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                activeFilters.has('reserved')
                  ? 'bg-yellow-900/50 border-yellow-500/50 text-yellow-400 ring-1 ring-yellow-500/30'
                  : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
              }`}
            >
              <Star size={16} />
              <span>Reserved</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilters.has('reserved') ? 'bg-yellow-800/50 text-yellow-300' : 'bg-gray-800/50 text-gray-400'
              }`}>
                {(results || []).filter(i => {
                  try {
                    return i && i.name && isItemReserved(i.name, 'prime_parts').reserved;
                  } catch {
                    return false;
                  }
                }).length}
              </span>
            </button>
            <button 
              onClick={() => toggleFilter('not_reserved')} 
              className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                activeFilters.has('not_reserved')
                  ? 'bg-purple-900/50 border-purple-500/50 text-purple-400 ring-1 ring-purple-500/30'
                  : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
              }`}
            >
              <Circle size={16} />
              <span>Not Reserved</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilters.has('not_reserved') ? 'bg-purple-800/50 text-purple-300' : 'bg-gray-800/50 text-gray-400'
              }`}>
                {(results || []).filter(i => {
                  try {
                    return i && i.name && !isItemReserved(i.name, 'prime_parts').reserved;
                  } catch {
                    return false;
                  }
                }).length}
              </span>
            </button>
            <button 
              onClick={() => toggleFilter('above_average')} 
              className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                activeFilters.has('above_average')
                  ? 'bg-green-900/50 border-green-500/50 text-green-400 ring-1 ring-green-500/30'
                  : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
              }`}
            >
              <TrendingUp size={16} />
              <span>Above Avg</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilters.has('above_average') ? 'bg-green-800/50 text-green-300' : 'bg-gray-800/50 text-gray-400'
              }`}>
                {(results || []).filter(i => i && (i.price || 0) > (i.average || 0)).length}
              </span>
            </button>
            <button 
              onClick={() => toggleFilter('below_average')} 
              className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                activeFilters.has('below_average')
                  ? 'bg-red-900/50 border-red-500/50 text-red-400 ring-1 ring-red-500/30'
                  : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
              }`}
            >
              <TrendingDown size={16} />
              <span>Below Avg</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilters.has('below_average') ? 'bg-red-800/50 text-red-300' : 'bg-gray-800/50 text-gray-400'
              }`}>
                {(results || []).filter(i => i && (i.price || 0) < (i.average || 0)).length}
              </span>
            </button>
            <button 
              onClick={() => toggleFilter('prime_junk')} 
              className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                activeFilters.has('prime_junk')
                  ? 'bg-yellow-900/50 border-yellow-500/50 text-yellow-400 ring-1 ring-yellow-500/30'
                  : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
              }`}
            >
              <Trash2 size={16} />
              <span>Prime Junk</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilters.has('prime_junk') ? 'bg-yellow-800/50 text-yellow-300' : 'bg-gray-800/50 text-gray-400'
              }`}>
                {(results || []).filter(i => {
                  try {
                    if (!i) return false;
                    const ratio = calculateRatio(i);
                    return ratio < 1.0 && (i.ducats || 0) > 0;
                  } catch {
                    return false;
                  }
                }).length}
              </span>
            </button>
          </div>
        </div>

        {/* Empty-state when filters hide all items but inventory is not empty */}
        {sortedResults.length === 0 && results.length > 0 && !activeFilters.has('all') && (
          <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg m-3">
            <p className="text-gray-400">No items match the selected filters.</p>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your filter selection.</p>
          </div>
        )}

        {/* Mobile cards */}
        {sortedResults.length > 0 && (
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
                      {onRefreshItem && isPrimePartTradeable(item.name) && (
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
                {isPrimePartTradeable(item.name) ? (
              // Tradeable items: Show full price info
                  <div className="grid grid-cols-4 gap-2 text-sm mb-2">
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">Current / Avg</div>
                  {item.status === 'loading' ? (
                    <div className="h-5 w-12 bg-gray-700 rounded animate-pulse mx-auto"></div>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <Zap size={12} className="text-gray-300" />
                      <span className="font-semibold text-gray-300">
                        {item.price && item.price > 0 ? `${item.price}p` : 'No buyers'}
                        {item.average && item.average !== item.price && (
                          <span className="text-gray-500 ml-1">/ {item.average}p</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

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
                      <div className="text-xs text-gray-400 mb-1">Ratio</div>
                      {item.ducats ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className={`font-semibold text-xs ${calculateRatio(item) < 1.0 ? 'text-yellow-300' : 'text-blue-300'}`}>
                            {calculateRatio(item).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs">-</span>
                      )}
                    </div>

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
                  <span className="text-xs text-orange-400">Built (Not Tradeable)</span>
                </div>
              </div>
            )}

            {/* Market Actions - Only show for tradeable items */}
                {isPrimePartTradeable(item.name) && (
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
            )}
          </div>
            ))}
          </div>
        )}
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