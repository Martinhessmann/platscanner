// Purpose: Prime Sets Management UI - Shows buildable sets and tracks mastery progress
// Author: Assistant
// Last Updated: 2025-01-03

import React, { useState, useEffect, useRef } from 'react';
import { DetectedItem, VoidRelic } from '../types';
import {
  analyzeSetProgressWithMarketData,
  analyzeSetProgress,
  getSetRecommendations,
  toggleSetMastery,
  getMasteredSets,
  refreshPrimeSetsMarketData,
  refreshIndividualSetMarketData,
  getPrimeSetsLastRefresh,
  getPrimeSetsCache,
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
  ExternalLink
} from 'lucide-react';
import { getImageUrlSync, preloadImageData } from '../services/unifiedImageService';
import LastRefreshInfo from './LastRefreshInfo';
import {
  isSetPlanned,
  addToBuildPlan,
  removeFromBuildPlan,
  autoReserveItemsForSet,
  updateAllReservations,
  isItemReserved
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
  const [refreshingSet, setRefreshingSet] = useState<string | null>(null);
  const [copiedSetId, setCopiedSetId] = useState<string | null>(null);

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


  const handleRefreshPrimeSets = async () => {
    setIsRefreshing(true);

    // Get currently visible sets based on filters
    const visibleSets = filteredSets();
    const visibleSetNames = visibleSets.map(p => p.set.name);

    setRefreshProgress({ current: 0, total: visibleSetNames.length });

    try {
      await refreshPrimeSetsMarketData(primePartsInventory, relicsInventory, visibleSetNames);
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

  const handleRefreshIndividualSet = async (setNameOrProgress: string | SetProgress) => {
    try {
      const setName = typeof setNameOrProgress === 'string' ? setNameOrProgress : setNameOrProgress.set.name;
      const updatedProgress = await refreshIndividualSetMarketData(setName, primePartsInventory, relicsInventory);

      if (updatedProgress) {
        // Update the specific set in the state
        setSetProgress(prev => prev.map(p =>
          p.set.name === setName ? updatedProgress : p
        ));
      }
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

        // Merge in any cached market data from inventory-backed cache
        const cached = getPrimeSetsCache();
        if (cached && cached.length > 0) {
          const byName = new Map<string, SetProgress>(cached.map(c => [c.set.name, c]));
          analyzed.forEach(p => {
            const c = byName.get(p.set.name);
            if (c) {
              p.completeSetPrice = c.completeSetPrice;
              p.completeSetVolume = c.completeSetVolume;
              p.completeSetAverage = c.completeSetAverage;
              p.completeSetBuyerUsername = c.completeSetBuyerUsername;
              p.completeSetBuyerQuantity = c.completeSetBuyerQuantity;
              p.individualPartsValue = c.individualPartsValue;
              p.profitDifference = c.profitDifference;
              p.investmentAnalysis = c.investmentAnalysis;
              p.recommendedStrategy = c.recommendedStrategy;
              p.setMarketStatus = c.setMarketStatus || 'loaded';
              p.setMarketError = c.setMarketError;
            }
          });
        }

        setSetProgress(analyzed);

        // Get recommendations
        const recs = getSetRecommendations(analyzed);
        setRecommendations(recs);

        // Load planned sets from localStorage
        const planned = new Map<string, { planned: boolean; isPriority: boolean }>();
        analyzed.forEach(progress => {
          const planStatus = isSetPlanned(progress.set.name);
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
        const planStatus = isSetPlanned(progress.set.name);
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
      removeFromBuildPlan(progress.set.name);

      setPlannedSets(prev => {
        const updated = new Map(prev);
        updated.delete(progress.set.id);
        return updated;
      });
    } else if (newState === 'planned' && currentState !== 'planned') {
      // Add to build plan
      addToBuildPlan(progress.set.name, isPriority);

      setPlannedSets(prev => {
        const updated = new Map(prev);
        updated.set(progress.set.id, { planned: true, isPriority });
        return updated;
      });
    } else if (newState === 'planned' && currentState === 'planned') {
      // Toggle priority for already planned set
      const currentPriority = plannedSets.get(progress.set.id)?.isPriority || false;
      const newPriority = !currentPriority;

      addToBuildPlan(progress.set.name, newPriority);

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

  // Helper: Simplify relic names to base form (e.g., "Neo W2")
  const formatRelicName = (name: string): string => {
    // Remove trailing " Relic"
    let formatted = name.replace(/\s+Relic$/, '');
    // Remove refinement suffix like " [Radiant]" or standalone refinement words
    formatted = formatted.replace(/\s+\[(Intact|Exceptional|Flawless|Radiant)\]$/, '');
    formatted = formatted.replace(/\s+(Intact|Exceptional|Flawless|Radiant)$/i, '');
    return formatted;
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
    return matchingRelics.map(relic => formatRelicName(relic.name));
  };

  // NEW: Get refinement-level info for a part based on owned relics
  const getRefinementInfoForPart = (partName: string) => {
    const levels: Array<'radiant' | 'flawless' | 'exceptional' | 'intact'> = ['radiant', 'flawless', 'exceptional', 'intact'];
    const counts: Record<typeof levels[number], number> = {
      radiant: 0,
      flawless: 0,
      exceptional: 0,
      intact: 0
    } as const;
    const namesByLevel: Record<typeof levels[number], string[]> = {
      radiant: [],
      flawless: [],
      exceptional: [],
      intact: []
    } as const;

    // Reuse the same match logic as above
    relicsInventory.forEach(relic => {
      if (!relic.relicDrops || relic.relicDrops.length === 0) return;

      const hasMatch = relic.relicDrops.some(drop => {
        const dropName = drop.itemName.toLowerCase();
        const targetPart = partName.toLowerCase();

        if (dropName === targetPart) return true;
        if (dropName.includes(targetPart.replace(' prime ', ' '))) return true;

        const partTypes = [
          'blueprint', 'systems', 'chassis', 'neuroptics', 'barrel', 'receiver', 'stock',
          'string', 'grip', 'blade', 'handle', 'link', 'gauntlet', 'carapace', 'cerebrum',
          'pouch', 'stars', 'boot', 'chain', 'disc', 'guard', 'hilt', 'head', 'ornament',
          'harness', 'wings', 'band', 'buckle', 'blades'
        ];

        const getBaseName = (name: string) => {
          const parts = name.split(' ');
          const primeIndex = parts.findIndex(p => p === 'prime');
          if (primeIndex >= 0 && primeIndex < parts.length - 1) {
            return parts.slice(0, primeIndex + 1).join(' ');
          }
          return name;
        };

        const targetBaseName = getBaseName(targetPart);
        const dropBaseName = getBaseName(dropName);

        return partTypes.some(partType =>
          targetPart.includes(partType) && dropName.includes(partType) && targetBaseName === dropBaseName
        );
      });

      if (hasMatch) {
        const level = (relic.rarity as 'radiant' | 'flawless' | 'exceptional' | 'intact') || 'intact';
        const qty = relic.quantity || 1;
        counts[level] += qty;
        namesByLevel[level].push(formatRelicName(relic.name));
      }
    });

    return { counts, namesByLevel };
  };

  const refinementChipClasses: Record<'radiant' | 'flawless' | 'exceptional' | 'intact', string> = {
    radiant: 'text-yellow-400 border-yellow-500/30',
    flawless: 'text-blue-400 border-blue-500/30',
    exceptional: 'text-green-400 border-green-500/30',
    intact: 'text-gray-300 border-gray-500/30'
  };


  const refinementDotClasses: Record<'radiant' | 'flawless' | 'exceptional' | 'intact', string> = {
    radiant: 'bg-yellow-400',
    flawless: 'bg-blue-400',
    exceptional: 'bg-green-400',
    intact: 'bg-gray-400'
  };

  // Map refinement level to overlay color class
  const overlayColorForLevel: Record<'radiant' | 'flawless' | 'exceptional' | 'intact', string> = {
    radiant: 'bg-yellow-500',
    flawless: 'bg-blue-500',
    exceptional: 'bg-green-500',
    intact: 'bg-gray-500'
  };

  // Drop chance map (per single item) by rarity and refinement level
  const PART_DROP_CHANCE: Record<'Common' | 'Uncommon' | 'Rare', Record<'intact' | 'exceptional' | 'flawless' | 'radiant', number>> = {
    Common: { intact: 25.33, exceptional: 23.33, flawless: 20, radiant: 16.67 },
    Uncommon: { intact: 11, exceptional: 13, flawless: 17, radiant: 20 },
    Rare: { intact: 2, exceptional: 4, flawless: 6, radiant: 10 }
  };

  type RefinementLevel = 'intact' | 'exceptional' | 'flawless' | 'radiant';

  // Find the matching drop object for a part within a relic (robust matching)
  const findMatchingDrop = (partName: string, relic: VoidRelic) => {
    if (!relic.relicDrops) return undefined;
    const target = partName.toLowerCase();
    // Exact match first
    let drop = relic.relicDrops.find(d => d.itemName.toLowerCase() === target);
    if (drop) return drop;
    // Fallback: base-name + part-type match
    const partTypes = [
      'blueprint', 'systems', 'chassis', 'neuroptics', 'barrel', 'receiver', 'stock',
      'string', 'grip', 'blade', 'handle', 'link', 'gauntlet', 'carapace', 'cerebrum',
      'pouch', 'stars', 'boot', 'chain', 'disc', 'guard', 'hilt', 'head', 'ornament',
      'harness', 'wings', 'band', 'buckle', 'blades'
    ];
    const getBaseName = (name: string) => {
      const parts = name.split(' ');
      const primeIndex = parts.findIndex(p => p === 'prime');
      if (primeIndex >= 0 && primeIndex < parts.length - 1) {
        return parts.slice(0, primeIndex + 1).join(' ');
      }
      return name;
    };
    const targetBase = getBaseName(target);
    return relic.relicDrops.find(d => {
      const dn = d.itemName.toLowerCase();
      const dnBase = getBaseName(dn);
      return dnBase === targetBase && partTypes.some(t => target.includes(t) && dn.includes(t));
    });
  };

  // Compute minimal traces needed across owned relics to reach a target level
  const computeMinTracesToReach = (target: RefinementLevel, counts: Record<RefinementLevel, number>): number => {
    const have = (lvl: RefinementLevel) => (counts[lvl] || 0) > 0;
    if (target === 'radiant') {
      if (have('radiant')) return 0;
      if (have('flawless')) return 50;
      if (have('exceptional')) return 75;
      if (have('intact')) return 100;
      return 100;
    }
    if (target === 'flawless') {
      if (have('radiant') || have('flawless')) return 0;
      if (have('exceptional')) return 25;
      if (have('intact')) return 50;
      return 50;
    }
    if (target === 'exceptional') {
      if (have('radiant') || have('flawless') || have('exceptional')) return 0;
      if (have('intact')) return 25;
      return 25;
    }
    return 0; // intact
  };

  // Determine recommended refinement for a part based on drop rarity with a minimal-trace heuristic
  const getRefinementRecommendationForPart = (partName: string) => {
    // Gather all matching relics with their drop rarity
    const matches = relicsInventory
      .map(relic => ({ relic, drop: findMatchingDrop(partName, relic) }))
      .filter(x => !!x.drop)
      .map(x => ({
        baseName: formatRelicName(x.relic.name),
        level: (x.relic.rarity as RefinementLevel) || 'intact',
        dropRarity: x.drop!.rarity as 'Common' | 'Uncommon' | 'Rare'
      }));

    if (matches.length === 0) return null;

    // Tally counts per level for all matching relics
    const { counts } = getRefinementInfoForPart(partName);

    // Majority rarity (fallback to the first)
    const rarityCounts: Record<'Common' | 'Uncommon' | 'Rare', number> = { Common: 0, Uncommon: 0, Rare: 0 };
    matches.forEach(m => { rarityCounts[m.dropRarity] += 1; });
    const dropRarity = (Object.entries(rarityCounts).sort((a, b) => b[1] - a[1])[0][0] as 'Common' | 'Uncommon' | 'Rare') || matches[0].dropRarity;

    // Heuristic: choose minimal refinement that gives near-max chance
    let target: RefinementLevel;
    if (dropRarity === 'Rare') {
      target = 'radiant';
    } else if (dropRarity === 'Uncommon') {
      // Radiant=20, Flawless=17 (85% of max). Choose Flawless to save traces.
      target = 'flawless';
    } else {
      // Common best at Intact
      target = 'intact';
    }

    const chance = PART_DROP_CHANCE[dropRarity][target];
    const traces = computeMinTracesToReach(target, counts as any);

    return { target, chance, dropRarity, traces };
  };

  // Aggregate base relic names with quantities for a part, not truncated
  const getRelicBaseCountsForPart = (partName: string): Array<{ base: string; total: number }> => {
    const map = new Map<string, number>();
    relicsInventory.forEach(relic => {
      if (!relic.relicDrops || relic.relicDrops.length === 0) return;
      const drop = findMatchingDrop(partName, relic);
      if (!drop) return;
      const base = formatRelicName(relic.name);
      const qty = relic.quantity || 1;
      map.set(base, (map.get(base) || 0) + qty);
    });
    return Array.from(map.entries()).map(([base, total]) => ({ base, total }));
  };

  // Pick an overlay color for a set based on hardest recommended among obtainable missing parts
  const getOverlayColorForSet = (progress: SetProgress): string => {
    const missingParts = progress.set.requiredParts
      .filter(p => !progress.ownedParts.includes(p.name) && progress.obtainableFromRelics.includes(p.name));
    let hasRadiant = false;
    let hasFlawless = false;
    let hasExceptional = false;
    for (const part of missingParts) {
      const rec = getRefinementRecommendationForPart(part.name);
      if (!rec) continue;
      if (rec.target === 'radiant') hasRadiant = true;
      else if (rec.target === 'flawless') hasFlawless = true;
      else if (rec.target === 'exceptional') hasExceptional = true;
    }
    if (hasRadiant) return overlayColorForLevel.radiant;
    if (hasFlawless) return overlayColorForLevel.flawless;
    if (hasExceptional) return overlayColorForLevel.exceptional;
    return overlayColorForLevel.intact;
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
        // Check status filters (mutually exclusive - OR logic)
        const builtFilter = activeFilters.has('built');
        const plannerFilter = activeFilters.has('planner');
        const priorityFilter = activeFilters.has('priority');
        const nonPriorityFilter = activeFilters.has('non_priority');
        let statusMatch = true;

        if (builtFilter || plannerFilter || priorityFilter || nonPriorityFilter) {
          const isBuilt = masteredSets.includes(p.set.id);
          const isPriority = plannedSets.get(p.set.id)?.isPriority || false;
          const isPlanned = !isBuilt; // All non-built sets are "planned"
          const isNonPriority = !isBuilt && !isPriority; // Not built and not priority

          // OR logic: match if any active status filter matches
          statusMatch = (builtFilter && isBuilt) ||
                       (plannerFilter && isPlanned) ||
                       (priorityFilter && isPriority) ||
                       (nonPriorityFilter && isNonPriority);
        }

        // If status filter doesn't match, skip this set
        if (!statusMatch) {
          return false;
        }

        // Check all other filters (combinable - AND logic)
        return Array.from(activeFilters).every(filter => {
          // Skip status filters (already handled above)
          if (filter === 'built' || filter === 'planner' || filter === 'priority' || filter === 'non_priority') {
            return true;
          }

          switch (filter) {
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

    // Apply simple priority-first + completion-based sorting
    return filtered.sort((a, b) => {
      // Priority sets always come first
      const aPriority = plannedSets.get(a.set.id)?.isPriority || false;
      const bPriority = plannedSets.get(b.set.id)?.isPriority || false;

      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;

      // Within same priority level, sort by smart completion logic
      const aOwned = a.ownedParts.length;
      const aObtainable = a.obtainableFromRelics.length;
      const aTotal = a.set.requiredParts.length;

      const bOwned = b.ownedParts.length;
      const bObtainable = b.obtainableFromRelics.length;
      const bTotal = b.set.requiredParts.length;

      // Calculate completion potential
      const aCompletable = aOwned + aObtainable;
      const bCompletable = bOwned + bObtainable;

      // Priority order:
      // 1. Fully completable sets (owned + obtainable = total) - sort by owned parts
      // 2. Partially completable sets - sort by completion potential, then owned parts
      // 3. Non-completable sets - sort by owned parts only

      const aFullyCompletable = aCompletable >= aTotal;
      const bFullyCompletable = bCompletable >= bTotal;

      if (aFullyCompletable && !bFullyCompletable) return -1;
      if (!aFullyCompletable && bFullyCompletable) return 1;

      if (aFullyCompletable && bFullyCompletable) {
        // Both fully completable - prioritize by owned parts, then total completion
        if (aOwned !== bOwned) return bOwned - aOwned;
        return bCompletable - aCompletable;
      }

      // Neither fully completable - sort by completion potential, then owned
      const aCompletionPercent = aCompletable / aTotal;
      const bCompletionPercent = bCompletable / bTotal;

      if (Math.abs(aCompletionPercent - bCompletionPercent) > 0.01) {
        return bCompletionPercent - aCompletionPercent;
      }

      return bOwned - aOwned;
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

        // Special case: "Built", "Not Built", "Priority", and "Non-Priority" are mutually exclusive
        if (filter === 'built') {
          updated.delete('planner');
          updated.delete('priority');
          updated.delete('non_priority');
        } else if (filter === 'planner') {
          updated.delete('built');
          updated.delete('priority');
          updated.delete('non_priority');
        } else if (filter === 'priority') {
          updated.delete('built');
          updated.delete('planner');
          updated.delete('non_priority');
        } else if (filter === 'non_priority') {
          updated.delete('built');
          updated.delete('planner');
          updated.delete('priority');
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

  useEffect(() => {
    // Keep reservations in sync with current analysis and planned sets
    if (!setProgress || setProgress.length === 0) return;
    try {
      const setsForUpdate = setProgress.map(p => ({
        set: {
          name: p.set.name,
          requiredParts: p.set.requiredParts.map(rp => ({ name: rp.name, partType: rp.partType }))
        },
        ownedParts: p.ownedParts
      }));
      updateAllReservations(setsForUpdate, relicsInventory);
    } catch (e) {
      console.error('Failed to update reservations', e);
    }
  }, [setProgress, relicsInventory]);


  return (
    <div ref={sectionRef} className="w-full mb-2">
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
              <Shield size={20} className="text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-orokin-gold transition-colors">
                Prime Sets
              </h3>
            </div>
          </button>

          {/* Unified action buttons with consistent spacing */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshPrimeSets}
              disabled={isRefreshing}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                isRefreshing
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-tenno-blue hover:bg-tenno-blue/10'
              }`}
              title="Refresh all prime sets"
            >
              <RefreshCw
                size={12}
                className={isRefreshing ? 'animate-spin' : ''}
              />
              {isRefreshing && refreshProgress ? `${refreshProgress.current}/${refreshProgress.total}` : ''}
            </button>

            {/* Single timestamp location - removed duplicates */}
            {lastRefreshTime && (
              <LastRefreshInfo
                lastRefreshDate={lastRefreshTime}
                className="text-xs text-gray-500"
              />
            )}
          </div>
        </div>


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
          {/* Item count and key values - moved from header */}
          <div className="p-4 border-b border-gray-700/50">
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>{totalSets} sets</span>
              {vaultedSets > 0 && (
                <div className="flex items-center gap-1">
                  <Package size={10} className="text-amber-400" />
                  <span className="text-amber-400">{vaultedSets} vaulted</span>
                </div>
              )}
              {inProgressSets > 0 && (
                <div className="flex items-center gap-1">
                  <Star size={10} className="text-yellow-400" />
                  <span className="text-yellow-400">{inProgressSets} planned</span>
                </div>
              )}
            </div>
          </div>

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


        {/* Not Built Sets */}
        <button
          onClick={() => toggleFilter('planner')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeFilters.has('planner')
              ? 'bg-blue-900/50 border-blue-500/50 text-blue-400 ring-1 ring-blue-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Target size={16} />
          <span>Not Built</span>
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

        {/* Non-Priority Sets */}
        <button
          onClick={() => toggleFilter('non_priority')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeFilters.has('non_priority')
              ? 'bg-slate-900/50 border-slate-500/50 text-slate-300 ring-1 ring-slate-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Circle size={16} />
          <span>Non-Priority</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeFilters.has('non_priority') ? 'bg-slate-800/50 text-slate-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {setProgress.filter(p => {
              const isBuilt = masteredSets.includes(p.set.id);
              const isPriority = plannedSets.get(p.set.id)?.isPriority || false;
              return !isBuilt && !isPriority;
            }).length}
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
                    {/* Priority star button - toggles priority status only */}
                    <button
                      onClick={() => {
                        const currentPriority = plannedSets.get(progress.set.id)?.isPriority || false;

                        if (currentPriority) {
                          // Remove from priority (but keep as "planned" since all non-built are planned)
                          removeFromBuildPlan(progress.set.name);
                          setPlannedSets(prev => {
                            const updated = new Map(prev);
                            updated.delete(progress.set.id);
                            return updated;
                          });
                        } else {
                          // Add to priority
                          addToBuildPlan(progress.set.name, true);
                          // Auto-reserve all parts and relevant relics for this set
                          autoReserveItemsForSet(
                            progress.set.name,
                            progress.set.requiredParts.map(p => p.name),
                            progress.ownedParts,
                            relicsInventory
                          );
                          setPlannedSets(prev => {
                            const updated = new Map(prev);
                            updated.set(progress.set.id, { planned: true, isPriority: true });
                            return updated;
                          });
                        }
                      }}
                      className={`p-1 rounded-full transition-colors ${
                        plannedSets.get(progress.set.id)?.isPriority
                          ? 'bg-yellow-600/50 text-yellow-300 border border-yellow-400/50'
                          : 'bg-gray-800/30 text-gray-400 border border-gray-600/30 hover:text-yellow-300'
                      }`}
                      title={plannedSets.get(progress.set.id)?.isPriority ? "Remove from priority" : "Mark as priority"}
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
                    <span>
                      {Math.round(progress.completionPercentage)}%
                      {(() => {
                        const missingParts = progress.set.requiredParts.filter(part => !progress.ownedParts.includes(part.name));
                        const obtainableParts = missingParts.filter(part => progress.obtainableFromRelics.includes(part.name));

                        if (obtainableParts.length === 0) return '';

                        // Calculate total void trace cost for obtainable parts
                        const voidTraceCosts = { radiant: 100, flawless: 50, exceptional: 25, intact: 0 };
                        let totalTraces = 0;

                        obtainableParts.forEach(part => {
                          const rec = getRefinementRecommendationForPart(part.name);
                          if (rec) {
                            totalTraces += voidTraceCosts[rec.target as keyof typeof voidTraceCosts];
                          }
                        });

                        return totalTraces > 0 ? ` + ${totalTraces} traces` : '';
                      })()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 relative overflow-hidden">
                    {/* Owned parts (green) */}
                    <div
                      className="h-2 bg-green-500 rounded-full transition-all absolute left-0 top-0"
                      style={{ width: `${(progress.ownedParts.length / progress.set.requiredParts.length) * 100}%` }}
                    />
                    {/* Parts obtainable from relics (refinement level colors) */}
                    {(() => {
                      const missingParts = progress.set.requiredParts.filter(part => !progress.ownedParts.includes(part.name));
                      const obtainableParts = missingParts.filter(part => progress.obtainableFromRelics.includes(part.name));

                      if (obtainableParts.length === 0) return null;

                      // Group parts by refinement level
                      const partsByRefinement: Record<string, string[]> = {
                        radiant: [],
                        flawless: [],
                        exceptional: [],
                        intact: []
                      };

                      // Track void trace costs for each refinement level
                      const voidTraceCosts = {
                        radiant: 100,
                        flawless: 50,
                        exceptional: 25,
                        intact: 0
                      };

                      obtainableParts.forEach(part => {
                        const rec = getRefinementRecommendationForPart(part.name);
                        if (rec) {
                          partsByRefinement[rec.target].push(part.name);
                        } else {
                          partsByRefinement.intact.push(part.name); // Default to intact
                        }
                      });

                      // Map refinement level to color
                      const refinementColors = {
                        radiant: 'bg-yellow-500',
                        flawless: 'bg-blue-500',
                        exceptional: 'bg-green-500',
                        intact: 'bg-gray-500'
                      };

                        // Calculate total void trace cost for each refinement level
                        const totalTraceCosts: Record<string, number> = {};
                        Object.keys(partsByRefinement).forEach(refinement => {
                          const partCount = partsByRefinement[refinement].length;
                          totalTraceCosts[refinement] = partCount * voidTraceCosts[refinement as keyof typeof voidTraceCosts];
                        });

                        // Create segments for each refinement level, sorted by total void trace cost (lowest first)
                        const segments: JSX.Element[] = [];
                        let currentLeft = (progress.ownedParts.length / progress.set.requiredParts.length) * 100;

                        // Order by total void trace cost (lowest to highest)
                        const refinementOrder = Object.keys(totalTraceCosts)
                          .filter(refinement => partsByRefinement[refinement].length > 0)
                          .sort((a, b) => totalTraceCosts[a] - totalTraceCosts[b]);

                        refinementOrder.forEach(refinement => {
                          const partsForThisLevel = partsByRefinement[refinement];
                          if (partsForThisLevel.length > 0) {
                            const segmentWidth = (partsForThisLevel.length / progress.set.requiredParts.length) * 100;
                            const colorClass = refinementColors[refinement as keyof typeof refinementColors];
                            const totalCost = totalTraceCosts[refinement];

                            segments.push(
                              <div
                                key={refinement}
                                className={`h-2 ${colorClass} rounded-full transition-all absolute top-0`}
                                style={{
                                  left: `${currentLeft}%`,
                                  width: `${segmentWidth}%`
                                }}
                                title={`${refinement.charAt(0).toUpperCase() + refinement.slice(1)} (${partsForThisLevel.length} parts, ${totalCost} total void traces)`}
                              />
                            );

                            currentLeft += segmentWidth;
                          }
                        });

                      return segments;
                    })()}
                  </div>
                </div>

                {/* Trading Recommendation - Prominent at top */}
                {progress.recommendedStrategy && (
                  <div className={`mt-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                    (() => {
                      // Use expectedProfit from investmentAnalysis if available, otherwise fall back to profitDifference
                      const profit = progress.investmentAnalysis?.expectedProfit ?? progress.profitDifference ?? 0;
                      return profit > 0
                        ? 'bg-green-900/30 border-green-500/30 text-green-400'
                        : profit < 0
                        ? 'bg-red-900/30 border-red-500/30 text-red-400'
                        : 'bg-gray-800/30 border-gray-600/30 text-gray-400';
                    })()
                  }`}>
                    💰 {progress.recommendedStrategy === 'SELL_PARTS' ? 'SELL PARTS' : progress.recommendedStrategy === 'SELL_SET' ? 'SELL SET' : progress.recommendedStrategy.replace(/_/g, ' ')}
                    {(() => {
                      // Use expectedProfit (ROI) if available, otherwise profitDifference
                      const profit = progress.investmentAnalysis?.expectedProfit ?? progress.profitDifference ?? 0;
                      if (profit !== 0) {
                        return (
                          <span className="ml-1">
                            ({profit > 0 ? '+' : ''}{profit.toFixed(1)}p {progress.investmentAnalysis ? 'ROI' : 'profit'})
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}

                {/* Value summary with clearer labels */}
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-gray-400">Owned Parts</div>
                    <div className="flex items-center gap-1 text-blue-400">
                      <Zap size={12} />
                      <span className="font-medium">
                        {Math.round(progress.individualPartsValue ?? 0)}p
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Investment</div>
                    <div className="flex items-center gap-1 text-orange-400">
                      <ShoppingCart size={12} />
                      <span className="font-medium">
                        {(() => {
                          // Use buyInvestmentCost from investmentAnalysis if available, otherwise missingCost
                          const investment = progress.investmentAnalysis?.buyInvestmentCost ?? progress.missingCost ?? 0;
                          return investment > 0 ? `${Math.round(investment)}p` : '—';
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-gray-400">Set Price</div>
                    <div className="flex items-center gap-1 text-green-400">
                      <DollarSign size={12} />
                      <span className="font-medium">
                        {Math.round(progress.completeSetPrice ?? 0)}p
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">48h Average</div>
                    <div className="flex items-center gap-1 text-gray-300">
                      <TrendingUp size={12} />
                      <span className="font-medium">
                        {progress.completeSetAverage !== undefined ? `${Math.round(progress.completeSetAverage * 10) / 10}p` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Volume indicator */}
                {progress.completeSetVolume !== undefined && progress.completeSetVolume > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    Volume: {progress.completeSetVolume} {progress.completeSetVolume === 1 ? 'sale' : 'sales'} (48h)
                  </div>
                )}

                {/* Market Actions */}
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-700/50">
                  <div className="flex items-center gap-2">
                    {/* Refresh Button */}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        setRefreshingSet(progress.set.name);
                        try {
                          await handleRefreshIndividualSet(progress.set.name);
                        } finally {
                          setRefreshingSet(null);
                        }
                      }}
                      disabled={refreshingSet === progress.set.name}
                      className={`p-1 rounded text-xs transition-colors ${
                        refreshingSet === progress.set.name
                          ? 'text-gray-500 cursor-not-allowed'
                          : 'text-tenno-blue hover:bg-gray-700/50'
                      }`}
                      title="Refresh market prices"
                    >
                      <RefreshCw size={12} className={refreshingSet === progress.set.name ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Message Button - Only show if complete set has buyers */}
                    {progress.completeSetBuyerUsername && progress.completeSetPrice && progress.completeSetPrice > 0 ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const message = `/w ${progress.completeSetBuyerUsername} Hi! I want to sell: "${progress.set.name} Set" for ${progress.completeSetPrice} platinum. (warframe.market)`;
                          navigator.clipboard.writeText(message);
                          setCopiedSetId(progress.set.id);
                          setTimeout(() => setCopiedSetId(null), 2000);
                        }}
                        className={`flex items-center gap-1 text-tenno-blue hover:text-tenno-light transition-colors text-xs ${
                          copiedSetId === progress.set.id ? 'text-tenno-light' : ''
                        }`}
                        title="Copy message to clipboard"
                      >
                        {copiedSetId === progress.set.id ? <Check size={10} /> : <MessageCircle size={10} />}
                        <span className="hidden sm:inline">Message</span>
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-600 text-xs">
                        <MessageCircle size={10} />
                        <span className="hidden sm:inline">No buyers</span>
                      </span>
                    )}

                    {/* Market Link */}
                    <a
                      href={`https://warframe.market/items/${progress.set.name.toLowerCase().replace(/ /g, '_')}_set`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors text-xs"
                      title="View on Warframe Market"
                    >
                      <ExternalLink size={10} />
                      <span className="hidden sm:inline">Market</span>
                    </a>
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

                      {/* Legend */}
                      <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
                        <div className="flex items-center gap-1">
                          <Package size={12} className="text-green-400" />
                          <span>In Inventory</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Hexagon size={12} className="text-yellow-400" />
                          <span>From Relics</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Circle size={12} className="text-gray-500" />
                          <span>Market Only</span>
                        </div>
                      </div>

                      {/* Parts List */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-400/70">Part</span>
                          <span className="text-gray-400/70">Source</span>
                        </div>
                        {[...progress.set.requiredParts]
                          .sort((a, b) => {
                            const aOwned = progress.ownedParts.includes(a.name);
                            const bOwned = progress.ownedParts.includes(b.name);
                            if (aOwned !== bOwned) return aOwned ? -1 : 1;
                            const aObtain = progress.obtainableFromRelics.includes(a.name);
                            const bObtain = progress.obtainableFromRelics.includes(b.name);
                            if (aObtain && bObtain) {
                              const aRec = getRefinementRecommendationForPart(a.name);
                              const bRec = getRefinementRecommendationForPart(b.name);
                              const aCost = aRec ? aRec.traces : Number.POSITIVE_INFINITY;
                              const bCost = bRec ? bRec.traces : Number.POSITIVE_INFINITY;
                              return aCost - bCost;
                            }
                            if (aObtain !== bObtain) return aObtain ? -1 : 1;
                            return 0;
                          })
                          .map((part, index) => {
                          const isOwned = progress.ownedParts.includes(part.name);
                          const isObtainableFromRelics = progress.obtainableFromRelics.includes(part.name);
                          let iconColor = 'text-gray-500';
                          let textColor = 'text-gray-500';
                          let icon = <Circle size={12} />;

                          if (isOwned) {
                            iconColor = 'text-green-400';
                            textColor = 'text-green-400';
                            icon = <Package size={12} />;
                          } else if (isObtainableFromRelics) {
                            iconColor = 'text-yellow-400';
                            textColor = 'text-yellow-400';
                            icon = <Hexagon size={12} />;
                          }

                          const relicBaseCounts = getRelicBaseCountsForPart(part.name);
                          const reservation = isItemReserved(part.name, 'prime_parts');
                          const reservedForThisSet = reservation.reserved && reservation.reservedFor.includes(progress.set.name);
                          const { counts, namesByLevel } = getRefinementInfoForPart(part.name);
                          const rec = getRefinementRecommendationForPart(part.name);

                          return (
                            <div key={index} className="flex items-center justify-between text-xs bg-gray-800/20 rounded px-2 py-1">
                              <div className={`flex items-center gap-1 ${textColor}`}>
                                <span className={iconColor}>{icon}</span>
                                <span className="truncate">{part.partType}</span>
                                {part.itemCount && part.itemCount > 1 && (
                                  <span className="text-xs text-blue-400">x{part.itemCount}</span>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 text-right">
                                <span className={`${textColor} text-xs`}>
                                  {isOwned ? (() => {
                                    // Find price for this owned part from inventory
                                    const inventoryItem = primePartsInventory.find(item => {
                                      const lowerItemName = item.name.toLowerCase();
                                      const lowerPartName = part.name.toLowerCase();
                                      return lowerItemName === lowerPartName || lowerItemName === `${lowerPartName} blueprint`;
                                    });
                                    
                                    if (!inventoryItem) {
                                      return <span className="text-gray-500">Not found</span>;
                                    }
                                    
                                    // Check if it's a built warframe part (not tradeable)
                                    const isBuiltWarframe = progress.set.type === 'Warframe' && 
                                      !inventoryItem.name.toLowerCase().includes('blueprint') &&
                                      ['chassis', 'systems', 'neuroptics'].some(comp => 
                                        inventoryItem.name.toLowerCase().includes(comp)
                                      );
                                    
                                    if (isBuiltWarframe) {
                                      // Built warframe component - show special indicator
                                      return (
                                        <span className="flex flex-col items-end">
                                          <span className="text-orange-400 text-xs">Built (Not Tradeable)</span>
                                        </span>
                                      );
                                    }
                                    
                                    // Check if it's a blueprint
                                    const isBlueprint = inventoryItem.name.toLowerCase().includes('blueprint');
                                    
                                    if (inventoryItem.price && inventoryItem.price > 0) {
                                      return (
                                        <span className="flex flex-col items-end">
                                          <span>{inventoryItem.price}p {isBlueprint && <span className="text-[10px] text-blue-400">(BP)</span>}</span>
                                          {inventoryItem.average && inventoryItem.average !== inventoryItem.price && (
                                            <span className="text-[10px] text-gray-600">48h: {inventoryItem.average}p</span>
                                          )}
                                        </span>
                                      );
                                    }
                                    return <span className="text-gray-500">No buyers {isBlueprint && <span className="text-[10px] text-blue-400">(BP)</span>}</span>;
                                  })() : (
                                    isObtainableFromRelics ? (
                                      <span className="text-gray-400"></span>
                                    ) : (
                                      (() => {
                                        // Find price for this missing part
                                        const priceData = progress.investmentAnalysis?.missingPartsWithPrices?.find(
                                          p => p.name.toLowerCase() === part.name.toLowerCase()
                                        );
                                        return (
                                          <span className="text-gray-500">
                                            {priceData ? (
                                              <span className="flex flex-col items-end">
                                                <span>{priceData.price}p</span>
                                                {priceData.avg48h && priceData.avg48h !== priceData.price && (
                                                  <span className="text-[10px] text-gray-600">48h: {priceData.avg48h}p</span>
                                                )}
                                              </span>
                                            ) : 'Market only'}
                                          </span>
                                        );
                                      })()
                                    )
                                  )}
                                </span>
                                {!isOwned && isObtainableFromRelics && rec && (
                                  <div className="flex items-center gap-1 justify-end">
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${refinementChipClasses[rec.target]}`} title={`Recommended refinement`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${refinementDotClasses[rec.target]}`} />
                                      <span className="capitalize">{rec.target}</span>
                                    </span>
                                  </div>
                                )}
                                {isObtainableFromRelics && !isOwned && relicBaseCounts.length > 0 && (
                                  <div className="flex items-end gap-2 flex-col">
                                    <div className="flex items-start gap-2 flex-col text-right">
                                      {relicBaseCounts.map(({ base, total }) => (
                                        <button
                                          key={base}
                                          onClick={() => {
                                            console.log('[PrimeSets] Button clicked for relic:', base);

                                            // First expand the relics section
                                            console.log('[PrimeSets] Dispatching expand-section event');
                                            window.dispatchEvent(new CustomEvent('expand-section', {
                                              detail: { section: 'relics' }
                                            }));

                                            // Then navigate to the specific relic
                                            setTimeout(() => {
                                              console.log('[PrimeSets] Dispatching focus-relic event for:', base);
                                              window.dispatchEvent(new CustomEvent('focus-relic', {
                                                detail: {
                                                  name: base,
                                                  expandDetails: true,
                                                  scrollToSection: true
                                                }
                                              }));
                                            }, 300); // Increased timeout to ensure section is expanded
                                          }}
                                          className="text-[11px] text-gray-300 hover:text-white underline decoration-dotted underline-offset-2 transition-colors"
                                          title={`Focus ${base} in Relics section`}
                                        >
                                          {base}{total > 1 ? ` x${total}` : ''}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
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

export default PrimeSetsSection;