// Purpose: Prime Sets Management UI - Shows buildable sets and tracks mastery progress
// Author: Assistant
// Last Updated: 2025-01-03

import React, { useState, useEffect, useRef } from 'react';
import { DetectedItem, VoidRelic } from '../types';
import {
  analyzeSetProgressWithMarketData,
  getSetRecommendations,
  toggleSetMastery,
  getMasteredSets,
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
  removeFromBuildPlan
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
  const [activeTab, setActiveTab] = useState<'all' | 'planner' | 'priority' | 'built' | 'vaulted' | 'warframes' | 'weapons' | 'companions'>('all');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['all']));
  const [refreshKey, setRefreshKey] = useState(0);
  const [plannedSets, setPlannedSets] = useState<Map<string, { planned: boolean; isPriority: boolean }>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number } | undefined>(undefined);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<'name' | 'completion' | 'type'>('completion');
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
      // Default to ascending for name and type, descending for others
      setSortDirection(field === 'name' || field === 'type' ? 'asc' : 'desc');
    }
    setShowSortOptions(false);
  };

  const getSortLabel = () => {
    const labels: Record<string, string> = {
      name: 'Name',
      completion: 'Progress',
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

        // Analyze sets without market data
        const analyzed = await analyzeSetProgress(primePartsInventory, relicsInventory);
        setSetProgress(analyzed);

        // Get recommendations
        const recs = getSetRecommendations(analyzed);
        setRecommendations(recs);

        // Load planned sets from localStorage
        const planned = new Map<string, { planned: boolean; isPriority: boolean }>();
        analyzed.forEach(progress => {
          const planStatus = isSetPlanned(progress.set.id);
          if (planStatus.planned) {
            planned.set(progress.set.id, { planned: true, isPriority: planStatus.isPriority });
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
        const planStatus = isSetPlanned(progress.set.id);
        if (planStatus.planned) {
          updated.set(progress.set.id, { planned: true, isPriority: planStatus.isPriority });
        }
      });
      setPlannedSets(updated);
    };

    syncPlannedSets();
  }, [setProgress]);

  const getSetState = (progress: SetProgress): 'default' | 'planned' | 'owned' => {
    const masteredSets = getMasteredSets();
    const isOwned = masteredSets.includes(progress.set.id);
    
    if (isOwned) return 'owned';
    if (plannedSets.has(progress.set.id)) return 'planned';
    return 'default';
  };

  const handleStateChange = (progress: SetProgress, newState: 'default' | 'planned' | 'owned', isPriority: boolean = false) => {
    const currentState = getSetState(progress);

    if (currentState === 'planned' && newState !== 'planned') {
      // Remove from build plan
      removeFromBuildPlan(progress.set.id);

      setPlannedSets(prev => {
        const updated = new Map(prev);
        updated.delete(progress.set.id);
        return updated;
      });
    } else if (newState === 'planned' && currentState !== 'planned') {
      // Add to build plan
      addToBuildPlan(progress.set.id, isPriority);

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
    // Use the same matching logic as the service
    const matchingRelics = relicsInventory.filter(relic => {
      if (!relic.relicDrops || relic.relicDrops.length === 0) {
        return false;
      }

      const hasMatch = relic.relicDrops.some(drop => {
        const dropName = drop.itemName.toLowerCase();
        const targetPart = partName.toLowerCase();

        // Check for exact match
        if (dropName === targetPart) {
          return true;
        }

        // Check if the drop name contains the part name (removing "prime" for broader matching)
        if (dropName.includes(targetPart.replace(' prime ', ' '))) {
          return true;
        }

        // More precise part type matching - require item name to match too
        const partTypes = [
          'blueprint', 'systems', 'chassis', 'neuroptics', 'barrel', 'receiver', 'stock',
          'string', 'grip', 'blade', 'handle', 'link', 'gauntlet', 'carapace', 'cerebrum',
          'pouch', 'stars', 'boot', 'chain', 'disc', 'guard', 'hilt', 'head', 'ornament',
          'harness', 'wings', 'band', 'buckle', 'blades'
        ];

        // Extract the prime name from both (e.g., "atlas prime" from "atlas prime chassis")
        const getBaseName = (name: string) => {
          const parts = name.split(' ');
          const primeIndex = parts.findIndex(p => p === 'prime');
          if (primeIndex >= 0 && primeIndex < parts.length - 1) {
            return parts.slice(0, primeIndex + 1).join(' '); // e.g., "atlas prime"
          }
          return name;
        };

        const targetBaseName = getBaseName(targetPart);
        const dropBaseName = getBaseName(dropName);

        // Only match if BOTH the base name AND part type match
        const typeMatch = partTypes.some(partType =>
          targetPart.includes(partType) && dropName.includes(partType) &&
          targetBaseName === dropBaseName
        );

        return typeMatch;
      });

      return hasMatch;
    });
    return matchingRelics.map(relic => relic.name);
  };

  // Calculate summary statistics with safety guards
  const totalSets = setProgress.length;
  const masteredSets = getMasteredSets();
  const inProgressSets = Array.from(plannedSets.values()).filter(p => p.planned).length;
  const prioritySets = Array.from(plannedSets.values()).filter(p => p.isPriority).length;
  const builtSets = setProgress.filter(p => masteredSets.includes(p.set.id)).length;
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
    const masteredSets = getMasteredSets();
    
    let filtered = setProgress;

    // Apply all active filters
    if (!activeFilters.has('all')) {
      filtered = filtered.filter(p => {
        return Array.from(activeFilters).every(filter => {
          switch (filter) {
            case 'planner':
              // Show all sets that are NOT built (everything you can still work on)
              return !masteredSets.includes(p.set.id);
            case 'priority':
              // Show high-priority planned sets
              return plannedSets.get(p.set.id)?.isPriority || false;
            case 'built':
              // Show mastered/built sets
              return masteredSets.includes(p.set.id);
            case 'vaulted':
              return p.set.vaultStatus === 'vaulted';
            case 'warframes':
              return p.set.type === 'Warframe';
            case 'weapons':
              return ['Primary', 'Secondary', 'Melee'].includes(p.set.type);
            case 'companions':
              return ['Sentinel', 'Archwing', 'Companion'].includes(p.set.type);
            default:
              return true;
          }
        });
      });
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      // First, check priority status
      const aPriority = plannedSets.get(a.set.id)?.isPriority || false;
      const bPriority = plannedSets.get(b.set.id)?.isPriority || false;
      
      // Priority sets always come first
      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;
      
      // Within same priority level, apply user-selected sorting
      let valueA: any;
      let valueB: any;

      switch (sortField) {
        case 'name':
          valueA = a.set.name;
          valueB = b.set.name;
          break;
        case 'completion':
          // Advanced completion scoring: owned parts worth more than obtainable
          const aOwned = a.ownedParts.length;
          const aObtainable = a.obtainableFromRelics.length;
          const aTotal = a.set.requiredParts.length;
          
          const bOwned = b.ownedParts.length;
          const bObtainable = b.obtainableFromRelics.length;
          const bTotal = b.set.requiredParts.length;
          
          // Weighted score: owned parts worth 10x, obtainable worth 1x
          valueA = (aOwned * 10 + aObtainable) / (aTotal * 10);
          valueB = (bOwned * 10 + bObtainable) / (bTotal * 10);
          break;
        case 'type':
          valueA = a.set.type;
          valueB = b.set.type;
          break;
        default:
          // Default to advanced completion scoring
          const aOwnedDefault = a.ownedParts.length;
          const aObtainableDefault = a.obtainableFromRelics.length;
          const aTotalDefault = a.set.requiredParts.length;
          
          const bOwnedDefault = b.ownedParts.length;
          const bObtainableDefault = b.obtainableFromRelics.length;
          const bTotalDefault = b.set.requiredParts.length;
          
          valueA = (aOwnedDefault * 10 + aObtainableDefault) / (aTotalDefault * 10);
          valueB = (bOwnedDefault * 10 + bObtainableDefault) / (bTotalDefault * 10);
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
          onClick={() => toggleFilter('all')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeFilters.has('all')
              ? 'bg-blue-900/50 border-blue-500/50 text-blue-400 ring-1 ring-blue-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Shield size={16} />
          <span>All Sets</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeFilters.has('all') ? 'bg-blue-800/50 text-blue-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {setProgress.length}
          </span>
        </button>


        {/* Buildable with Relics */}
        <button
          onClick={() => toggleFilter('planner')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeFilters.has('planner')
              ? 'bg-blue-900/50 border-blue-500/50 text-blue-400 ring-1 ring-blue-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Target size={16} />
          <span>Planner</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeFilters.has('planner') ? 'bg-blue-800/50 text-blue-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {setProgress.length - builtSets}
          </span>
        </button>


        {/* Priority Sets */}
        <button
          onClick={() => toggleFilter('priority')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeFilters.has('priority')
              ? 'bg-yellow-900/50 border-yellow-500/50 text-yellow-400 ring-1 ring-yellow-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Star size={16} />
          <span>Priority</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeFilters.has('priority') ? 'bg-yellow-800/50 text-yellow-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {prioritySets}
          </span>
        </button>

        {/* Built Sets */}
        <button
          onClick={() => toggleFilter('built')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeFilters.has('built')
              ? 'bg-green-900/50 border-green-500/50 text-green-400 ring-1 ring-green-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <CheckCircle size={16} />
          <span>Built</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeFilters.has('built') ? 'bg-green-800/50 text-green-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {builtSets}
          </span>
        </button>

        {/* Type Filters */}
        <button
          onClick={() => toggleFilter('warframes')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeFilters.has('warframes')
              ? 'bg-cyan-900/50 border-cyan-500/50 text-cyan-400 ring-1 ring-cyan-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Sword size={16} />
          <span>Warframes</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeFilters.has('warframes') ? 'bg-cyan-800/50 text-cyan-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {setProgress.filter(p => p.set.type === 'Warframe').length}
          </span>
        </button>

        <button
          onClick={() => toggleFilter('weapons')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeFilters.has('weapons')
              ? 'bg-red-900/50 border-red-500/50 text-red-400 ring-1 ring-red-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Crosshair size={16} />
          <span>Weapons</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeFilters.has('weapons') ? 'bg-red-800/50 text-red-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {setProgress.filter(p => ['Primary', 'Secondary', 'Melee'].includes(p.set.type)).length}
          </span>
        </button>

        <button
          onClick={() => toggleFilter('companions')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeFilters.has('companions')
              ? 'bg-purple-900/50 border-purple-500/50 text-purple-400 ring-1 ring-purple-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Hexagon size={16} />
          <span>Misc</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeFilters.has('companions') ? 'bg-purple-800/50 text-purple-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {setProgress.filter(p => ['Sentinel', 'Archwing', 'Companion'].includes(p.set.type)).length}
          </span>
        </button>

        <button
          onClick={() => toggleFilter('vaulted')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeFilters.has('vaulted')
              ? 'bg-amber-900/50 border-amber-500/50 text-amber-400 ring-1 ring-amber-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Package size={16} />
          <span>Vaulted</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeFilters.has('vaulted') ? 'bg-amber-800/50 text-amber-300' : 'bg-gray-800/50 text-gray-400'
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
                    {/* Planned toggle button */}
                    <button
                      onClick={() => {
                        const currentState = getSetState(progress);
                        if (currentState === 'planned') {
                          handleStateChange(progress, 'default');
                        } else {
                          handleStateChange(progress, 'planned', false);
                        }
                      }}
                      className={`p-1 rounded-full transition-colors ${
                        getSetState(progress) === 'planned'
                          ? 'bg-yellow-700/30 text-yellow-400 border border-yellow-500/30'
                          : 'bg-gray-800/30 text-gray-400 border border-gray-600/30 hover:text-yellow-300'
                      }`}
                      title={getSetState(progress) === 'planned' ? "Remove from planned" : "Add to planned"}
                    >
                      <Star size={12} />
                    </button>

                    {/* Done toggle button */}
                    <button
                      onClick={() => {
                        toggleSetMastery(progress.set.id);
                        setRefreshKey(prev => prev + 1);
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
            No sets match the selected filters
          </div>
          <div className="text-sm text-gray-500">
            Active filters: {Array.from(activeFilters).join(' + ')}
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