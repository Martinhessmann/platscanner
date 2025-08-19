import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, Filter, TrendingUp, Shield, Zap, Trash2, ExternalLink, Sword, Package, Star, Heart, X } from 'lucide-react';
import { SyndicateReward } from '../types';
import {
  getAllSyndicateRewards,
  fetchSyndicateRewardPrices,
  sortSyndicateRewards,
  filterSyndicateRewards,
  getAvailableSyndicates
} from '../services/syndicateService';

interface SyndicateRewardsSectionProps {
  isRefreshing: boolean;
  onRefreshStart: () => void;
  onRefreshComplete: () => void;
  onCancel?: () => void; // Add cancellation function
  onClearAll: () => void;
  onRemoveItem: (itemName: string) => void;
  onRefreshItem?: (itemName: string) => void; // Add individual item refresh function
  refreshTrigger?: number; // Add this prop to trigger refresh when inventory changes
}

const SyndicateRewardsSection: React.FC<SyndicateRewardsSectionProps> = ({
  isRefreshing,
  onRefreshStart,
  onRefreshComplete,
  onCancel,
  onClearAll,
  onRemoveItem,
  onRefreshItem,
  refreshTrigger
}) => {
  const [rewards, setRewards] = useState<SyndicateReward[]>([]);
  const [refreshingItems, setRefreshingItems] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'platPerStanding' | 'price' | 'standingCost' | 'name' | 'syndicate'>('platPerStanding');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState({
    syndicate: '',
    itemType: '',
    minPrice: '',
    maxPrice: '',
    minPlatPerStanding: '',
    maxStandingCost: ''
  });

    // Load syndicate rewards from inventory
  useEffect(() => {
    const loadRewards = () => {
      const syndicateRewards = getAllSyndicateRewards();

      // Mark items as loading if they're being refreshed
      const updatedRewards = syndicateRewards.map(reward => ({
        ...reward,
        status: refreshingItems.has(reward.name) ? 'loading' as const : reward.status
      }));

      setRewards(updatedRewards);
    };

    loadRewards();
  }, [refreshTrigger, refreshingItems]); // Refresh when refreshTrigger or refreshingItems changes

  // Use rewards directly from inventory
  const allRewards = rewards;

  // Apply filters and sorting
  const filteredAndSortedRewards = useMemo(() => {
    let filtered = allRewards;

    // Apply filters
    if (filters.syndicate) {
      filtered = filterSyndicateRewards(filtered, { syndicate: filters.syndicate });
    }
    if (filters.itemType) {
      filtered = filterSyndicateRewards(filtered, { itemType: filters.itemType });
    }
    if (filters.minPrice) {
      filtered = filterSyndicateRewards(filtered, { minPrice: parseFloat(filters.minPrice) });
    }
    if (filters.maxPrice) {
      filtered = filterSyndicateRewards(filtered, { maxPrice: parseFloat(filters.maxPrice) });
    }
    if (filters.minPlatPerStanding) {
      filtered = filterSyndicateRewards(filtered, { minPlatPerStanding: parseFloat(filters.minPlatPerStanding) });
    }
    if (filters.maxStandingCost) {
      filtered = filterSyndicateRewards(filtered, { maxStandingCost: parseInt(filters.maxStandingCost) });
    }

    // Apply sorting
    return sortSyndicateRewards(filtered, sortBy, sortOrder);
  }, [allRewards, filters, sortBy, sortOrder]);

  // Calculate totals
  const totals = useMemo(() => {
    const loadedRewards = filteredAndSortedRewards.filter(r => r.price && r.price > 0);
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
    // This local refresh should not be used - use parent's refresh instead
    onRefreshStart();
  };

  const handleRefreshItem = async (itemName: string) => {
    const item = rewards.find(r => r.name === itemName);
    if (!item) return;

    // Mark this item as refreshing
    setRefreshingItems(prev => new Set(prev).add(itemName));

    try {
      if (onRefreshItem) {
        // Use the parent's refresh function if available
        await onRefreshItem(itemName);
      } else {
        // Fallback to local refresh
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
      // Remove from refreshing items
      setRefreshingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemName);
        return newSet;
      });
    }
  };

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (column: typeof sortBy) => {
    if (sortBy !== column) return null;
    return sortOrder === 'desc' ? '↓' : '↑';
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

  const getPriceComparisonDisplay = (reward: SyndicateReward) => {
    if (!reward.price || reward.price === 0) {
      return null;
    }

    // For syndicate rewards, we don't have an "expected" value like relics
    // So we'll show the current price vs average (if available)
    const currentPrice = reward.price;
    const averagePrice = reward.average || currentPrice;

    if (averagePrice && averagePrice !== currentPrice) {
      const diff = currentPrice - averagePrice;

      return (
        <div className="flex items-center gap-1 text-xs">
          <span className="text-gray-300">vs</span>
          <span className="text-gray-400">{averagePrice.toFixed(1)}p</span>
          <span className={diff > 0 ? 'text-green-400' : 'text-red-400'}>
            ({diff > 0 ? '+' : ''}{diff.toFixed(1)}p)
          </span>
        </div>
      );
    }

    return null;
  };

  const syndicates = getAvailableSyndicates();

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 mb-4">
      {/* Header - Simplified to match other sections */}
      <div className="p-4 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
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
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>
                  {totals.totalCount} item{totals.totalCount !== 1 ? 's' : ''}
                </span>
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
                {isRefreshing && (
                  <span className="text-tenno-blue">
                    Refreshing...
                  </span>
                )}
              </div>
              {!isExpanded && (
                <div className="text-xs text-gray-500 mt-1">Tap to expand</div>
              )}
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
                <RefreshCw size={12} />
              )}
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                showFilters
                  ? 'text-orokin-gold bg-orokin-gold/10'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
              }`}
              title="Toggle filters"
            >
              <Filter size={12} />
            </button>

            <button
              onClick={onClearAll}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              title="Delete all syndicate rewards"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Stats Cards - Only show when expanded */}
          {totals.totalCount > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <div className="text-xs text-gray-400 mb-1">Best Value Item</div>
                <div className="text-sm font-medium text-tenno-blue">
                  {totals.bestValueItem ? (
                    `${totals.bestValueItem.name} (${formatPlatPerStanding(totals.bestValueItem.platPerStanding)})`
                  ) : (
                    'N/A'
                  )}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <div className="text-xs text-gray-400 mb-1">Avg Plat/1k Standing</div>
                <div className="text-sm font-medium text-green-400">
                  {formatPlatPerStanding(totals.avgPlatPerStanding)}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <div className="text-xs text-gray-400 mb-1">Items with Prices</div>
                <div className="text-sm font-medium text-tenno-blue">
                  {totals.loadedCount}/{totals.totalCount}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <div className="text-xs text-gray-400 mb-1">Total Standing Cost</div>
                <div className="text-sm font-medium text-purple-400">
                  {formatStanding(totals.totalStanding)}
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          {showFilters && (
            <div className="bg-gray-800/30 rounded-lg p-4 mb-4 border border-gray-700/50">
              <h4 className="text-sm font-medium text-white mb-3">Filters</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Syndicate</label>
                  <select
                    value={filters.syndicate}
                    onChange={(e) => setFilters({ ...filters, syndicate: e.target.value })}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                  >
                    <option value="">All Syndicates</option>
                    {syndicates.map(syndicate => (
                      <option key={syndicate} value={syndicate}>{syndicate}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Item Type</label>
                  <select
                    value={filters.itemType}
                    onChange={(e) => setFilters({ ...filters, itemType: e.target.value })}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                  >
                    <option value="">All Types</option>
                    <option value="weapon">Weapon</option>
                    <option value="mod">Mod</option>
                    <option value="cosmetic">Cosmetic</option>
                    <option value="resource">Resource</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Min Plat/1k Standing</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={filters.minPlatPerStanding}
                    onChange={(e) => setFilters({ ...filters, minPlatPerStanding: e.target.value })}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                    placeholder="0.0001"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Results Table */}
          {filteredAndSortedRewards.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700/50">
                    <th className="text-left py-2 px-2 font-medium text-gray-300">
                      <button
                        onClick={() => handleSort('name')}
                        className="flex items-center gap-1 hover:text-white transition-colors"
                      >
                        Item Name {getSortIcon('name')}
                      </button>
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-gray-300">
                      <button
                        onClick={() => handleSort('syndicate')}
                        className="flex items-center gap-1 hover:text-white transition-colors"
                      >
                        Syndicate {getSortIcon('syndicate')}
                      </button>
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-gray-300">Type</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-300">
                      <button
                        onClick={() => handleSort('standingCost')}
                        className="flex items-center gap-1 hover:text-white transition-colors"
                      >
                        Standing {getSortIcon('standingCost')}
                      </button>
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-gray-300">
                      <button
                        onClick={() => handleSort('price')}
                        className="flex items-center gap-1 hover:text-white transition-colors"
                      >
                        Price {getSortIcon('price')}
                      </button>
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-gray-300">
                      <button
                        onClick={() => handleSort('platPerStanding')}
                        className="flex items-center gap-1 hover:text-white transition-colors"
                      >
                        Plat/1k Standing {getSortIcon('platPerStanding')}
                      </button>
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedRewards.map((reward, index) => (
                    <tr
                      key={`${reward.name}-${index}`}
                      className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors"
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <span className="text-white">{reward.name}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-gray-300">{reward.syndicate || 'Unknown'}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <span className={getItemTypeColor(reward.itemType)}>
                            {getTypeIcon(reward.itemType)}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${getItemTypeColor(reward.itemType)}`}>
                            {reward.itemType}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-gray-300">{formatStanding(reward.standingCost)}</td>
                      <td className="py-2 px-2">
                        <div className="flex flex-col gap-1">
                          {refreshingItems.has(reward.name) ? (
                            <div className="animate-pulse">
                              <div className="h-4 bg-gray-700 rounded w-12 mb-1"></div>
                              <div className="h-3 bg-gray-700 rounded w-8"></div>
                            </div>
                          ) : reward.price && reward.price > 0 ? (
                            <>
                              <span className="text-green-400">{reward.price}p</span>
                              {getPriceComparisonDisplay(reward)}
                            </>
                          ) : reward.status === 'error' && reward.error?.includes('not found') ? (
                            <span className="text-gray-500 text-xs">Not traded</span>
                          ) : reward.status === 'loading' ? (
                            <div className="animate-pulse">
                              <div className="h-4 bg-gray-700 rounded w-12 mb-1"></div>
                              <div className="h-3 bg-gray-700 rounded w-8"></div>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-xs">Not offered</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        {refreshingItems.has(reward.name) ? (
                          <div className="animate-pulse">
                            <div className="h-4 bg-gray-700 rounded w-16"></div>
                          </div>
                        ) : (
                          <span className={reward.platPerStanding && reward.platPerStanding > 0 ? 'text-blue-400' : 'text-gray-500'}>
                            {formatPlatPerStanding(reward.platPerStanding)}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              {filters.syndicate || filters.itemType || filters.minPlatPerStanding ? (
                <div>
                  <p>No items match the current filters.</p>
                  <button
                    onClick={() => setFilters({
                      syndicate: '',
                      itemType: '',
                      minPrice: '',
                      maxPrice: '',
                      minPlatPerStanding: '',
                      maxStandingCost: ''
                    })}
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
    </div>
  );
};

export default SyndicateRewardsSection;

