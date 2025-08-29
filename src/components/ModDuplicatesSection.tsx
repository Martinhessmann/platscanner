// Purpose: Mod Duplicates Management Section - Analyze duplicate mods from screenshots
// Follows the exact pattern of SyndicateRewardsSection for consistency

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, Filter, TrendingUp, Shield, Zap, Trash2, ExternalLink, Star, Package, Coins, X, Heart, Sword } from 'lucide-react';
import { Mod } from '../types';
import {
  ModItem,
  ModDuplicateAnalysis,
  loadModInventory,
  refreshModPrices,
  analyzeModDuplicates,
  getModLastRefreshTime,
  setModLastRefreshTime
} from '../services/modService';
import { getCategorizedInventory } from '../services/inventoryService';
import LastRefreshInfo from './LastRefreshInfo';

interface ModDuplicatesSectionProps {
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

const ModDuplicatesSection: React.FC<ModDuplicatesSectionProps> = ({
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
  const [mods, setMods] = useState<ModItem[]>([]);
  const [refreshingItems, setRefreshingItems] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['with_buyers']));
  const [sortBy, setSortBy] = useState<'platPerEndo' | 'price' | 'endoValue' | 'name' | 'rarity' | 'recommendation'>('platPerEndo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sectionRef = useRef<HTMLDivElement>(null);

  // Persistent accordion state
  useEffect(() => {
    const stored = localStorage.getItem('accordion_mod_duplicates');
    if (stored !== null) {
      setIsExpanded(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('accordion_mod_duplicates', JSON.stringify(isExpanded));
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

  // Load mods from inventory
  useEffect(() => {
    const loadMods = () => {
      const inventory = getCategorizedInventory();
      const modItems = inventory.mods.map(item => ({
        ...item,
        rarity: item.rarity || 'unknown',
        type: item.type || 'other',
        addedAt: new Date(item.addedAt),
        lastUpdated: new Date(item.lastUpdated)
      } as ModItem));

      // Analyze mods for duplicate recommendations
      const analyzedMods = modItems.length > 0 ? analyzeModDuplicates(modItems) : null;

      setMods(modItems);
    };

    loadMods();
  }, [refreshTrigger]);

  // Use mods directly from inventory
  const allMods = mods;

    // Smart filter toggle function
  const toggleFilter = (filterType: string) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (newFilters.has(filterType)) {
        newFilters.delete(filterType);
      } else {
        newFilters.add(filterType);
      }
      return newFilters;
    });
  };

  // Get available rarities from current mods
  const availableRarities = useMemo(() => {
    const rarities = new Set<string>();
    allMods.forEach(mod => {
      if (mod.rarity) rarities.add(mod.rarity);
    });
    return Array.from(rarities).sort();
  }, [allMods]);

  // Apply smart filters and sorting
  const filteredAndSortedMods = useMemo(() => {
    let filtered = allMods;

    // Apply smart filters based on activeFilters
    if (activeFilters.has('with_buyers')) {
      filtered = filtered.filter(mod => mod.price && mod.price > 0);
    }

    if (activeFilters.has('all_duplicates')) {
      filtered = filtered.filter(mod => mod.quantity > 1);
    }

    // Apply rarity filters
    availableRarities.forEach(rarity => {
      if (activeFilters.has(`rarity_${rarity}`)) {
        filtered = filtered.filter(mod => mod.rarity === rarity);
      }
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'rarity':
          const rarityOrder = { 'common': 1, 'uncommon': 2, 'rare': 3, 'legendary': 4, 'primed': 5 };
          aVal = rarityOrder[a.rarity] || 0;
          bVal = rarityOrder[b.rarity] || 0;
          break;
        case 'recommendation':
          const recOrder = { 'KEEP_ALL': 4, 'KEEP_ONE_SELL_REST': 3, 'TRADE_ON_MARKET': 2, 'SELL_FOR_ENDO': 1 };
          aVal = recOrder[a.recommendation || 'SELL_FOR_ENDO'];
          bVal = recOrder[b.recommendation || 'SELL_FOR_ENDO'];
          break;
        case 'platPerEndo':
          aVal = a.platPerEndo || 0;
          bVal = b.platPerEndo || 0;
          break;
        case 'endoValue':
          aVal = a.endoValue || 0;
          bVal = b.endoValue || 0;
          break;
        case 'price':
          aVal = (a.price || 0) * a.quantity;
          bVal = (b.price || 0) * b.quantity;
          break;
        default:
          aVal = a.platPerEndo || 0;
          bVal = b.platPerEndo || 0;
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return filtered;
  }, [allMods, activeFilters, availableRarities, sortBy, sortOrder]);

  // Calculate totals
  const totals = useMemo(() => {
    const duplicateMods = allMods.filter(m => m.quantity > 1);
    const loadedMods = duplicateMods.filter(m => m.price && m.price > 0);
    const totalDuplicates = duplicateMods.reduce((sum, m) => sum + m.quantity, 0);
    const totalMarketValue = loadedMods.reduce((sum, m) => sum + ((m.price || 0) * m.quantity), 0);
    const totalEndoValue = duplicateMods.reduce((sum, m) => sum + (m.endoValue || 0), 0);

    const bestValueMod = loadedMods.length > 0 ? loadedMods.reduce((best, current) => {
      if (!best || (current.platPerEndo || 0) > (best.platPerEndo || 0)) {
        return current;
      }
      return best;
    }) : undefined;

    return {
      totalMods: allMods.length,
      duplicateCount: duplicateMods.length,
      totalDuplicates,
      totalMarketValue,
      totalEndoValue,
      loadedCount: loadedMods.length,
      bestValueMod
    };
  }, [allMods]);

  const handleRefresh = async () => {
    onRefreshStart();
  };

  const handleRefreshItem = async (itemName: string) => {
    const item = mods.find(m => m.name === itemName);
    if (!item) return;

    // Mark this item as refreshing
    setRefreshingItems(prev => new Set(prev).add(itemName));

    try {
      if (onRefreshItem) {
        await onRefreshItem(itemName);
      } else {
        const updatedMods = await refreshModPrices([item]);

        if (updatedMods.length > 0) {
          const updatedMod = updatedMods[0];
          setMods(prev => prev.map(m => m.name === itemName ? updatedMod : m));
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

  const handleOpenMarket = (itemName: string) => {
    const urlName = itemName.toLowerCase().replace(/\s+/g, '_');
    window.open(`https://warframe.market/items/${urlName}`, '_blank', 'noopener,noreferrer');
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'text-gray-400';
      case 'uncommon': return 'text-blue-400'; // Blue/silverish frame in game
      case 'rare': return 'text-yellow-400'; // Golden frame in game
      case 'legendary': return 'text-purple-400';
      case 'primed': return 'text-orange-400'; // Distinguished from rare
      case 'unknown': return 'text-gray-500'; // Pending market data
      default: return 'text-gray-400';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'warframe': return <Shield size={14} />;
      case 'weapon': return <Sword size={14} />;
      case 'companion': return <Heart size={14} />;
      case 'archwing': return <Zap size={14} />;
      case 'stance': return <Star size={14} />;
      case 'augment': return <Package size={14} />;
      default: return <Star size={14} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'warframe': return 'text-blue-400';
      case 'weapon': return 'text-red-400';
      case 'companion': return 'text-green-400';
      case 'archwing': return 'text-purple-400';
      case 'stance': return 'text-yellow-400';
      case 'augment': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  const getRecommendationColor = (recommendation?: string) => {
    switch (recommendation) {
      case 'KEEP_ALL': return 'text-green-400';
      case 'KEEP_ONE_SELL_REST': return 'text-yellow-400';
      case 'TRADE_ON_MARKET': return 'text-blue-400';
      case 'SELL_FOR_ENDO': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const formatPlatPerEndo = (ratio?: number) => {
    if (!ratio || ratio <= 0) return '—';
    return ratio.toFixed(3);
  };

    // Helper function to get mod image URL
  const getModImageUrl = (mod: ModItem) => {
    console.log(`>>> [Mod Image Debug] ${mod.name}:`, {
      imgUrl: mod.imgUrl,
      hasImgUrl: !!mod.imgUrl,
      includesWarframeMarket: mod.imgUrl?.includes('warframe.market'),
      includesItemsImages: mod.imgUrl?.includes('items/images')
    });

    // If we have a thumb URL from Warframe Market, use it
    if (mod.imgUrl && mod.imgUrl.includes('warframe.market')) {
      console.log(`>>> [Mod Image Debug] Using full Warframe Market URL: ${mod.imgUrl}`);
      return mod.imgUrl;
    }

    // If we have a thumb path, convert it to full URL
    if (mod.imgUrl && mod.imgUrl.includes('items/images')) {
      const fullUrl = `https://warframe.market/static/assets/${mod.imgUrl}`;
      console.log(`>>> [Mod Image Debug] Converting thumb path to: ${fullUrl}`);
      return fullUrl;
    }

    // Fallback to placeholder with rarity-based styling
    console.log(`>>> [Mod Image Debug] Using placeholder for ${mod.name}`);
    return '/images/mod.webp';
  };

  return (
    <div ref={sectionRef} className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50">
      {/* Header - Mobile-friendly */}
      <div className="p-4 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          <button
            onClick={handleToggle}
            className="flex items-center gap-3 text-left group hover:text-tenno-blue transition-colors flex-1 min-w-0"
          >
            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            <div className="flex items-center gap-2">
              <Star size={20} className="text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-tenno-blue transition-colors">
                Mod Duplicates
              </h3>
              {/* Essential info line - item count and key values */}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{totals.totalMods} mod{totals.totalMods !== 1 ? 's' : ''}</span>
                {totals.duplicateCount > 0 && (
                  <div className="flex items-center gap-1">
                    <Package size={10} className="text-yellow-400" />
                    <span className="text-yellow-400">{totals.duplicateCount} duplicates</span>
                  </div>
                )}
                {totals.totalMarketValue > 0 && (
                  <div className="flex items-center gap-1">
                    <Coins size={10} className="text-green-400" />
                    <span className="text-green-400">{totals.totalMarketValue}p</span>
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
              title={isRefreshing ? "Cancel refresh" : "Refresh all mod prices"}
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
              title="Delete all mods"
            >
              <Trash2 size={12} />
            </button>

            {(lastRefreshTime || getModLastRefreshTime()) && (
              <LastRefreshInfo
                lastRefreshTime={lastRefreshTime || getModLastRefreshTime()}
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

      {isExpanded && (
        <>

          {/* Smart Filter Tabs */}
          <div className="flex flex-wrap gap-2 p-6 pb-4">
            {/* With Buyers (Default) */}
            <button
              onClick={() => toggleFilter('with_buyers')}
              className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                activeFilters.has('with_buyers')
                  ? 'bg-blue-900/50 border-blue-500/50 text-blue-400 ring-1 ring-blue-500/30'
                  : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
              }`}
            >
              <Coins size={16} />
              <span>With Buyers</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilters.has('with_buyers') ? 'bg-blue-800/50 text-blue-300' : 'bg-gray-800/50 text-gray-400'
              }`}>
                {allMods.filter(mod => mod.price && mod.price > 0).length}
              </span>
            </button>

            {/* All Duplicates */}
            <button
              onClick={() => toggleFilter('all_duplicates')}
              className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                activeFilters.has('all_duplicates')
                  ? 'bg-blue-900/50 border-blue-500/50 text-blue-400 ring-1 ring-blue-500/30'
                  : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
              }`}
            >
              <Package size={16} />
              <span>All Duplicates</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilters.has('all_duplicates') ? 'bg-blue-800/50 text-blue-300' : 'bg-gray-800/50 text-gray-400'
              }`}>
                {allMods.filter(mod => mod.quantity > 1).length}
              </span>
            </button>

            {/* Rarity Tabs - Dynamically Generated */}
            {availableRarities.map(rarity => (
              <button
                key={rarity}
                onClick={() => toggleFilter(`rarity_${rarity}`)}
                className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                  activeFilters.has(`rarity_${rarity}`)
                    ? 'bg-blue-900/50 border-blue-500/50 text-blue-400 ring-1 ring-blue-500/30'
                    : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
                }`}
              >
                <Star size={16} className={getRarityColor(rarity)} />
                <span className="capitalize">{rarity}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  activeFilters.has(`rarity_${rarity}`) ? 'bg-blue-800/50 text-blue-300' : 'bg-gray-800/50 text-gray-400'
                }`}>
                  {allMods.filter(mod => mod.rarity === rarity).length}
                </span>
              </button>
            ))}
          </div>

          {/* Sort Controls */}
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-gray-700/50 border border-gray-600 rounded px-2 py-1 text-xs text-white"
              >
                <option value="platPerEndo">Plat per Endo</option>
                <option value="price">Market Value</option>
                <option value="endoValue">Endo Value</option>
                <option value="recommendation">Recommendation</option>
                <option value="rarity">Rarity</option>
                <option value="name">Name</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-1 bg-gray-700/50 border border-gray-600 rounded text-white text-xs hover:bg-gray-600/50 transition-colors"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          {/* Mobile-friendly card layout */}
          {filteredAndSortedMods.length > 0 ? (
            <div className="p-4 space-y-3">
              {filteredAndSortedMods.map((mod, index) => (
                <div
                  key={`${mod.name}-${index}`}
                  className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:bg-gray-800/70 transition-colors"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">
                        {mod.name}
                        {mod.rank !== undefined && (
                          <span className="ml-2 text-xs bg-gray-600 px-1.5 py-0.5 rounded text-gray-300">
                            R{mod.rank}
                          </span>
                        )}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded ${getRarityColor(mod.rarity)}`}>
                          {mod.rarity}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className={getTypeColor(mod.type)}>
                            {getTypeIcon(mod.type)}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${getTypeColor(mod.type)}`}>
                            {mod.type}
                          </span>
                        </div>
                        <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded">
                          x{mod.quantity}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleRefreshItem(mod.name)}
                        disabled={refreshingItems.has(mod.name)}
                        className={`p-1 transition-colors ${
                          refreshingItems.has(mod.name)
                            ? 'text-gray-500 cursor-not-allowed'
                            : 'text-tenno-blue hover:text-tenno-light'
                        }`}
                        title="Refresh price"
                      >
                        <RefreshCw size={14} className={refreshingItems.has(mod.name) ? 'animate-spin' : ''} />
                      </button>
                      <button
                        onClick={() => handleOpenMarket(mod.name)}
                        className="text-tenno-blue hover:text-tenno-light p-1 transition-colors"
                        title="View on Warframe Market"
                      >
                        <ExternalLink size={14} />
                      </button>
                      <button
                        onClick={() => onRemoveItem(mod.name)}
                        className="text-red-400 hover:text-red-300 p-1 transition-colors"
                        title="Remove from inventory"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Mod Image */}
                  <div className="mb-3">
                    <img
                      src={getModImageUrl(mod)}
                      alt={`${mod.name} mod`}
                      className="w-16 h-20 object-cover rounded-lg"
                      onError={(e) => {
                        // Fallback to placeholder if image fails to load
                        (e.target as HTMLImageElement).src = '/images/mod.webp';
                      }}
                    />
                  </div>

                  {/* Price and endo info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Market Price</div>
                      {refreshingItems.has(mod.name) ? (
                        <div className="animate-pulse">
                          <div className="h-4 bg-gray-700 rounded w-12"></div>
                        </div>
                      ) : mod.price && mod.price > 0 ? (
                        <div>
                          <div className="text-green-400 font-medium">{mod.price}p</div>
                          <div className="text-xs text-gray-400">
                            total: {(mod.price * mod.quantity)}p
                          </div>
                        </div>
                      ) : mod.status === 'loaded' && mod.price === 0 ? (
                        <div className="text-gray-500 text-xs">Not tradeable</div>
                      ) : mod.status === 'error' ? (
                        <div className="text-gray-500 text-xs">Not found</div>
                      ) : (
                        <div className="text-gray-500 text-xs">Loading...</div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs text-gray-400 mb-1">Endo Value</div>
                      <div className="text-red-400 font-medium">{mod.endoValue || 0}</div>
                      <div className="text-xs text-gray-400">
                        total: {((mod.endoValue || 0) * mod.quantity)}
                      </div>
                    </div>
                  </div>

                  {/* Recommendation */}
                  {mod.recommendation && (
                    <div className="mt-3 pt-3 border-t border-gray-700/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Recommendation</span>
                        <span className={`text-xs font-medium ${getRecommendationColor(mod.recommendation)}`}>
                          {mod.recommendation.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {mod.reasoning && (
                        <p className="text-xs text-gray-400 mt-1">{mod.reasoning}</p>
                      )}
                    </div>
                  )}

                  {/* Plat per endo - key metric */}
                  <div className="mt-3 pt-3 border-t border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Plat per Endo</span>
                      {refreshingItems.has(mod.name) ? (
                        <div className="animate-pulse">
                          <div className="h-4 bg-gray-700 rounded w-16"></div>
                        </div>
                      ) : (
                        <span className={mod.platPerEndo && mod.platPerEndo > 0 ? 'text-blue-400 font-medium' : 'text-gray-500'}>
                          {formatPlatPerEndo(mod.platPerEndo)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              {allMods.length === 0 ? (
                <div>
                  <Star size={40} className="mx-auto mb-2 opacity-50" />
                  <p className="mb-2">No mods detected</p>
                  <p className="text-sm">Upload screenshots of your mod inventory to get started</p>
                </div>
              ) : (
                <div>
                  <p>No mods match the current filters.</p>
                  <button
                    onClick={() => setActiveFilters(new Set(['with_buyers']))}
                    className="mt-2 text-tenno-blue hover:text-tenno-light text-sm underline"
                  >
                    Reset filters
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ModDuplicatesSection;
