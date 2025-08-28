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
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'platPerEndo' | 'price' | 'endoValue' | 'name' | 'rarity' | 'recommendation'>('platPerEndo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState({
    rarity: '',
    type: '',
    recommendation: '',
    minQuantity: '',
    showSinglesOnly: false // Show only single copies (non-duplicates)
  });

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
        rarity: item.rarity || 'uncommon',
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

  // Apply filters and sorting
  const filteredAndSortedMods = useMemo(() => {
    let filtered = allMods;

    // Filter out single copies if showing duplicates only (default behavior)
    if (!filters.showSinglesOnly) {
      filtered = filtered.filter(mod => mod.quantity > 1);
    }

    // Apply other filters
    if (filters.rarity) {
      filtered = filtered.filter(mod => mod.rarity === filters.rarity);
    }
    if (filters.type) {
      filtered = filtered.filter(mod => mod.type === filters.type);
    }
    if (filters.recommendation) {
      filtered = filtered.filter(mod => mod.recommendation === filters.recommendation);
    }
    if (filters.minQuantity) {
      filtered = filtered.filter(mod => mod.quantity >= parseInt(filters.minQuantity));
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
  }, [allMods, filters, sortBy, sortOrder]);

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
      case 'uncommon': return 'text-green-400';
      case 'rare': return 'text-blue-400';
      case 'legendary': return 'text-purple-400';
      case 'primed': return 'text-yellow-400';
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

  return (
    <div ref={sectionRef} className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggle}
            className="flex items-center gap-2 text-white hover:text-tenno-blue transition-colors"
          >
            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            <Star size={20} className="text-purple-400" />
            <span className="font-semibold">Mod Duplicates</span>
          </button>
          
          {totals.duplicateCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded-full">
                {totals.duplicateCount} duplicates
              </span>
              {totals.totalMarketValue > 0 && (
                <span className="text-green-400">
                  ~{totals.totalMarketValue}p
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <LastRefreshInfo 
            lastRefreshTime={lastRefreshTime || getModLastRefreshTime()}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
            progress={progress}
            onCancel={onCancel}
          />
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${
              showFilters ? 'bg-tenno-blue/20 text-tenno-blue' : 'text-gray-400 hover:text-tenno-blue'
            }`}
            title="Toggle filters"
          >
            <Filter size={16} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Stats Summary */}
          <div className="p-4 border-b border-gray-700/50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <div className="text-xs text-gray-400 mb-1">Total Mods</div>
                <div className="text-sm font-medium text-white">{totals.totalMods}</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <div className="text-xs text-gray-400 mb-1">With Duplicates</div>
                <div className="text-sm font-medium text-yellow-400">{totals.duplicateCount}</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <div className="text-xs text-gray-400 mb-1">Market Value</div>
                <div className="text-sm font-medium text-green-400">{totals.totalMarketValue}p</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <div className="text-xs text-gray-400 mb-1">Endo Value</div>
                <div className="text-sm font-medium text-red-400">{totals.totalEndoValue}</div>
              </div>
            </div>

            {totals.bestValueMod && (
              <div className="mt-3 p-3 bg-tenno-blue/10 rounded-lg border border-tenno-blue/20">
                <div className="text-xs text-gray-400 mb-1">Best Plat/Endo Ratio</div>
                <div className="text-sm font-medium text-tenno-blue">
                  {totals.bestValueMod.name}: {formatPlatPerEndo(totals.bestValueMod.platPerEndo)}
                </div>
              </div>
            )}
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="p-4 border-b border-gray-700/50">
              <h4 className="text-sm font-medium text-white mb-3">Filters</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Rarity</label>
                    <select
                      value={filters.rarity}
                      onChange={(e) => setFilters({ ...filters, rarity: e.target.value })}
                      className="w-full bg-gray-700/50 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                    >
                      <option value="">All Rarities</option>
                      <option value="common">Common</option>
                      <option value="uncommon">Uncommon</option>
                      <option value="rare">Rare</option>
                      <option value="legendary">Legendary</option>
                      <option value="primed">Primed</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Type</label>
                    <select
                      value={filters.type}
                      onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                      className="w-full bg-gray-700/50 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                    >
                      <option value="">All Types</option>
                      <option value="warframe">Warframe</option>
                      <option value="weapon">Weapon</option>
                      <option value="companion">Companion</option>
                      <option value="archwing">Archwing</option>
                      <option value="stance">Stance</option>
                      <option value="augment">Augment</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Recommendation</label>
                    <select
                      value={filters.recommendation}
                      onChange={(e) => setFilters({ ...filters, recommendation: e.target.value })}
                      className="w-full bg-gray-700/50 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                    >
                      <option value="">All Recommendations</option>
                      <option value="KEEP_ALL">Keep All</option>
                      <option value="KEEP_ONE_SELL_REST">Keep One, Sell Rest</option>
                      <option value="TRADE_ON_MARKET">Trade on Market</option>
                      <option value="SELL_FOR_ENDO">Sell for Endo</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Min Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={filters.minQuantity}
                      onChange={(e) => setFilters({ ...filters, minQuantity: e.target.value })}
                      className="w-20 bg-gray-700/50 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                      placeholder="1"
                    />
                  </div>

                  <div className="flex items-center gap-2 mt-5">
                    <input
                      type="checkbox"
                      id="showSinglesOnly"
                      checked={filters.showSinglesOnly}
                      onChange={(e) => setFilters({ ...filters, showSinglesOnly: e.target.checked })}
                      className="rounded border-gray-600 bg-gray-700/50 text-tenno-blue focus:ring-tenno-blue"
                    />
                    <label htmlFor="showSinglesOnly" className="text-xs text-gray-400">
                      Show single copies too
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Sort by</label>
                  <div className="flex gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="flex-1 bg-gray-700/50 border border-gray-600 rounded px-3 py-2 text-sm text-white"
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
                      className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded text-white text-sm hover:bg-gray-600/50 transition-colors"
                    >
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                    onClick={() => setFilters({
                      rarity: '',
                      type: '',
                      recommendation: '',
                      minQuantity: '',
                      showSinglesOnly: false
                    })}
                    className="mt-2 text-tenno-blue hover:text-tenno-light text-sm underline"
                  >
                    Clear filters
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