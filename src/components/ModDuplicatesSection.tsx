// Purpose: Mod Duplicates Management Section - Help users decide which duplicate mods to sell for endo vs trade
// Follows patterns from SyndicateRewardsSection and InventorySection

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, Filter, TrendingUp, Shield, Zap, Trash2, ExternalLink, Star, Package, Coins, X, Plus, Minus } from 'lucide-react';
import { Mod } from '../types';
import {
  ModItem,
  ModDuplicateAnalysis,
  loadModInventory,
  saveModInventory,
  addModToInventory,
  removeModFromInventory,
  clearModInventory,
  refreshModPrices,
  analyzeModDuplicates,
  determineModRarity,
  determineModType,
  getModLastRefreshTime,
  setModLastRefreshTime
} from '../services/modService';
import LastRefreshInfo from './LastRefreshInfo';
import UnifiedSectionHeader from './UnifiedSectionHeader';

interface ModDuplicatesSectionProps {
  isRefreshing: boolean;
  onRefreshStart: () => void;
  onRefreshComplete: () => void;
  onCancel?: () => void;
  progress?: { current: number; total: number };
  lastRefreshTime?: Date | null;
}

const ModDuplicatesSection: React.FC<ModDuplicatesSectionProps> = ({
  isRefreshing,
  onRefreshStart,
  onRefreshComplete,
  onCancel,
  progress,
  lastRefreshTime
}) => {
  const [mods, setMods] = useState<ModItem[]>([]);
  const [analysis, setAnalysis] = useState<ModDuplicateAnalysis | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showAddMod, setShowAddMod] = useState(false);
  const [newModName, setNewModName] = useState('');
  const [newModQuantity, setNewModQuantity] = useState(1);
  const [newModRank, setNewModRank] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'recommendation' | 'platPerEndo' | 'endoValue' | 'marketValue'>('recommendation');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState({
    rarity: '',
    type: '',
    recommendation: '',
    minQuantity: '',
    showDuplicatesOnly: true
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

  // Load mods from storage
  useEffect(() => {
    const loadMods = () => {
      const storedMods = loadModInventory();
      setMods(storedMods);
      
      if (storedMods.length > 0) {
        const modAnalysis = analyzeModDuplicates(storedMods);
        setAnalysis(modAnalysis);
      } else {
        setAnalysis(null);
      }
    };

    loadMods();
  }, []);

  // Handle refresh
  const handleRefresh = async () => {
    if (mods.length === 0) return;
    
    onRefreshStart();
    try {
      const updatedMods = await refreshModPrices(mods, progress ? 
        (current, total) => {
          // Progress is handled by parent component
        } : undefined
      );
      
      setMods(updatedMods);
      saveModInventory(updatedMods);
      
      const newAnalysis = analyzeModDuplicates(updatedMods);
      setAnalysis(newAnalysis);
      
      setModLastRefreshTime(new Date());
    } catch (error) {
      console.error('Failed to refresh mod prices:', error);
    } finally {
      onRefreshComplete();
    }
  };

  // Add new mod
  const handleAddMod = () => {
    if (!newModName.trim()) return;
    
    const rarity = determineModRarity(newModName);
    const type = determineModType(newModName);
    
    const newMod = addModToInventory({
      name: newModName.trim(),
      rank: newModRank,
      quantity: newModQuantity,
      rarity,
      type,
      status: 'loading'
    });
    
    const updatedMods = loadModInventory();
    setMods(updatedMods);
    
    const newAnalysis = analyzeModDuplicates(updatedMods);
    setAnalysis(newAnalysis);
    
    // Reset form
    setNewModName('');
    setNewModQuantity(1);
    setNewModRank(undefined);
    setShowAddMod(false);
  };

  // Remove mod
  const handleRemoveMod = (modId: string) => {
    removeModFromInventory(modId);
    const updatedMods = loadModInventory();
    setMods(updatedMods);
    
    const newAnalysis = analyzeModDuplicates(updatedMods);
    setAnalysis(newAnalysis);
  };

  // Clear all mods
  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all mods? This cannot be undone.')) {
      clearModInventory();
      setMods([]);
      setAnalysis(null);
    }
  };

  // Apply filters and sorting
  const filteredAndSortedMods = useMemo(() => {
    let filtered = mods.filter(mod => {
      // Rarity filter
      if (filters.rarity && mod.rarity !== filters.rarity) return false;
      
      // Type filter
      if (filters.type && mod.type !== filters.type) return false;
      
      // Recommendation filter
      if (filters.recommendation && mod.recommendation !== filters.recommendation) return false;
      
      // Min quantity filter
      if (filters.minQuantity && mod.quantity < parseInt(filters.minQuantity)) return false;
      
      // Show duplicates only
      if (filters.showDuplicatesOnly && mod.quantity <= 1) return false;
      
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'quantity':
          aVal = a.quantity;
          bVal = b.quantity;
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
        case 'marketValue':
          aVal = (a.price || 0) * a.quantity;
          bVal = (b.price || 0) * b.quantity;
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return filtered;
  }, [mods, filters, sortBy, sortOrder]);

  // Get recommendation color
  const getRecommendationColor = (recommendation?: string) => {
    switch (recommendation) {
      case 'KEEP_ALL': return 'text-green-400';
      case 'KEEP_ONE_SELL_REST': return 'text-yellow-400';
      case 'TRADE_ON_MARKET': return 'text-blue-400';
      case 'SELL_FOR_ENDO': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  // Get rarity color
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

  return (
    <div ref={sectionRef} className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50">
      <UnifiedSectionHeader
        title="Mod Duplicates Manager"
        subtitle="Analyze duplicate mods and get recommendations for selling vs trading"
        icon={<Star size={20} className="text-purple-400" />}
        isExpanded={isExpanded}
        onToggle={handleToggle}
        itemCount={mods.length}
        totalValue={analysis?.potentialPlatinum}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onClearAll={handleClearAll}
        lastRefreshTime={lastRefreshTime || getModLastRefreshTime()}
        progress={progress}
        onCancel={onCancel}
      />

      {isExpanded && (
        <div className="p-4 pt-0">
          {/* Analysis Summary */}
          {analysis && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="text-lg font-semibold text-white">{analysis.totalMods}</div>
                <div className="text-xs text-gray-400">Total Mods</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="text-lg font-semibold text-yellow-400">{analysis.duplicates}</div>
                <div className="text-xs text-gray-400">Duplicates</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="text-lg font-semibold text-red-400">{analysis.totalEndoValue}</div>
                <div className="text-xs text-gray-400">Endo Value</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="text-lg font-semibold text-blue-400">{analysis.potentialPlatinum}p</div>
                <div className="text-xs text-gray-400">Potential Plat</div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setShowAddMod(!showAddMod)}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg border border-green-500/30 hover:bg-green-600/30 transition-colors text-sm"
            >
              <Plus size={14} />
              Add Mod
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-600/20 text-gray-300 rounded-lg border border-gray-500/30 hover:bg-gray-600/30 transition-colors text-sm"
            >
              <Filter size={14} />
              Filters
            </button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
            >
              <option value="recommendation">Sort by Recommendation</option>
              <option value="name">Sort by Name</option>
              <option value="quantity">Sort by Quantity</option>
              <option value="platPerEndo">Sort by Plat/Endo</option>
              <option value="endoValue">Sort by Endo Value</option>
              <option value="marketValue">Sort by Market Value</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm hover:bg-gray-600 transition-colors"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {/* Add Mod Form */}
          {showAddMod && (
            <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-gray-400 mb-1">Mod Name</label>
                  <input
                    type="text"
                    value={newModName}
                    onChange={(e) => setNewModName(e.target.value)}
                    placeholder="e.g., Serration, Primed Flow"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500"
                  />
                </div>
                <div className="w-20">
                  <label className="block text-xs text-gray-400 mb-1">Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={newModQuantity}
                    onChange={(e) => setNewModQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div className="w-20">
                  <label className="block text-xs text-gray-400 mb-1">Rank</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={newModRank || ''}
                    onChange={(e) => setNewModRank(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="0-10"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500"
                  />
                </div>
                <button
                  onClick={handleAddMod}
                  disabled={!newModName.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddMod(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Filters */}
          {showFilters && (
            <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Rarity</label>
                  <select
                    value={filters.rarity}
                    onChange={(e) => setFilters({...filters, rarity: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm"
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
                    onChange={(e) => setFilters({...filters, type: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm"
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
                    onChange={(e) => setFilters({...filters, recommendation: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm"
                  >
                    <option value="">All Recommendations</option>
                    <option value="KEEP_ALL">Keep All</option>
                    <option value="KEEP_ONE_SELL_REST">Keep One, Sell Rest</option>
                    <option value="TRADE_ON_MARKET">Trade on Market</option>
                    <option value="SELL_FOR_ENDO">Sell for Endo</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Min Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={filters.minQuantity}
                    onChange={(e) => setFilters({...filters, minQuantity: e.target.value})}
                    placeholder="1"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm"
                  />
                </div>
                
                <div className="flex items-center">
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={filters.showDuplicatesOnly}
                      onChange={(e) => setFilters({...filters, showDuplicatesOnly: e.target.checked})}
                      className="rounded"
                    />
                    Duplicates Only
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Mods List */}
          {filteredAndSortedMods.length > 0 ? (
            <div className="space-y-2">
              {filteredAndSortedMods.map((mod) => (
                <div key={mod.id} className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">{mod.name}</span>
                        {mod.rank !== undefined && (
                          <span className="text-xs bg-gray-600 px-1.5 py-0.5 rounded text-gray-300">
                            R{mod.rank}
                          </span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded ${getRarityColor(mod.rarity)} bg-gray-600/50`}>
                          {mod.rarity}
                        </span>
                        <span className="text-xs text-gray-400">{mod.type}</span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-300">
                        <span>Qty: {mod.quantity}</span>
                        {mod.price && <span>Price: {mod.price}p</span>}
                        {mod.endoValue && <span>Endo: {mod.endoValue}</span>}
                        {mod.platPerEndo && <span>Plat/Endo: {mod.platPerEndo.toFixed(2)}</span>}
                      </div>
                      
                      {mod.recommendation && (
                        <div className="mt-1">
                          <span className={`text-sm font-medium ${getRecommendationColor(mod.recommendation)}`}>
                            {mod.recommendation.replace(/_/g, ' ')}
                          </span>
                          {mod.reasoning && (
                            <p className="text-xs text-gray-400 mt-1">{mod.reasoning}</p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {mod.price && (
                        <a
                          href={`https://warframe.market/items/${mod.name.toLowerCase().replace(/\s+/g, '_')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-400 transition-colors"
                          title="View on Warframe Market"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      
                      <button
                        onClick={() => handleRemoveMod(mod.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                        title="Remove mod"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : mods.length > 0 ? (
            <div className="text-center text-gray-400 py-8">
              <Filter size={40} className="mx-auto mb-2 opacity-50" />
              <p>No mods match the current filters</p>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <Star size={40} className="mx-auto mb-2 opacity-50" />
              <p className="mb-2">No mods in inventory</p>
              <p className="text-sm">Add mods manually or they will be detected automatically from screenshots</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModDuplicatesSection;