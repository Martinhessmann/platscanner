// Purpose: Prime Sets Management UI - Shows buildable sets and tracks mastery progress
// Author: Assistant
// Last Updated: 2025-01-03

import React, { useState, useEffect, useRef } from 'react';
import { DetectedItem, VoidRelic } from '../types';
import {
  analyzeSetProgressWithMarketData,
  getSetRecommendations,
  toggleSetMastery,
  refreshPrimeSetsMarketData,
  refreshIndividualSetMarketData,
  getPrimeSetsLastRefresh,
  SetProgress,
  PrimeSet
} from '../services/primeSetService';
import {
  Trophy,
  Zap,
  CheckCircle,
  Circle,
  Target,
  Sword,
  Shield,
  Crosshair,
  Star,
  Hexagon,
  Heart,
  BookOpen,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  MessageCircle,
  ShoppingCart,
  Dices,
  Combine,
  RefreshCw,
  Check,
  ExternalLink,
  Filter
} from 'lucide-react';
import { getImageUrlSync, preloadImageData } from '../services/unifiedImageService';
import LastRefreshInfo from './LastRefreshInfo';
import {
  isSetPlanned,
  addToBuildPlan,
  removeFromBuildPlan,
  autoReserveItemsForSet,
  updateAllReservations
} from '../services/buildPlanService';

interface PrimeSetsProps {
  primePartsInventory: DetectedItem[];
  relicsInventory: VoidRelic[];
}

const PrimeSetsSection: React.FC<PrimeSetsProps> = ({
  primePartsInventory,
  relicsInventory
}) => {
  const [setProgress, setSetProgress] = useState<SetProgress[]>([]);
  const [recommendations, setRecommendations] = useState<{
    buildable: SetProgress[];
    nearComplete: SetProgress[];
    highValue: SetProgress[];
  }>({ buildable: [], nearComplete: [], highValue: [] });
  const [activeTab, setActiveTab] = useState<'all' | 'relics' | 'progress' | 'built' | 'vaulted' | 'warframes' | 'weapons' | 'companions'>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [plannedSets, setPlannedSets] = useState<Map<string, { planned: boolean; isPriority: boolean }>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number } | undefined>(undefined);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<'name' | 'completion' | 'investment' | 'profit' | 'type'>('completion');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSortOptions, setShowSortOptions] = useState(false);

  const sectionRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Persistent accordion state for Prime Sets
  const [isExpanded, setIsExpanded] = useState(() => {
    const stored = localStorage.getItem('accordion_prime_sets');
    return stored !== null ? JSON.parse(stored) : false;
  });

  // Save accordion state to localStorage
  useEffect(() => {
    localStorage.setItem('accordion_prime_sets', JSON.stringify(isExpanded));
  }, [isExpanded]);

  // Load last refresh time on mount
  useEffect(() => {
    const lastRefresh = getPrimeSetsLastRefresh();
    setLastRefreshTime(lastRefresh);
  }, []);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle clipboard copy with visual feedback
  const handleClipboardCopy = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems((prev: Set<string>) => new Set([...prev, itemId]));
      setTimeout(() => {
        setCopiedItems((prev: Set<string>) => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const toggleSetExpansion = (setId: string) => {
    setExpandedSets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(setId)) {
        newSet.delete(setId);
      } else {
        newSet.add(setId);
      }
      return newSet;
    });
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setShowSortOptions(false);
  };

  const getSortLabel = () => {
    const labels: Record<string, string> = {
      name: 'Name',
      completion: 'Progress',
      investment: 'Investment',
      profit: 'Profit',
      type: 'Type'
    };
    return labels[sortField] || 'Sort';
  };

  const handleRefreshPrimeSets = async () => {
    setIsRefreshing(true);
    setRefreshProgress({ current: 0, total: setProgress.length });

    try {
      await refreshPrimeSetsMarketData(primePartsInventory, relicsInventory);
      setRefreshKey((prev: number) => prev + 1);

      // Update last refresh time
      const newLastRefresh = new Date();
      setLastRefreshTime(newLastRefresh);

    } catch (error) {
      console.error('Failed to refresh prime sets:', error);
    } finally {
      setIsRefreshing(false);
      setRefreshProgress(undefined);
    }
  };

  const handleRefreshIndividualSet = async (progress: SetProgress) => {
    try {
      await refreshIndividualSetMarketData(progress.set.name);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Failed to refresh individual set:', error);
    }
  };

  // Load and analyze prime sets data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Preload image data
        await preloadImageData();

        // Analyze sets with market data
        const analyzed = await analyzeSetProgressWithMarketData(primePartsInventory, relicsInventory);
        setSetProgress(analyzed);

        // Get recommendations
        const recs = getSetRecommendations(analyzed);
        setRecommendations(recs);

        // Load planned sets from localStorage
        const planned = new Map<string, { planned: boolean; isPriority: boolean }>();
        analyzed.forEach(progress => {
          if (isSetPlanned(progress.set.id)) {
            planned.set(progress.set.id, { planned: true, isPriority: false });
          }
        });
        setPlannedSets(planned);

      } catch (error) {
        console.error('Failed to load prime sets data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce the loading to avoid excessive API calls
    const debouncedLoadData = () => {
      const timeoutId = setTimeout(loadData, 300);
      return () => clearTimeout(timeoutId);
    };

    // Always load all prime sets (like a CODEX)
    const cleanup = debouncedLoadData();
    return cleanup;
  }, [primePartsInventory, relicsInventory, refreshKey]);

  // Sync with buildPlanService for planned sets
  useEffect(() => {
    const syncPlannedSets = () => {
      const updated = new Map<string, { planned: boolean; isPriority: boolean }>();
      setProgress.forEach(progress => {
        if (isSetPlanned(progress.set.id)) {
          updated.set(progress.set.id, { planned: true, isPriority: false });
        }
      });
      setPlannedSets(updated);
    };

    syncPlannedSets();
  }, [setProgress]);

  const getSetState = (progress: SetProgress): 'default' | 'planned' | 'owned' => {
    const setMasteryKey = `set_mastery_${progress.set.id}`;
    const isOwned = localStorage.getItem(setMasteryKey) === 'true';
    
    if (isOwned) return 'owned';
    if (plannedSets.has(progress.set.id)) return 'planned';
    return 'default';
  };

  const handleStateChange = (progress: SetProgress, newState: 'default' | 'planned' | 'owned', isPriority: boolean = false) => {
    const currentState = getSetState(progress);

    if (currentState === 'planned' && newState !== 'planned') {
      // Remove from build plan
      removeFromBuildPlan(progress.set.id);
      updateAllReservations();

      setPlannedSets(prev => {
        const updated = new Map(prev);
        updated.delete(progress.set.id);
        return updated;
      });
    } else if (newState === 'planned' && currentState !== 'planned') {
      // Add to build plan
      addToBuildPlan(progress.set.id, isPriority);
      autoReserveItemsForSet(progress.set.id, isPriority);
      updateAllReservations();

      setPlannedSets(prev => {
        const updated = new Map(prev);
        updated.set(progress.set.id, { planned: true, isPriority });
        return updated;
      });
    } else if (newState === 'planned' && currentState === 'planned') {
      // Toggle priority for already planned set
      const currentPriority = plannedSets.get(progress.set.id)?.isPriority || false;
      const newPriority = !currentPriority;

      addToBuildPlan(progress.set.id, newPriority);
      autoReserveItemsForSet(progress.set.id, newPriority);
      updateAllReservations();

      setPlannedSets(prev => {
        const updated = new Map(prev);
        updated.set(progress.set.id, { planned: true, isPriority: newPriority });
        return updated;
      });
    } else if (newState === 'owned') {
      // Toggle mastery completion
      toggleSetMastery(progress.set.id);
      setRefreshKey(prev => prev + 1);
    }
  };

  const getTypeIcon = (type: PrimeSet['type']) => {
    switch (type) {
      case 'Warframe': return <Sword size={16} />;
      case 'Primary': return <Crosshair size={16} />;
      case 'Secondary': return <Target size={16} />;
      case 'Melee': return <Sword size={16} />;
      case 'Archwing': return <Heart size={16} />;
      case 'Sentinel': return <Hexagon size={16} />;
      default: return <Package size={16} />;
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-yellow-500';
    if (percentage >= 50) return 'bg-blue-500';
    return 'bg-gray-500';
  };

  const getRelicsForPart = (partName: string): string[] => {
    const relics: string[] = [];

    relicsInventory.forEach(relic => {
      if (relic.relicDrops && relic.relicDrops.some(drop => drop.itemName === partName)) {
        relics.push(relic.name);
      }
    });

    return relics;
  };

  // Calculate summary statistics with safety guards
  const totalSets = setProgress.length;
  const inProgressSets = Array.from(plannedSets.values()).filter(p => p.planned).length;
  const builtSets = setProgress.filter(p => {
    try {
      const setMasteryKey = `set_mastery_${p.set.id}`;
      return localStorage.getItem(setMasteryKey) === 'true';
    } catch {
      return false;
    }
  }).length;
  const vaultedSets = setProgress.filter(p => p.set.vaultStatus === 'vaulted').length;

  // Calculate potential buildable sets with relics
  const potentiallyBuildable = setProgress.filter(progress => {
    if (progress.completionPercentage >= 100) return false;

    const missingParts = progress.set.requiredParts.filter(
      part => !progress.ownedParts.includes(part.name)
    );

    return missingParts.some(part => {
      const getBaseName = (name: string) => {
        return name.replace(/\s+(Blueprint|Barrel|Receiver|Stock|Blade|Handle|Guard|Gauntlet|Lower Limb|Upper Limb|String|Grip|Link|Chain|Disc|Pouch|Cerebrum|Carapace|Systems|Chassis|Neuroptics|Harness|Wings|Fuselage)$/, '');
      };

      const baseName = getBaseName(part.name);
      return relicsInventory.some(relic =>
        relic.relicDrops && relic.relicDrops.some(drop =>
          getBaseName(drop.itemName) === baseName
        )
      );
    });
  });


  const getPrimeSetImageUrl = (setName: string): string => {
    // Use the unifiedImageService which handles proper name-to-image mapping
    const imageUrl = getImageUrlSync(setName);
    return imageUrl || '/images/primeparts/unknown.png';
  };

  const filteredSets = () => {
    const filtered = (() => {
      switch (activeTab) {
        case 'relics':
          return potentiallyBuildable;
        case 'progress':
          return setProgress.filter(p => plannedSets.has(p.set.id));
        case 'built':
          return setProgress.filter(p => {
            try {
              const setMasteryKey = `set_mastery_${p.set.id}`;
              return localStorage.getItem(setMasteryKey) === 'true';
            } catch {
              return false;
            }
          });
        case 'vaulted':
          return setProgress.filter(p => p.set.vaultStatus === 'vaulted');
        case 'warframes':
          return setProgress.filter(p => p.set.type === 'Warframe');
        case 'weapons':
          return setProgress.filter(p => ['Primary', 'Secondary', 'Melee'].includes(p.set.type));
        case 'companions':
          return setProgress.filter(p => ['Sentinel', 'Archwing'].includes(p.set.type));
        default:
          return setProgress;
      }
    })();

    // Apply sorting
    return filtered.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (sortField) {
        case 'name':
          valueA = a.set.name;
          valueB = b.set.name;
          break;
        case 'completion':
          valueA = a.completionPercentage;
          valueB = b.completionPercentage;
          break;
        case 'investment':
          valueA = a.investmentRequired || 0;
          valueB = b.investmentRequired || 0;
          break;
        case 'profit':
          valueA = a.expectedProfit || 0;
          valueB = b.expectedProfit || 0;
          break;
        case 'type':
          valueA = a.set.type;
          valueB = b.set.type;
          break;
        default:
          valueA = a.completionPercentage;
          valueB = b.completionPercentage;
      }

      if (sortField === 'name' || sortField === 'type') {
        return sortDirection === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      } else {
        return sortDirection === 'asc'
          ? valueA - valueB
          : valueB - valueA;
      }
    });
  };

  const sortedSets = filteredSets();


  return (
    <div ref={sectionRef} className="w-full mb-2">
      {/* Mobile-first sticky header */}
      <div className="bg-gray-900/50 backdrop-blur-sm p-3 rounded-t-xl border border-gray-700/50 border-b-0 sticky top-0 z-20">
        <button
          onClick={handleToggle}
          className="flex items-center justify-between w-full text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-400 group-hover:text-orokin-gold transition-colors" />
              ) : (
                <ChevronRight size={16} className="text-gray-400 group-hover:text-orokin-gold transition-colors" />
              )}
              <Shield size={20} className="text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-orokin-gold transition-colors">
                Prime Sets
              </h3>
              <p className="text-xs text-gray-400">
                {totalSets} set{totalSets !== 1 ? 's' : ''} • {vaultedSets} vaulted • {inProgressSets} planned
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center justify-end gap-1 mb-1">
              <Star size={14} className="text-yellow-400" />
              <span className="text-lg font-bold text-yellow-400">{inProgressSets}</span>
            </div>
            <div className="flex items-center justify-end gap-1">
              <CheckCircle size={10} className="text-green-400" />
              <span className="text-xs text-green-400">{builtSets}</span>
            </div>
          </div>
        </button>

        {/* Action buttons and refresh info - only show when expanded */}
        {isExpanded && setProgress.length > 0 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700/50">
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshPrimeSets}
                disabled={isRefreshing}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isRefreshing
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-tenno-blue/10 hover:bg-tenno-blue/20 text-tenno-blue border border-tenno-blue/20'
                }`}
                title="Refresh all Prime Sets market data"
              >
                <RefreshCw
                  size={14}
                  className={isRefreshing ? 'animate-spin' : ''}
                />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>

              {/* Sort Dropdown */}
              <div className="relative" ref={sortDropdownRef}>
                <button
                  onClick={() => setShowSortOptions(!showSortOptions)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
                >
                  <Filter size={12} />
                  <span className="hidden sm:inline">Sort: {getSortLabel()}</span>
                  <span className="sm:hidden">{getSortLabel()}</span>
                </button>

                {showSortOptions && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 min-w-[140px]">
                    <div className="p-2 space-y-1">
                      {[
                        { field: 'completion' as const, label: 'Progress' },
                        { field: 'investment' as const, label: 'Investment' },
                        { field: 'profit' as const, label: 'Profit' },
                        { field: 'name' as const, label: 'Name' },
                        { field: 'type' as const, label: 'Type' }
                      ].map(({ field, label }) => (
                        <button
                          key={field}
                          onClick={() => handleSort(field)}
                          className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                            sortField === field
                              ? 'bg-tenno-blue/20 text-tenno-blue'
                              : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                          }`}
                        >
                          {label} {sortField === field && (sortDirection === 'asc' ? '↑' : '↓')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <LastRefreshInfo
              lastRefreshDate={lastRefreshTime}
              className="ml-auto"
            />
          </div>
        )}

        {/* Progress bar - show when refreshing */}
        {isRefreshing && refreshProgress && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Refreshing market data...</span>
              <span className="text-xs text-gray-400">
                {refreshProgress.current} / {refreshProgress.total}
              </span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-tenno-blue transition-all duration-300"
                style={{
                  width: `${(refreshProgress.current / refreshProgress.total) * 100}%`
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 border-t-0 rounded-b-xl overflow-hidden">
          {/* Compact Tab Pills */}
          <div className="flex flex-wrap gap-2 p-6 pb-4">
        {/* All Sets */}
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeTab === 'all'
              ? 'bg-blue-900/50 border-blue-500/50 text-blue-400 ring-1 ring-blue-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Shield size={16} />
          <span>All Sets</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'all' ? 'bg-blue-800/50 text-blue-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {setProgress.length}
          </span>
        </button>


        {/* Buildable with Relics */}
        <button
          onClick={() => setActiveTab('relics')}
          disabled={potentiallyBuildable.length === 0}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeTab === 'relics'
              ? 'bg-yellow-900/50 border-yellow-500/50 text-yellow-400 ring-1 ring-yellow-500/30'
              : potentiallyBuildable.length > 0
                ? 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
                : 'bg-gray-900/30 border-gray-700/50 text-gray-500 opacity-60 cursor-not-allowed'
          }`}
        >
          <Hexagon size={16} />
          <span>With Relics</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'relics' ? 'bg-yellow-800/50 text-yellow-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {potentiallyBuildable.length}
          </span>
        </button>

        {/* In Progress Sets */}
        <button
          onClick={() => setActiveTab('progress')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeTab === 'progress'
              ? 'bg-orange-900/50 border-orange-500/50 text-orange-400 ring-1 ring-orange-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <BookOpen size={16} />
          <span>Planned</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'progress' ? 'bg-orange-800/50 text-orange-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {inProgressSets}
          </span>
        </button>

        {/* Built Sets */}
        <button
          onClick={() => setActiveTab('built')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeTab === 'built'
              ? 'bg-purple-900/50 border-purple-500/50 text-purple-400 ring-1 ring-purple-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Star size={16} />
          <span>Built</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'built' ? 'bg-purple-800/50 text-purple-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {builtSets}
          </span>
        </button>

        {/* Type Filters */}
        <button
          onClick={() => setActiveTab('warframes')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeTab === 'warframes'
              ? 'bg-cyan-900/50 border-cyan-500/50 text-cyan-400 ring-1 ring-cyan-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Sword size={16} />
          <span>Warframes</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'warframes' ? 'bg-cyan-800/50 text-cyan-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {setProgress.filter(p => p.set.type === 'Warframe').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('weapons')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeTab === 'weapons'
              ? 'bg-red-900/50 border-red-500/50 text-red-400 ring-1 ring-red-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Crosshair size={16} />
          <span>Weapons</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'weapons' ? 'bg-red-800/50 text-red-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {setProgress.filter(p => ['Primary', 'Secondary', 'Melee'].includes(p.set.type)).length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('vaulted')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeTab === 'vaulted'
              ? 'bg-amber-900/50 border-amber-500/50 text-amber-400 ring-1 ring-amber-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Package size={16} />
          <span>Vaulted</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'vaulted' ? 'bg-amber-800/50 text-amber-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {setProgress.filter(p => p.set.vaultStatus === 'vaulted').length}
          </span>
        </button>
      </div>

      {/* Sets List */}
      <div className="space-y-2 px-6 pb-6">
        {sortedSets.map((progress) => {
          const isExpanded = expandedSets.has(progress.set.id);

          return (
            <div key={progress.set.id} className="bg-gray-900/50 rounded-lg border border-gray-700/50 overflow-hidden">
              {/* Compact Summary - Always Visible */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-900/50 rounded border border-gray-700/50 flex-shrink-0 overflow-hidden">
                      <img
                        src={getPrimeSetImageUrl(progress.set.name)}
                        alt={progress.set.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/primeparts/unknown.png';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm leading-tight truncate">
                          {progress.set.name}
                        </span>
                        {getTypeIcon(progress.set.type)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{progress.set.type}</span>
                        {progress.set.vaultStatus === 'vaulted' && (
                          <span className="text-amber-400">Vaulted</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Individual refresh button */}
                    <button
                      onClick={() => handleRefreshIndividualSet(progress)}
                      disabled={progress.setMarketStatus === 'loading'}
                      className={`p-1 rounded-full transition-colors ${
                        progress.setMarketStatus === 'loading'
                          ? 'bg-gray-800/30 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-800/30 text-gray-400 border border-gray-600/30 hover:text-tenno-blue hover:border-tenno-blue/30'
                      }`}
                      title="Refresh market data for this set"
                    >
                      <RefreshCw
                        size={12}
                        className={progress.setMarketStatus === 'loading' ? 'animate-spin' : ''}
                      />
                    </button>

                    {/* Planned/Priority toggle button */}
                    <button
                      onClick={() => {
                        const currentState = getSetState(progress);
                        if (currentState === 'planned') {
                          // If already planned, toggle priority or remove from planned
                          const isPriority = plannedSets.get(progress.set.id)?.isPriority || false;
                          if (isPriority) {
                            // Remove from planned entirely
                            handleStateChange(progress, 'default');
                          } else {
                            // Make it priority
                            handleStateChange(progress, 'planned', true);
                          }
                        } else {
                          // Add to planned
                          handleStateChange(progress, 'planned', false);
                        }
                      }}
                      className={`p-1 rounded-full transition-colors ${
                        getSetState(progress) === 'planned'
                          ? plannedSets.get(progress.set.id)?.isPriority
                            ? 'bg-red-700/30 text-red-400 border border-red-500/30'
                            : 'bg-yellow-700/30 text-yellow-400 border border-yellow-500/30'
                          : 'bg-gray-800/30 text-gray-400 border border-gray-600/30 hover:text-yellow-300'
                      }`}
                      title={
                        getSetState(progress) === 'planned'
                          ? plannedSets.get(progress.set.id)?.isPriority
                            ? "Remove from planned"
                            : "Mark as priority"
                          : "Add to planned"
                      }
                    >
                      <Star size={12} />
                    </button>

                    {/* Done toggle button */}
                    <button
                      onClick={() => {
                        const currentState = getSetState(progress);
                        if (currentState === 'owned') {
                          handleStateChange(progress, 'default');
                        } else {
                          handleStateChange(progress, 'owned');
                        }
                      }}
                      className={`p-1 rounded-full transition-colors ${
                        getSetState(progress) === 'owned'
                          ? 'bg-green-700/30 text-green-400 border border-green-500/30'
                          : 'bg-gray-800/30 text-gray-400 border border-gray-600/30 hover:text-green-300'
                      }`}
                      title={getSetState(progress) === 'owned' ? "Mark as not done" : "Mark as done"}
                    >
                      <CheckCircle size={12} />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>{Math.round(progress.completionPercentage)}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 relative overflow-hidden">
                    {/* Owned parts (green) */}
                    <div
                      className="h-2 bg-green-500 rounded-full transition-all absolute left-0 top-0"
                      style={{ width: `${(progress.ownedParts.length / progress.set.requiredParts.length) * 100}%` }}
                    />
                    {/* Parts obtainable from relics (yellow) */}
                    <div
                      className="h-2 bg-yellow-500 rounded-full transition-all absolute top-0"
                      style={{ 
                        left: `${(progress.ownedParts.length / progress.set.requiredParts.length) * 100}%`,
                        width: `${(progress.obtainableFromRelics.filter(part => !progress.ownedParts.includes(part)).length / progress.set.requiredParts.length) * 100}%`
                      }}
                    />
                  </div>
                </div>

                {/* Compact Info Grid */}
                <div className="text-center mb-2">
                  <div className="text-gray-400 text-xs mb-1">Parts</div>
                  <div className="text-white font-medium">
                    <span className="text-green-400">{progress.ownedParts.length}</span>
                    {progress.obtainableFromRelics.filter(part => !progress.ownedParts.includes(part)).length > 0 && (
                      <span className="text-yellow-400">+{progress.obtainableFromRelics.filter(part => !progress.ownedParts.includes(part)).length}</span>
                    )}
                    <span className="text-gray-400">/{progress.set.requiredParts.length}</span>
                  </div>
                </div>

                {/* Toggle Button */}
                <button
                  onClick={() => toggleSetExpansion(progress.set.id)}
                  className="w-full mt-2 pt-2 border-t border-gray-700/50 flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp size={16} />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown size={16} />
                      Show Details
                    </>
                  )}
                </button>
              </div>

              {/* Expandable Detail Section */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-gray-700/50">
                  <div className="space-y-3 pt-3">
                    {/* Parts Status */}
                    <div>
                      <div className="text-xs text-gray-400 mb-2">
                        {progress.ownedParts.length} / {progress.set.requiredParts.length} parts owned
                        {progress.obtainableFromRelics.length > 0 && (
                          <span className="text-yellow-400 ml-2">
                            +{progress.obtainableFromRelics.length} in relics
                          </span>
                        )}
                      </div>

                      {/* Parts List */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-400/70">Part</span>
                          <span className="text-gray-400/70">Source</span>
                        </div>
                        {progress.set.requiredParts.map((part, index) => {
                          const isOwned = progress.ownedParts.includes(part.name);
                          const isObtainableFromRelics = progress.obtainableFromRelics.includes(part.name);

                          let iconColor = 'text-gray-500';
                          let textColor = 'text-gray-500';
                          let icon = <Circle size={12} />;

                          if (isOwned) {
                            iconColor = 'text-green-400';
                            textColor = 'text-green-400';
                            icon = <CheckCircle size={12} />;
                          } else if (isObtainableFromRelics) {
                            iconColor = 'text-yellow-400';
                            textColor = 'text-yellow-400';
                            icon = <Hexagon size={12} />;
                          }

                          const relicSources = getRelicsForPart(part.name);

                          return (
                            <div key={index} className="flex items-center justify-between text-xs bg-gray-800/20 rounded px-2 py-1">
                              <div className={`flex items-center gap-1 ${textColor}`}>
                                <span className={iconColor}>{icon}</span>
                                <span className="truncate">{part.partType}</span>
                                {part.itemCount && part.itemCount > 1 && (
                                  <span className="text-xs text-blue-400">x{part.itemCount}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {isObtainableFromRelics && !isOwned && (
                                  <span className="bg-yellow-900/30 text-yellow-400 px-1 py-0.5 text-[10px] rounded">RELIC</span>
                                )}
                                <span className={`${textColor} truncate text-xs text-right ml-1`}>
                                  {isOwned ? 'Owned' : isObtainableFromRelics ? (
                                    <span className="text-yellow-400" title={getRelicsForPart(part.name).join(', ')}>
                                      {getRelicsForPart(part.name).length > 1 
                                        ? `${getRelicsForPart(part.name).length} relics`
                                        : getRelicsForPart(part.name)[0] || 'Market only'
                                      }
                                    </span>
                                  ) : (
                                    <span className="text-gray-500">Market only</span>
                                  )}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {sortedSets.length === 0 && (
        <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg mx-6 mb-6">
          <div className="text-gray-400 mb-2">
            {activeTab === 'relics' && 'No sets buildable with relics'}
            {activeTab === 'progress' && 'No planned sets'}
            {activeTab === 'vaulted' && 'No vaulted sets found'}
            {activeTab === 'warframes' && 'No warframe sets found'}
            {activeTab === 'weapons' && 'No weapon sets found'}
            {activeTab === 'companions' && 'No companion sets found'}
            {activeTab === 'all' && 'No prime sets data available'}
            {activeTab === 'built' && 'No owned sets yet'}
          </div>
          <div className="text-sm text-gray-500">
            {activeTab === 'relics' && 'Open relics to get missing parts for sets'}
            {activeTab === 'progress' && 'Mark sets as "Planned" to track your build progress'}
            {activeTab === 'vaulted' && 'Vaulted sets are no longer obtainable from relics'}
            {activeTab === 'warframes' && 'Warframe prime sets include chassis, neuroptics, and systems'}
            {activeTab === 'weapons' && 'Weapon prime sets include barrels, receivers, and other parts'}
            {activeTab === 'companions' && 'Companion sets include sentinels, archwings, and kubrow collars'}
            {activeTab === 'all' && 'Prime parts will be analyzed for set completion'}
            {activeTab === 'built' && 'Mark completed sets as "Done"'}
          </div>
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
            <div className="flex items-center gap-3">
              <span className="text-gray-400 group-hover:text-gray-300 transition-colors">
                {totalSets} prime set{totalSets !== 1 ? 's' : ''}
              </span>
              {lastRefreshTime && (
                <span className="text-xs text-gray-500">
                  Updated {lastRefreshTime.toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {vaultedSets > 0 && (
                <div className="flex items-center gap-1 text-amber-400">
                  <Package size={14} />
                  <span className="font-medium">{vaultedSets} vaulted</span>
                </div>
              )}
              {inProgressSets > 0 && (
                <div className="flex items-center gap-1 text-yellow-400">
                  <Star size={14} />
                  <span className="font-medium">{inProgressSets} planned</span>
                </div>
              )}
              <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
                Tap to expand
              </span>
            </div>
          </div>
        </button>
      )}
    </div>
  );
};

export default PrimeSetsSection;