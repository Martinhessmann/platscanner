import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, Filter, TrendingUp, Shield, Zap } from 'lucide-react';
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
}

const SyndicateRewardsSection: React.FC<SyndicateRewardsSectionProps> = ({
  isRefreshing,
  onRefreshStart,
  onRefreshComplete
}) => {
  const [rewards, setRewards] = useState<SyndicateReward[]>([]);
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

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      // Wait a bit for the data to be loaded from JSON
      await new Promise(resolve => setTimeout(resolve, 100));
      const initialRewards = getAllSyndicateRewards();
      setRewards(initialRewards);
    };
    loadData();
  }, []);

  // Apply filters and sorting
  const filteredAndSortedRewards = useMemo(() => {
    let filtered = rewards;

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
  }, [rewards, filters, sortBy, sortOrder]);

  // Calculate totals
  const totals = useMemo(() => {
    const loadedRewards = filteredAndSortedRewards.filter(r => r.status === 'loaded');
    const totalValue = loadedRewards.reduce((sum, r) => sum + (r.price || 0), 0);
    const totalStanding = loadedRewards.reduce((sum, r) => sum + r.standingCost, 0);
    const avgPlatPerStanding = totalStanding > 0 ? totalValue / totalStanding : 0;
    
    return {
      totalValue,
      totalStanding,
      avgPlatPerStanding,
      loadedCount: loadedRewards.length,
      totalCount: filteredAndSortedRewards.length
    };
  }, [filteredAndSortedRewards]);

  const handleRefresh = async () => {
    onRefreshStart();
    try {
      const updatedRewards = await fetchSyndicateRewardPrices(rewards);
      setRewards(updatedRewards);
    } catch (error) {
      console.error('Failed to refresh syndicate rewards:', error);
    } finally {
      onRefreshComplete();
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

  const formatPlatPerStanding = (value: number | undefined) => {
    if (!value) return 'N/A';
    return `${value.toFixed(4)}`;
  };

  const formatStanding = (value: number) => {
    return value.toLocaleString();
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

  const syndicates = getAvailableSyndicates();

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 mb-4">
      {/* Header */}
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
              <span className="font-semibold text-lg">Syndicate Rewards</span>
            </div>
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-orokin-gold/20 text-orokin-gold' : 'bg-gray-700/50 text-gray-400 hover:text-white'
              }`}
            >
              <Filter size={16} />
            </button>
            
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-gray-700/50 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-gray-400">Total Value</div>
            <div className="text-orokin-gold font-semibold">{totals.totalValue.toLocaleString()}p</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-gray-400">Avg Plat/Standing</div>
            <div className="text-green-400 font-semibold">{formatPlatPerStanding(totals.avgPlatPerStanding)}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-gray-400">Items Loaded</div>
            <div className="text-blue-400 font-semibold">{totals.loadedCount}/{totals.totalCount}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-gray-400">Total Standing</div>
            <div className="text-purple-400 font-semibold">{formatStanding(totals.totalStanding)}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-4 border-b border-gray-700/50 bg-gray-800/30">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Syndicate</label>
              <select
                value={filters.syndicate}
                onChange={(e) => setFilters(prev => ({ ...prev, syndicate: e.target.value }))}
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orokin-gold"
              >
                <option value="">All Syndicates</option>
                {syndicates.map(syndicate => (
                  <option key={syndicate} value={syndicate}>{syndicate}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Item Type</label>
              <select
                value={filters.itemType}
                onChange={(e) => setFilters(prev => ({ ...prev, itemType: e.target.value }))}
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orokin-gold"
              >
                <option value="">All Types</option>
                <option value="weapon">Weapons</option>
                <option value="mod">Mods</option>
                <option value="cosmetic">Cosmetics</option>
                <option value="resource">Resources</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Min Price (plat)</label>
              <input
                type="number"
                value={filters.minPrice}
                onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value }))}
                placeholder="0"
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orokin-gold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Max Price (plat)</label>
              <input
                type="number"
                value={filters.maxPrice}
                onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                placeholder="∞"
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orokin-gold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Min Plat/Standing</label>
              <input
                type="number"
                step="0.0001"
                value={filters.minPlatPerStanding}
                onChange={(e) => setFilters(prev => ({ ...prev, minPlatPerStanding: e.target.value }))}
                placeholder="0.0000"
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orokin-gold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Max Standing Cost</label>
              <input
                type="number"
                value={filters.maxStandingCost}
                onChange={(e) => setFilters(prev => ({ ...prev, maxStandingCost: e.target.value }))}
                placeholder="∞"
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orokin-gold"
              />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {filteredAndSortedRewards.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              No syndicate rewards found matching the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700/50">
                    <th className="text-left p-2">
                      <button
                        onClick={() => handleSort('name')}
                        className="flex items-center gap-1 hover:text-orokin-gold transition-colors"
                      >
                        Item Name {getSortIcon('name')}
                      </button>
                    </th>
                    <th className="text-left p-2">
                      <button
                        onClick={() => handleSort('syndicate')}
                        className="flex items-center gap-1 hover:text-orokin-gold transition-colors"
                      >
                        Syndicate {getSortIcon('syndicate')}
                      </button>
                    </th>
                    <th className="text-left p-2">
                      <button
                        onClick={() => handleSort('standingCost')}
                        className="flex items-center gap-1 hover:text-orokin-gold transition-colors"
                      >
                        Standing Cost {getSortIcon('standingCost')}
                      </button>
                    </th>
                    <th className="text-left p-2">
                      <button
                        onClick={() => handleSort('price')}
                        className="flex items-center gap-1 hover:text-orokin-gold transition-colors"
                      >
                        Market Price {getSortIcon('price')}
                      </button>
                    </th>
                    <th className="text-left p-2">
                      <button
                        onClick={() => handleSort('platPerStanding')}
                        className="flex items-center gap-1 hover:text-orokin-gold transition-colors"
                      >
                        <TrendingUp size={14} />
                        Plat/Standing {getSortIcon('platPerStanding')}
                      </button>
                    </th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedRewards.map((reward) => (
                    <tr key={reward.id} className="border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors">
                      <td className="p-2">
                        <div className="font-medium">{reward.name}</div>
                        {reward.masteryRank && (
                          <div className="text-xs text-gray-400">MR {reward.masteryRank}</div>
                        )}
                      </td>
                      <td className="p-2 text-gray-300">{reward.syndicate}</td>
                      <td className="p-2 text-purple-400">{formatStanding(reward.standingCost)}</td>
                      <td className="p-2">
                        {reward.status === 'loaded' ? (
                          <div className="text-orokin-gold font-semibold">{reward.price?.toLocaleString()}p</div>
                        ) : reward.status === 'error' ? (
                          <div className="text-red-400 text-sm">{reward.error}</div>
                        ) : (
                          <div className="text-gray-400 text-sm">Loading...</div>
                        )}
                      </td>
                      <td className="p-2">
                        {reward.platPerStanding ? (
                          <div className="text-green-400 font-semibold">
                            {formatPlatPerStanding(reward.platPerStanding)}
                          </div>
                        ) : (
                          <div className="text-gray-400 text-sm">N/A</div>
                        )}
                      </td>
                      <td className="p-2">
                        <span className={`text-xs px-2 py-1 rounded-full bg-gray-700/50 ${getItemTypeColor(reward.itemType)}`}>
                          {reward.itemType}
                        </span>
                      </td>
                      <td className="p-2 text-gray-400">
                        {reward.marketVolume ? reward.marketVolume.toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SyndicateRewardsSection;