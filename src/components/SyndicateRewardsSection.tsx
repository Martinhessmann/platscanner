import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, TrendingUp, Shield, Zap, Trash2, ExternalLink, Sword, Package, Star, Heart, X, Coins, CheckCircle, Circle } from 'lucide-react';
import { SyndicateReward } from '../types';
import {
  getAllSyndicateRewards,
  fetchSyndicateRewardPrices,
  sortSyndicateRewards,
  filterSyndicateRewards,
  getAvailableSyndicates
} from '../services/syndicateService';
import LastRefreshInfo from './LastRefreshInfo';

interface SyndicateRewardsSectionProps {
  isRefreshing: boolean;
  onRefreshStart: (itemsToRefresh?: SyndicateReward[]) => void;
  onRefreshComplete: () => void;
  onCancel?: () => void;
  onClearAll: () => void;
  onRemoveItem: (itemName: string) => void;
  onRefreshItem?: (itemName: string) => void;
  refreshTrigger?: number;
  progress?: { current: number; total: number };
  lastRefreshTime?: Date | null;
}

const SyndicateRewardsSection: React.FC<SyndicateRewardsSectionProps> = ({
  isRefreshing,
  onRefreshStart,
  onRefreshComplete,
  onCancel,
  onClearAll,
  onRemoveItem,
  onRefreshItem,
  refreshTrigger,
  progress,
  lastRefreshTime
}) => {
  const [rewards, setRewards] = useState<SyndicateReward[]>([]);
  const [refreshingItems, setRefreshingItems] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['all']));
  const [sortBy, setSortBy] = useState<'platPerStanding' | 'price' | 'standingCost' | 'name' | 'syndicate'>('platPerStanding');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showNonTradable, setShowNonTradable] = useState(false); // Default to hiding non-tradable items

  const sectionRef = useRef<HTMLDivElement>(null);

  // Persistent accordion state
  useEffect(() => {
    const stored = localStorage.getItem('accordion_syndicate_rewards');
    if (stored !== null) {
      setIsExpanded(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('accordion_syndicate_rewards', JSON.stringify(isExpanded));
  }, [isExpanded]);

  // Auto-scroll to section when collapsing
  const handleToggle = () => {
    if (isExpanded && sectionRef.current) {
      sectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
    setIsExpanded(!isExpanded);
  };

  // Load syndicate rewards from inventory
  useEffect(() => {
    const loadRewards = () => {
      const syndicateRewards = getAllSyndicateRewards();

      // Mark items as loading if they're being refreshed
      // Also ensure items without status get a default status so they're not filtered out
      const updatedRewards = syndicateRewards.map(reward => ({
        ...reward,
        status: refreshingItems.has(reward.name)
          ? 'loading' as const
          : (reward.status || 'loaded' as const) // Default to 'loaded' if status is missing
      }));

      console.log(`>>> [SyndicateRewardsSection] Loaded ${updatedRewards.length} rewards from inventory <<<`);
      setRewards(updatedRewards);
    };

    loadRewards();
  }, [refreshTrigger, refreshingItems]);

  // Use rewards directly from inventory
  const allRewards = rewards;

  // Helper function to handle filter toggling
  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => {
      const updated = new Set(prev);

      if (filter === 'all') {
        // If clicking "All", clear other filters
        return new Set(['all']);
      } else {
        // Remove "all" if selecting specific filters
        updated.delete('all');

        // Special case: "Has Buyers" and "No Buyers" are mutually exclusive
        if (filter === 'hasBuyers') {
          updated.delete('noBuyers');
        } else if (filter === 'noBuyers') {
          updated.delete('hasBuyers');
        }

        // Toggle the specific filter
        if (updated.has(filter)) {
          updated.delete(filter);
        } else {
          updated.add(filter);
        }

        // If no filters remain, default to "all"
        if (updated.size === 0) {
          updated.add('all');
        }
      }

      return updated;
    });
  };

  // Apply filters and sorting
  const filteredAndSortedRewards = useMemo(() => {
    let filtered = allRewards;

    // Apply smart filter buttons (activeFilters)
    if (!activeFilters.has('all')) {
      filtered = filtered.filter(reward => {
        // Check buyer status filter (mutually exclusive - OR logic)
        const hasBuyersFilter = activeFilters.has('hasBuyers');
        const noBuyersFilter = activeFilters.has('noBuyers');
        let buyerMatch = true;

        if (hasBuyersFilter || noBuyersFilter) {
          const hasBuyers = reward.hasBuyers && reward.price && reward.price > 0 && reward.buyerUsername;
          // OR logic: match if either hasBuyers filter is active and item has buyers,
          // OR noBuyers filter is active and item has no buyers
          buyerMatch = (hasBuyersFilter && hasBuyers) || (noBuyersFilter && !hasBuyers);
        }

        // If buyer filter doesn't match, skip this item
        if (!buyerMatch) {
          return false;
        }

        // Check all other filters (combinable - AND logic)
        return Array.from(activeFilters).every(filter => {
          // Skip buyer filters (already handled above)
          if (filter === 'hasBuyers' || filter === 'noBuyers') {
            return true;
          }

          switch (filter) {
            case 'mod':
              return reward.itemType === 'mod';
            case 'weapon':
              return reward.itemType === 'weapon';
            case 'cosmetic':
              return reward.itemType === 'cosmetic';
            case 'resource':
              return reward.itemType === 'resource';
            default:
              // Handle syndicate name filters (e.g., 'syndicate:Cephalon Suda')
              if (filter.startsWith('syndicate:')) {
                const syndicateName = filter.replace('syndicate:', '');
                return reward.syndicate === syndicateName;
              }
              return true;
          }
        });
      });
    }

    // Filter out non-tradable items by default (unless explicitly shown)
    if (!showNonTradable) {
      filtered = filtered.filter(reward => {
        // Show items with real buyer data (hasBuyers + buyerUsername + price > 0)
        if (reward.hasBuyers && reward.price && reward.price > 0 && reward.buyerUsername) {
          return true;
        }
        // Show items that are loading
        if (reward.status === 'loading') {
          return true;
        }
        // Show items with price > 0 even if they don't have buyer data
        // (might be from old data before buyer fields were added)
        if (reward.price && reward.price > 0) {
          return true;
        }
        // Hide items that have been fetched but have no buyers and no price
        // (status: 'error' or 'loaded' with no buyer data and no price)
        return false;
      });
    }

    // Advanced filters removed - now handled by smart filter buttons

    // Apply sorting
    return sortSyndicateRewards(filtered, sortBy, sortOrder);
  }, [allRewards, sortBy, sortOrder, activeFilters]);

  // Calculate filter counts for smart filter buttons
  const filterCounts = useMemo(() => {
    const hasBuyers = allRewards.filter(r => r.hasBuyers && r.price && r.price > 0 && r.buyerUsername).length;
    const noBuyers = allRewards.filter(r => !r.hasBuyers || !r.price || r.price === 0 || !r.buyerUsername).length;
    const mods = allRewards.filter(r => r.itemType === 'mod').length;
    const weapons = allRewards.filter(r => r.itemType === 'weapon').length;
    const cosmetics = allRewards.filter(r => r.itemType === 'cosmetic').length;
    const resources = allRewards.filter(r => r.itemType === 'resource').length;

    // Syndicate counts
    const syndicateCounts: Record<string, number> = {};
    allRewards.forEach(r => {
      if (r.syndicate) {
        syndicateCounts[r.syndicate] = (syndicateCounts[r.syndicate] || 0) + 1;
      }
    });

    return {
      all: allRewards.length,
      hasBuyers,
      noBuyers,
      mods,
      weapons,
      cosmetics,
      resources,
      syndicates: syndicateCounts
    };
  }, [allRewards]);

  // Calculate totals - only count items with real buyer data
  const totals = useMemo(() => {
    const loadedRewards = filteredAndSortedRewards.filter(r =>
      r.hasBuyers && r.price && r.price > 0 && r.buyerUsername
    );
    const totalValue = loadedRewards.reduce((sum, r) => sum + (r.price || 0), 0);
    const totalStanding = loadedRewards.reduce((sum, r) => sum + r.standingCost, 0);
    const avgPlatPerStanding = totalStanding > 0 ? totalValue / totalStanding : 0;

    const bestValueItem = loadedRewards.length > 0 ? loadedRewards.reduce((best, current) => {
      if (!best || (current.platPerStanding || 0) > (best.platPerStanding || 0)) {
        return current;
      }
      return best;
    }) : undefined;

    return {
      totalValue,
      totalStanding,
      avgPlatPerStanding,
      loadedCount: loadedRewards.length,
      totalCount: filteredAndSortedRewards.length,
      bestValueItem
    };
  }, [filteredAndSortedRewards]);

  const handleRefresh = async () => {
    // If filters are active, only refresh the filtered items
    const itemsToRefresh = !activeFilters.has('all')
      ? filteredAndSortedRewards
      : undefined; // undefined means refresh all items
    onRefreshStart(itemsToRefresh);
  };

  const handleRefreshItem = async (itemName: string) => {
    const item = rewards.find(r => r.name === itemName);
    if (!item) return;

    // Mark this item as refreshing
    setRefreshingItems(prev => new Set(prev).add(itemName));

    try {
      if (onRefreshItem) {
        await onRefreshItem(itemName);
      } else {
        const { fetchSyndicateRewardPrices } = await import('../services/syndicateService');
        const updatedRewards = await fetchSyndicateRewardPrices([item]);

        if (updatedRewards.length > 0) {
          const updatedReward = updatedRewards[0];
          setRewards(prev => prev.map(r => r.name === itemName ? updatedReward : r));
        }
      }
    } catch (error) {
      console.error(`Failed to refresh ${itemName}:`, error);
    } finally {
      setRefreshingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemName);
        return newSet;
      });
    }
  };

  const getItemTypeColor = (itemType: string) => {
    switch (itemType) {
      case 'weapon': return 'text-red-400';
      case 'mod': return 'text-blue-400';
      case 'cosmetic': return 'text-purple-400';
      case 'resource': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getTypeIcon = (itemType: string) => {
    switch (itemType) {
      case 'weapon': return <Sword size={14} />;
      case 'mod': return <Star size={14} />;
      case 'cosmetic': return <Heart size={14} />;
      case 'resource': return <Package size={14} />;
      default: return <Package size={14} />;
    }
  };

  const formatPlatPerStanding = (value: number | undefined) => {
    if (!value) return 'N/A';
    return `${value.toFixed(2)}`;
  };

  const formatStanding = (value: number) => {
    return value.toLocaleString();
  };

  const handleOpenMarket = (itemName: string) => {
    const urlName = itemName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    window.open(`https://warframe.market/items/${urlName}`, '_blank');
  };

  const syndicates = getAvailableSyndicates();

  if (rewards.length === 0) {
    return null; // Don't render empty sections
  }

  return (
    <div ref={sectionRef} className="mb-2">
      {/* Unified sticky header with consistent layout */}
      <div className="bg-gray-900/50 backdrop-blur-sm p-3 rounded-t-xl border border-gray-700/50 border-b-0 sticky top-0 z-20">
        <div className="flex items-center justify-between w-full">
          <button
            onClick={handleToggle}
            className="flex items-center gap-3 text-left group flex-1"
          >
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-400 group-hover:text-orokin-gold transition-colors" />
              ) : (
                <ChevronRight size={16} className="text-gray-400 group-hover:text-orokin-gold transition-colors" />
              )}
              <Shield size={20} className="text-orokin-gold" />
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-orokin-gold transition-colors">
                Syndicate Rewards
              </h3>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={isRefreshing ? onCancel : handleRefresh}
              disabled={!isRefreshing && !onCancel}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                isRefreshing
                  ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                  : 'text-tenno-blue hover:bg-tenno-blue/10'
              }`}
              title={isRefreshing ? "Cancel refresh" : "Refresh all syndicate rewards"}
            >
              {isRefreshing ? (
                <X size={12} />
              ) : (
                <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
              )}
              {isRefreshing && progress ? `${progress.current}/${progress.total}` : ''}
            </button>

            <button
              onClick={onClearAll}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-grineer-red hover:bg-grineer-red/10 transition-colors"
              title="Delete all syndicate rewards"
            >
              <Trash2 size={12} />
            </button>

            {lastRefreshTime && (
              <LastRefreshInfo
                lastRefreshDate={lastRefreshTime}
                className="text-xs text-gray-500"
              />
            )}
          </div>
        </div>

        {/* Progress bar - show when refreshing */}
        {isRefreshing && progress && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Refreshing prices...</span>
              <span className="text-xs text-gray-400">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-tenno-blue transition-all duration-300"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 border-t-0 rounded-b-xl overflow-hidden">
          {/* Item count, values, and sorting */}
          <div className="p-4 border-b border-gray-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{filteredAndSortedRewards.length} item{filteredAndSortedRewards.length !== 1 ? 's' : ''}</span>
                {totals.totalValue > 0 && (
                  <div className="flex items-center gap-1">
                    <Zap size={10} className="text-gray-300" />
                    <span className="text-gray-300">{totals.totalValue}p</span>
                  </div>
                )}
                {totals.totalStanding > 0 && (
                  <div className="flex items-center gap-1">
                    <TrendingUp size={10} className="text-purple-400" />
                    <span className="text-purple-400">{formatStanding(totals.totalStanding)}</span>
                  </div>
                )}
              </div>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [newSortBy, newSortOrder] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder];
                  setSortBy(newSortBy);
                  setSortOrder(newSortOrder);
                }}
                className="bg-gray-700/50 border border-gray-600 rounded px-3 py-1 text-sm text-white"
              >
                <option value="platPerStanding-desc">Best Value ↓</option>
                <option value="platPerStanding-asc">Best Value ↑</option>
                <option value="price-desc">Price ↓</option>
                <option value="price-asc">Price ↑</option>
                <option value="standingCost-desc">Standing ↓</option>
                <option value="standingCost-asc">Standing ↑</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
              </select>
            </div>
          </div>

          {/* Smart Filter Buttons */}
          <div className="flex flex-wrap gap-2 p-4 border-b border-gray-700/50">
            {/* All Items */}
            <button
              onClick={() => toggleFilter('all')}
              className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                activeFilters.has('all')
                  ? 'bg-blue-900/50 border-blue-500/50 text-blue-400 ring-1 ring-blue-500/30'
                  : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
              }`}
            >
              <Shield size={16} />
              <span>All Items</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilters.has('all') ? 'bg-blue-800/50 text-blue-300' : 'bg-gray-800/50 text-gray-400'
              }`}>
                {filterCounts.all}
              </span>
            </button>

            {/* Has Buyers */}
            <button
              onClick={() => toggleFilter('hasBuyers')}
              className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                activeFilters.has('hasBuyers')
                  ? 'bg-green-900/50 border-green-500/50 text-green-400 ring-1 ring-green-500/30'
                  : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
              }`}
            >
              <CheckCircle size={16} />
              <span>Has Buyers</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilters.has('hasBuyers') ? 'bg-green-800/50 text-green-300' : 'bg-gray-800/50 text-gray-400'
              }`}>
                {filterCounts.hasBuyers}
              </span>
            </button>

            {/* No Buyers */}
            <button
              onClick={() => toggleFilter('noBuyers')}
              className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                activeFilters.has('noBuyers')
                  ? 'bg-red-900/50 border-red-500/50 text-red-400 ring-1 ring-red-500/30'
                  : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
              }`}
            >
              <Circle size={16} />
              <span>No Buyers</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilters.has('noBuyers') ? 'bg-red-800/50 text-red-300' : 'bg-gray-800/50 text-gray-400'
              }`}>
                {filterCounts.noBuyers}
              </span>
            </button>

            {/* Item Types */}
            {filterCounts.mods > 0 && (
              <button
                onClick={() => toggleFilter('mod')}
                className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                  activeFilters.has('mod')
                    ? 'bg-blue-900/50 border-blue-500/50 text-blue-400 ring-1 ring-blue-500/30'
                    : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
                }`}
              >
                <Star size={16} />
                <span>Mod</span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  activeFilters.has('mod') ? 'bg-blue-800/50 text-blue-300' : 'bg-gray-800/50 text-gray-400'
                }`}>
                  {filterCounts.mods}
                </span>
              </button>
            )}

            {filterCounts.weapons > 0 && (
              <button
                onClick={() => toggleFilter('weapon')}
                className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                  activeFilters.has('weapon')
                    ? 'bg-red-900/50 border-red-500/50 text-red-400 ring-1 ring-red-500/30'
                    : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
                }`}
              >
                <Sword size={16} />
                <span>Weapon</span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  activeFilters.has('weapon') ? 'bg-red-800/50 text-red-300' : 'bg-gray-800/50 text-gray-400'
                }`}>
                  {filterCounts.weapons}
                </span>
              </button>
            )}

            {filterCounts.cosmetics > 0 && (
              <button
                onClick={() => toggleFilter('cosmetic')}
                className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                  activeFilters.has('cosmetic')
                    ? 'bg-purple-900/50 border-purple-500/50 text-purple-400 ring-1 ring-purple-500/30'
                    : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
                }`}
              >
                <Heart size={16} />
                <span>Cosmetic</span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  activeFilters.has('cosmetic') ? 'bg-purple-800/50 text-purple-300' : 'bg-gray-800/50 text-gray-400'
                }`}>
                  {filterCounts.cosmetics}
                </span>
              </button>
            )}

            {filterCounts.resources > 0 && (
              <button
                onClick={() => toggleFilter('resource')}
                className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                  activeFilters.has('resource')
                    ? 'bg-green-900/50 border-green-500/50 text-green-400 ring-1 ring-green-500/30'
                    : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
                }`}
              >
                <Package size={16} />
                <span>Resource</span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  activeFilters.has('resource') ? 'bg-green-800/50 text-green-300' : 'bg-gray-800/50 text-gray-400'
                }`}>
                  {filterCounts.resources}
                </span>
              </button>
            )}

            {/* Syndicate Filters */}
            {Object.entries(filterCounts.syndicates)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([syndicateName, count]) => (
                <button
                  key={syndicateName}
                  onClick={() => toggleFilter(`syndicate:${syndicateName}`)}
                  className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                    activeFilters.has(`syndicate:${syndicateName}`)
                      ? 'bg-orange-900/50 border-orange-500/50 text-orange-400 ring-1 ring-orange-500/30'
                      : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
                  }`}
                >
                  <Shield size={16} />
                  <span className="truncate max-w-[120px]">{syndicateName}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    activeFilters.has(`syndicate:${syndicateName}`) ? 'bg-orange-800/50 text-orange-300' : 'bg-gray-800/50 text-gray-400'
                  }`}>
                    {count}
                  </span>
                </button>
              ))}
          </div>


          {/* Mobile-friendly card layout */}
          {filteredAndSortedRewards.length > 0 ? (
            <div className="p-4 space-y-3">
              {filteredAndSortedRewards.map((reward, index) => (
                <div
                  key={`${reward.name}-${index}`}
                  className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:bg-gray-800/70 transition-colors"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">{reward.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">{reward.syndicate || 'Unknown'}</span>
                        <div className="flex items-center gap-1">
                          <span className={getItemTypeColor(reward.itemType)}>
                            {getTypeIcon(reward.itemType)}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${getItemTypeColor(reward.itemType)}`}>
                            {reward.itemType}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleRefreshItem(reward.name)}
                        disabled={refreshingItems.has(reward.name)}
                        className={`p-1 transition-colors ${
                          refreshingItems.has(reward.name)
                            ? 'text-gray-500 cursor-not-allowed'
                            : 'text-tenno-blue hover:text-tenno-light'
                        }`}
                        title="Refresh price"
                      >
                        <RefreshCw size={14} className={refreshingItems.has(reward.name) ? 'animate-spin' : ''} />
                      </button>
                      <button
                        onClick={() => handleOpenMarket(reward.name)}
                        className="text-tenno-blue hover:text-tenno-light p-1 transition-colors"
                        title="View on Warframe Market"
                      >
                        <ExternalLink size={14} />
                      </button>
                      <button
                        onClick={() => onRemoveItem(reward.name)}
                        className="text-red-400 hover:text-red-300 p-1 transition-colors"
                        title="Remove from inventory"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                                    {/* Price and standing info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Price</div>
                      {refreshingItems.has(reward.name) ? (
                        <div className="animate-pulse">
                          <div className="h-4 bg-gray-700 rounded w-12"></div>
                        </div>
                      ) : reward.hasBuyers && reward.price && reward.price > 0 && reward.buyerUsername ? (
                        <div>
                          <div className="text-green-400 font-medium">{reward.price}p</div>
                          {reward.average && reward.average !== reward.price && (
                            <div className="text-xs text-gray-400">
                              avg: {reward.average}p
                            </div>
                          )}
                        </div>
                      ) : reward.status === 'error' && reward.error?.includes('not found') ? (
                        <div className="text-gray-500 text-xs">Not traded</div>
                      ) : (
                        <div className="text-gray-500 text-xs">Not offered</div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs text-gray-400 mb-1">Standing</div>
                      <div className="text-purple-400 font-medium">{formatStanding(reward.standingCost)}</div>
                    </div>
                  </div>

                  {/* Volume info */}
                  {reward.volume && reward.volume > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-700/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Trade Volume</span>
                        <span className="text-xs text-gray-300">{reward.volume}</span>
                      </div>
                    </div>
                  )}

                  {/* Plat per standing - key metric */}
                  <div className="mt-3 pt-3 border-t border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Plat per 1k Standing</span>
                      {refreshingItems.has(reward.name) ? (
                        <div className="animate-pulse">
                          <div className="h-4 bg-gray-700 rounded w-16"></div>
                        </div>
                      ) : (
                        <span className={reward.platPerStanding && reward.platPerStanding > 0 ? 'text-blue-400 font-medium' : 'text-gray-500'}>
                          {formatPlatPerStanding(reward.platPerStanding)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              {!activeFilters.has('all') ? (
                <div>
                  <p>No items match the current filters.</p>
                  <button
                    onClick={() => toggleFilter('all')}
                    className="text-tenno-blue hover:underline mt-2"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <p>No syndicate rewards found. Upload a screenshot to get started.</p>
              )}
            </div>
          )}
        </div>
      )}

      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 border-t-0 rounded-b-xl p-4 hover:bg-gray-800/50 transition-colors group"
        >
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>{totals.totalCount} item{totals.totalCount !== 1 ? 's' : ''}</span>
              {totals.totalValue > 0 && (
                <div className="flex items-center gap-1">
                  <Zap size={10} className="text-gray-300" />
                  <span className="text-gray-300">{totals.totalValue}p</span>
                </div>
              )}
              {totals.totalStanding > 0 && (
                <div className="flex items-center gap-1">
                  <TrendingUp size={10} className="text-purple-400" />
                  <span className="text-purple-400">{formatStanding(totals.totalStanding)}</span>
                </div>
              )}
            </div>
            <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
              Tap to expand
            </span>
          </div>
        </button>
      )}
    </div>
  );
};

export default SyndicateRewardsSection;

