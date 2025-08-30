// Purpose: Mod Duplicates Management Section - Analyze duplicate mods from screenshots
// Follows the exact pattern of SyndicateRewardsSection for consistency

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, Filter, TrendingUp, Shield, Zap, Trash2, ExternalLink, Star, Package, Coins, X, Heart, Sword, Clock } from 'lucide-react';
import { Mod } from '../types';
import {
  ModItem,
  ModDuplicateAnalysis,
  loadModInventory,
  refreshModPrices,
  analyzeModDuplicates,
  analyzeModForDuplicates,
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
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['sell_on_market']));
  const [sortBy, setSortBy] = useState<'totalMarketValue' | 'maxSingleValue' | 'recommendation' | 'rarity' | 'name'>('totalMarketValue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedImages, setExpandedImages] = useState<Set<string>>(new Set());
  const [fullResImages, setFullResImages] = useState<Set<string>>(new Set());

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

  // Smart filter toggle function with mutual exclusivity for main filters
  const toggleFilter = (filterType: string) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);

      // Handle mutual exclusivity for main view filters
      if (filterType === 'sell_on_market' || filterType === 'sell_for_endo' || filterType === 'hold_for_later') {
        // Remove all main filters first
        newFilters.delete('sell_on_market');
        newFilters.delete('sell_for_endo');
        newFilters.delete('hold_for_later');

        // Add the selected one if it wasn't already active
        if (!prev.has(filterType)) {
          newFilters.add(filterType);
        }
      } else {
        // Handle normal toggle for rarity filters
        if (newFilters.has(filterType)) {
          newFilters.delete(filterType);
        } else {
          newFilters.add(filterType);
        }
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
    if (activeFilters.has('sell_on_market')) {
      filtered = filtered.filter(mod => mod.price && mod.price > 0);
    }

    if (activeFilters.has('sell_for_endo')) {
      filtered = filtered.filter(mod => !mod.price || mod.price === 0);
    }

    if (activeFilters.has('hold_for_later')) {
      filtered = filtered.filter(mod => mod.hasHistoricalSales && (!mod.price || mod.price === 0));
    }

    // Apply rarity filters with OR/AND logic
    const activeRarityFilters = availableRarities.filter(rarity =>
      activeFilters.has(`rarity_${rarity}`)
    );

    if (activeRarityFilters.length > 0) {
      // OR logic: show mods that match ANY selected rarity
      filtered = filtered.filter(mod =>
        activeRarityFilters.includes(mod.rarity)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'rarity':
          const rarityOrder: Record<string, number> = { 'common': 1, 'uncommon': 2, 'rare': 3, 'legendary': 4, 'primed': 5, 'unknown': 0 };
          aVal = rarityOrder[a.rarity] || 0;
          bVal = rarityOrder[b.rarity] || 0;
          break;
        case 'recommendation':
          const recOrder = { 'TRADE_ON_MARKET': 3, 'HOLD_FOR_LATER': 2, 'SELL_FOR_ENDO': 1 };
          aVal = recOrder[a.recommendation || 'SELL_FOR_ENDO'];
          bVal = recOrder[b.recommendation || 'SELL_FOR_ENDO'];
          break;
        case 'totalMarketValue':
          aVal = (a.price || 0) * a.quantity;
          bVal = (b.price || 0) * b.quantity;
          break;
        case 'maxSingleValue':
          aVal = a.price || 0;
          bVal = b.price || 0;
          break;
        default:
          aVal = a.price || 0;
          bVal = b.price || 0;
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
        // Use the same logic as bulk refresh to preserve mod metadata
        const { fetchSinglePriceData, calculateEndoValue, analyzeModForDuplicates } = await import('../services/warframeMarketService');
        const { calculateEndoValue: calculateEndoValueMod } = await import('../services/modService');
        
        const priceData = await fetchSinglePriceData(item);
        
        if (priceData) {
          // Use the same logic as HomePage for mods
          const actualRarity = priceData.rarity || item.rarity;
          const actualType = priceData.type || item.type;
          
          const modItem = {
            ...item,
            price: priceData.price,
            marketVolume: priceData.volume,
            average: priceData.average || item.average, // Preserve existing average if new one is not available
            lastUpdated: new Date(),
            status: 'loaded' as const,
            rarity: actualRarity,
            type: actualType,
            imgUrl: priceData.thumb ? `https://warframe.market/static/assets/${priceData.thumb}` : item.imgUrl, // Preserve existing image if new one is not available
            hasHistoricalSales: item.hasHistoricalSales || (priceData.volume > 0 || priceData.average > 0) // Preserve or update historical sales flag
          } as any;

          // Log mod price data for debugging
          console.log(`>>> [Single Mod Refresh] ${item.name}: current=${priceData.price}p, avg=${priceData.average}p, volume=${priceData.volume}, historical=${modItem.hasHistoricalSales} <<<`);

          // Calculate endo value and analyze for recommendations
          const endoValue = calculateEndoValueMod(modItem);
          const analyzedMod = analyzeModForDuplicates({ ...modItem, endoValue });
          
          setMods(prev => prev.map(m => m.name === itemName ? analyzedMod : m));
        } else {
          // Handle error case
          const errorMod = {
            ...item,
            price: 0,
            marketVolume: 0,
            lastUpdated: new Date(),
            status: 'error' as const,
            error: 'Failed to fetch price'
          };
          
          setMods(prev => prev.map(m => m.name === itemName ? errorMod : m));
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
      case 'TRADE_ON_MARKET': return 'text-blue-400';
      case 'HOLD_FOR_LATER': return 'text-yellow-400';
      case 'SELL_FOR_ENDO': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const formatPlatPerEndo = (ratio?: number) => {
    if (!ratio || ratio <= 0) return '—';
    return ratio.toFixed(3);
  };

    // Helper function to get mod image URL
  const getModImageUrl = (mod: ModItem, useFullRes = false) => {
    console.log(`>>> [Mod Image Debug] ${mod.name}:`, {
      imgUrl: mod.imgUrl,
      hasImgUrl: !!mod.imgUrl,
      includesWarframeMarket: mod.imgUrl?.includes('warframe.market'),
      includesItemsImages: mod.imgUrl?.includes('items/images'),
      useFullRes,
      imgUrlLength: mod.imgUrl?.length
    });

    // If we have a thumb path, try direct Warframe Market URL (CORS warnings are OK)
    if (mod.imgUrl && mod.imgUrl.includes('items/images')) {
      // Handle migration from old full URL format to new path format
      let imagePath = mod.imgUrl;
      if (mod.imgUrl.includes('warframe.market')) {
        // Extract path from full URL
        const url = new URL(mod.imgUrl);
        imagePath = url.pathname.replace('/static/assets/', '');
        console.log(`>>> [Mod Image Debug] Migrated full URL to path: ${mod.imgUrl} -> ${imagePath}`);
      }

      // Use direct Warframe Market URL (CORS warnings are expected but images display fine)
      const directUrl = `https://warframe.market/static/assets/${imagePath}`;
      console.log(`>>> [Mod Image Debug] Using direct Warframe Market URL: ${directUrl}`);
      return directUrl;
    }

    // Fallback to placeholder with rarity-based styling
    console.log(`>>> [Mod Image Debug] Using placeholder for ${mod.name}`);
    return '/images/mod.webp';
  };

  // Helper function to get full resolution image URL
  const getFullResImageUrl = (mod: ModItem) => {
    if (!mod.imgUrl || !mod.imgUrl.includes('items/images')) {
      return getModImageUrl(mod);
    }

    // Handle migration from old full URL format to new path format
    let imagePath = mod.imgUrl;
    if (mod.imgUrl.includes('warframe.market')) {
      // Extract path from full URL
      const url = new URL(mod.imgUrl);
      imagePath = url.pathname.replace('/static/assets/', '');
    }

    // Convert thumb path to full resolution path
    // From: items/images/en/thumbs/critical_delay.5e621ae9ee9a6d2d4576565a26af45cb.128x128.png
    // To: items/images/en/critical_delay.5e621ae9ee9a6d2d4576565a26af45cb.png
    const fullResPath = imagePath
      .replace('/thumbs/', '/')
      .replace(/\.\d+x\d+\.png$/, '.png');

    // Use direct Warframe Market URL for full resolution
    const directUrl = `https://warframe.market/static/assets/${fullResPath}`;
    console.log(`>>> [Mod Image Debug] Full res direct URL for ${mod.name}: ${directUrl}`);
    return directUrl;
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
                lastRefreshDate={lastRefreshTime || getModLastRefreshTime()}
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
            {/* Sell on Market (Default) */}
            <button
              onClick={() => toggleFilter('sell_on_market')}
              className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                activeFilters.has('sell_on_market')
                  ? 'bg-blue-900/50 border-blue-500/50 text-blue-400 ring-1 ring-blue-500/30'
                  : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
              }`}
            >
              <Coins size={16} />
              <span>Sell on Market</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilters.has('sell_on_market') ? 'bg-blue-800/50 text-blue-300' : 'bg-gray-800/50 text-gray-400'
              }`}>
                {allMods.filter(mod => mod.price && mod.price > 0).length}
              </span>
            </button>

            {/* Sell for Endo */}
            <button
              onClick={() => toggleFilter('sell_for_endo')}
              className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                activeFilters.has('sell_for_endo')
                  ? 'bg-red-900/50 border-red-500/50 text-red-400 ring-1 ring-red-500/30'
                  : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
              }`}
            >
              <Package size={16} />
              <span>Sell for Endo</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilters.has('sell_for_endo') ? 'bg-red-800/50 text-red-300' : 'bg-gray-800/50 text-gray-400'
              }`}>
                {allMods.filter(mod => !mod.price || mod.price === 0).length}
              </span>
            </button>

            {/* Hold for Later */}
            <button
              onClick={() => toggleFilter('hold_for_later')}
              className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
                activeFilters.has('hold_for_later')
                  ? 'bg-yellow-900/50 border-yellow-500/50 text-yellow-400 ring-1 ring-yellow-500/30'
                  : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
              }`}
            >
              <Clock size={16} />
              <span>Hold for Later</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilters.has('hold_for_later') ? 'bg-yellow-800/50 text-yellow-300' : 'bg-gray-800/50 text-gray-400'
              }`}>
                {allMods.filter(mod => mod.hasHistoricalSales && (!mod.price || mod.price === 0)).length}
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
                <option value="totalMarketValue">Total Market Value</option>
                <option value="maxSingleValue">Max Single Mod Value</option>
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
                  <div className="mb-3 overflow-visible">
                    <img
                      src={expandedImages.has(mod.name) && fullResImages.has(mod.name)
                        ? getFullResImageUrl(mod)
                        : getModImageUrl(mod)
                      }
                      alt={`${mod.name} mod`}
                      className={`object-cover rounded-lg cursor-pointer hover:opacity-80 transition-all duration-200 ${
                        expandedImages.has(mod.name)
                          ? 'w-32 h-40 scale-110'
                          : 'w-16 h-20'
                      }`}
                      onClick={() => {
                        setExpandedImages(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(mod.name)) {
                            // Shrinking - remove from both sets
                            newSet.delete(mod.name);
                            setFullResImages(fullRes => {
                              const newFullRes = new Set(fullRes);
                              newFullRes.delete(mod.name);
                              return newFullRes;
                            });
                          } else {
                            // Expanding - add to expanded set and load full res
                            newSet.add(mod.name);
                            setFullResImages(fullRes => {
                              const newFullRes = new Set(fullRes);
                              newFullRes.add(mod.name);
                              return newFullRes;
                            });
                          }
                          return newSet;
                        });
                      }}
                      onError={(e) => {
                        console.error(`>>> [Mod Image Error] Failed to load image for ${mod.name}:`, e);
                        // Fallback to placeholder if image fails to load
                        (e.target as HTMLImageElement).src = '/images/mod.webp';
                      }}
                      onLoad={() => {
                        console.log(`>>> [Mod Image Success] Successfully loaded image for ${mod.name}`);
                      }}
                      title={expandedImages.has(mod.name) ? "Click to shrink" : "Click to enlarge"}
                    />
                  </div>

                  {/* Value display - show appropriate value based on recommendation */}
                  <div className="grid grid-cols-1 gap-4">
                    {mod.recommendation === 'TRADE_ON_MARKET' && mod.price && mod.price > 0 ? (
                      // Current market buyers - show current price
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Market Price</div>
                        {refreshingItems.has(mod.name) ? (
                          <div className="animate-pulse">
                            <div className="h-4 bg-gray-700 rounded w-12"></div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-green-400 font-medium">{mod.price}p</div>
                            {mod.average && mod.average > 0 && (
                              <div className="text-xs text-gray-400">
                                90d avg: {mod.average}p
                              </div>
                            )}
                            <div className="text-xs text-gray-400">
                              total: {(mod.price * mod.quantity)}p
                            </div>
                          </div>
                        )}
                      </div>
                    ) : mod.recommendation === 'HOLD_FOR_LATER' && mod.average && mod.average > 0 ? (
                      // Historical sales but no current buyers - show historical average
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Historical Average</div>
                        {refreshingItems.has(mod.name) ? (
                          <div className="animate-pulse">
                            <div className="h-4 bg-gray-700 rounded w-12"></div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-yellow-400 font-medium">{mod.average}p</div>
                            <div className="text-xs text-gray-400">
                              total: {(mod.average * mod.quantity)}p
                            </div>
                            <div className="text-xs text-gray-400">
                              (No current buyers)
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      // No market activity - show endo value
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Endo Value</div>
                        {refreshingItems.has(mod.name) ? (
                          <div className="animate-pulse">
                            <div className="h-4 bg-gray-700 rounded w-12"></div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-red-400 font-medium">{mod.endoValue || 0}</div>
                            <div className="text-xs text-gray-400">
                              total: {((mod.endoValue || 0) * mod.quantity)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
                    onClick={() => setActiveFilters(new Set(['sell_on_market']))}
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
