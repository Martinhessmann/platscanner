import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, Filter, TrendingUp, Shield, Zap, Trash2, ExternalLink, Sword, Package, Star, Heart, X, Coins } from 'lucide-react';
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
  onRefreshStart: () => void;
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
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'platPerStanding' | 'price' | 'standingCost' | 'name' | 'syndicate'>('platPerStanding');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState({
    syndicate: '',
    itemType: '',
    minPrice: '',
    maxPrice: '',
    minPlatPerStanding: '',
    maxStandingCost: '',
    showNonTradable: false // Default to hiding non-tradable items
  });

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
      const updatedRewards = syndicateRewards.map(reward => ({
        ...reward,
        status: refreshingItems.has(reward.name) ? 'loading' as const : reward.status
      }));

      setRewards(updatedRewards);
    };

    loadRewards();
  }, [refreshTrigger, refreshingItems]);

  // Use rewards directly from inventory
  const allRewards = rewards;

  // Apply filters and sorting
  const filteredAndSortedRewards = useMemo(() => {
    let filtered = allRewards;

    // Filter out non-tradable items by default (unless explicitly shown)
    if (!filters.showNonTradable) {
      filtered = filtered.filter(reward => {
        // Show items that have a price > 0 or are still loading
        return (reward.price && reward.price > 0) ||
               reward.status === 'loading' ||
               !reward.status; // Items that haven't been fetched yet
      });
    }

    // Apply other filters
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
    onRefreshStart();
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
              {/* Essential info line - item count and key values */}
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
                {isRefreshing && progress && (
                  <span className="text-tenno-blue">
                    Refreshing {progress.current}/{progress.total}
                  </span>
                )}
              </div>
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
          {/* Controls and Stats Row */}
          <div className="p-4 border-b border-gray-700/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">
                  {filteredAndSortedRewards.length} items
                </span>
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
                  <span>Filters</span>
                </button>
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

            {/* Stats Cards - Mobile-friendly grid */}
            {totals.totalCount > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                  <div className="text-xs text-gray-400 mb-1">Best Value</div>
                  <div className="text-sm font-medium text-tenno-blue truncate">
                    {totals.bestValueItem ? (
                      `${totals.bestValueItem.name} (${formatPlatPerStanding(totals.bestValueItem.platPerStanding)})`
                    ) : (
                      'N/A'
                    )}
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                  <div className="text-xs text-gray-400 mb-1">Avg Plat/1k</div>
                  <div className="text-sm font-medium text-green-400">
                    {formatPlatPerStanding(totals.avgPlatPerStanding)}
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                  <div className="text-xs text-gray-400 mb-1">With Prices</div>
                  <div className="text-sm font-medium text-tenno-blue">
                    {totals.loadedCount}/{totals.totalCount}
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                  <div className="text-xs text-gray-400 mb-1">Total Standing</div>
                  <div className="text-sm font-medium text-purple-400">
                    {formatStanding(totals.totalStanding)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Filters - Mobile-friendly */}
          {showFilters && (
            <div className="p-4 border-b border-gray-700/50">
              <h4 className="text-sm font-medium text-white mb-3">Filters</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Syndicate</label>
                  <select
                    value={filters.syndicate}
                    onChange={(e) => setFilters({ ...filters, syndicate: e.target.value })}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                  >
                    <option value="">All Syndicates</option>
                    {syndicates.map(syndicate => (
                      <option key={syndicate} value={syndicate}>{syndicate}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Item Type</label>
                    <select
                      value={filters.itemType}
                      onChange={(e) => setFilters({ ...filters, itemType: e.target.value })}
                      className="w-full bg-gray-700/50 border border-gray-600 rounded px-3 py-2 text-sm text-white"
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
                    <label className="block text-xs text-gray-400 mb-1">Min Plat/1k</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={filters.minPlatPerStanding}
                      onChange={(e) => setFilters({ ...filters, minPlatPerStanding: e.target.value })}
                      className="w-full bg-gray-700/50 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                      placeholder="0.0001"
                      />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showNonTradable"
                    checked={filters.showNonTradable}
                    onChange={(e) => setFilters({ ...filters, showNonTradable: e.target.checked })}
                    className="rounded border-gray-600 bg-gray-700/50 text-tenno-blue focus:ring-tenno-blue"
                  />
                  <label htmlFor="showNonTradable" className="text-xs text-gray-400">
                    Show non-tradable items
                  </label>
                </div>
              </div>
            </div>
          )}

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
                      ) : reward.price && reward.price > 0 ? (
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
                      maxStandingCost: '',
                      showNonTradable: false
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

      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 border-t-0 rounded-b-xl p-4 hover:bg-gray-800/50 transition-colors group"
        >
          <div className="flex items-center justify-center text-sm">
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

