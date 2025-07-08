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
  const [activeTab, setActiveTab] = useState<'all' | 'buildable' | 'relics' | 'progress' | 'built' | 'vaulted' | 'warframes' | 'weapons' | 'companions'>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [plannedSets, setPlannedSets] = useState<Map<string, { planned: boolean; isPriority: boolean }>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number } | undefined>(undefined);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());

  const sectionRef = useRef<HTMLDivElement>(null);

  // Persistent accordion state for Prime Sets
  const [isExpanded, setIsExpanded] = useState(() => {
    const stored = localStorage.getItem('accordion_prime_sets');
    return stored !== null ? JSON.parse(stored) : true;
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

  // Handle clipboard copy with visual feedback
  const handleClipboardCopy = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems(prev => new Set(prev).add(itemId));

      // Clear the copied state after 2 seconds
      setTimeout(() => {
        setCopiedItems(prev => {
          const updated = new Set(prev);
          updated.delete(itemId);
          return updated;
        });
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  // Auto-scroll to section when collapsing
  const handleToggle = () => {
    if (isExpanded && sectionRef.current) {
      // Scroll to top of section when collapsing
      sectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
    setIsExpanded(!isExpanded);
  };

    // Handle refresh Prime Sets market data
  const handleRefreshPrimeSets = async () => {
    if (isRefreshing) return;

    try {
      setIsRefreshing(true);
      setRefreshProgress({ current: 0, total: setProgress.length });

      console.log('🔄 [Prime Sets] Starting manual refresh...');

      // Force refresh market data
      const refreshedProgress = await refreshPrimeSetsMarketData(primePartsInventory, relicsInventory);

      setSetProgress(refreshedProgress);

      // Update last refresh time
      const newRefreshTime = new Date();
      setLastRefreshTime(newRefreshTime);

      // Update reservations for all planned sets
      setTimeout(() => {
        updateAllReservations(refreshedProgress, relicsInventory);
      }, 0);

      console.log('✅ [Prime Sets] Manual refresh completed');
    } catch (error) {
      console.error('❌ [Prime Sets] Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
      setRefreshProgress(undefined);
    }
  };

    // Handle refresh individual Prime Set
  const handleRefreshIndividualSet = async (progress: SetProgress) => {
    try {
      console.log(`🔄 [Prime Set] Refreshing individual set: ${progress.set.name}`);

      // Update the specific set to loading state
      setSetProgress(prev => prev.map(p =>
        p.set.id === progress.set.id
          ? { ...p, setMarketStatus: 'loading' as const }
          : p
      ));

      // Use the new individual refresh function
      const updatedSet = await refreshIndividualSetMarketData(
        progress.set.name,
        primePartsInventory,
        relicsInventory
      );

      if (updatedSet) {
        setSetProgress(prev => prev.map(p =>
          p.set.id === progress.set.id ? updatedSet : p
        ));

        // Update last refresh time
        setLastRefreshTime(new Date());

        console.log(`✅ [Prime Set] Individual refresh completed for ${progress.set.name}`);
      } else {
        throw new Error('Failed to refresh individual set data');
      }
    } catch (error) {
      console.error(`❌ [Prime Set] Individual refresh failed for ${progress.set.name}:`, error);

      // Set error state for this set
      setSetProgress(prev => prev.map(p =>
        p.set.id === progress.set.id
          ? {
              ...p,
              setMarketStatus: 'error' as const,
              setMarketError: 'Failed to refresh market data'
            }
          : p
      ));
    }
  };

  // Calculate progress on inventory changes
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setIsLoading(true);
        const [progress, recs] = await Promise.all([
          analyzeSetProgressWithMarketData(primePartsInventory, relicsInventory),
          getSetRecommendations(primePartsInventory, relicsInventory)
        ]);

        if (isMounted) {
                    setSetProgress(progress);
          setRecommendations(recs);

          // Update all reservations for all planned sets after data is loaded
          // Use type-safe progress data
          setTimeout(() => {
            updateAllReservations(progress, relicsInventory);
          }, 0);
        }
      } catch (error) {
        console.error('Failed to load prime sets data:', error);
        if (isMounted) {
          setSetProgress([]);
          setRecommendations({ buildable: [], nearComplete: [], highValue: [] });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [primePartsInventory, relicsInventory, refreshKey]);

  // Load planned sets on component mount and when refresh key changes
  useEffect(() => {
    const planned = new Map<string, { planned: boolean; isPriority: boolean }>();
    setProgress.forEach(progress => {
      const planStatus = isSetPlanned(progress.set.name);
      planned.set(progress.set.id, planStatus);
    });
    setPlannedSets(planned);
  }, [setProgress, refreshKey]);

  // Calculate sets that could be built with relics
  const potentiallyBuildable = setProgress.filter(p =>
    !p.canBuild &&
    !p.ismastered &&
    (p.ownedParts.length + p.obtainableFromRelics.length) === p.set.requiredParts.length
  );

  // Simplified 3-state system: buildable → planned → owned
  const getSetState = (progress: SetProgress): 'buildable' | 'planned' | 'owned' => {
    if (progress.ismastered) return 'owned';
    if (plannedSets.get(progress.set.id)?.planned) return 'planned';
    return 'buildable';
  };

  const handleStateChange = (progress: SetProgress, newState: 'buildable' | 'planned' | 'owned', isPriority: boolean = false) => {
    const currentState = getSetState(progress);
    if (currentState === newState && newState !== 'planned') return;

    const setName = progress.set.name;
    const setId = progress.set.id;

    // Clear previous state
    if (currentState === 'planned') {
      removeFromBuildPlan(setName);
    }
    if (currentState === 'owned') {
      toggleSetMastery(setId); // Remove mastery
    }

    // Set new state
    if (newState === 'planned') {
      // If already planned, we might be just toggling priority
      const isCurrentlyPlanned = plannedSets.get(progress.set.id)?.planned || false;
      const currentPriority = plannedSets.get(progress.set.id)?.isPriority || false;

      // If already planned and we're just toggling priority
      if (isCurrentlyPlanned && currentPriority !== isPriority) {
        addToBuildPlan(setName, isPriority);
        setPlannedSets(prev => {
          const updated = new Map(prev);
          updated.set(setId, { planned: true, isPriority });
          return updated;
        });
        setRefreshKey(prev => prev + 1);
        return;
      }

      addToBuildPlan(setName, isPriority);
      // Auto-reserve parts
      const requiredPartNames = progress.set.requiredParts.map(part =>
        `${progress.set.name} ${part.partType}`
      );
      autoReserveItemsForSet(setName, requiredPartNames, progress.ownedParts, relicsInventory);
    } else if (newState === 'owned') {
      removeFromBuildPlan(setName); // Remove from plan if it was planned
      toggleSetMastery(setId); // Mark as mastered
      
      // IMMEDIATE STATE UPDATE - Fix for owned status bug
      setSetProgress(prev => prev.map(p => 
        p.set.id === setId 
          ? { ...p, ismastered: true }
          : p
      ));
    }

    // Clear previous state for transitions from 'owned'
    if (currentState === 'owned' && newState !== 'owned') {
      // Immediate state update when removing mastery
      setSetProgress(prev => prev.map(p => 
        p.set.id === setId 
          ? { ...p, ismastered: false }
          : p
      ));
    }

    // Update local state
    setPlannedSets(prev => {
      const updated = new Map(prev);
      updated.set(setId, { planned: newState === 'planned', isPriority: isPriority });
      return updated;
    });

    setRefreshKey(prev => prev + 1);
  };

  const getTypeIcon = (type: PrimeSet['type']) => {
    switch (type) {
      case 'Warframe': return <Shield size={16} className="text-blue-400" />;
      case 'Primary': return <Crosshair size={16} className="text-red-400" />;
      case 'Secondary': return <Target size={16} className="text-orange-400" />;
      case 'Melee': return <Sword size={16} className="text-purple-400" />;
      case 'Sentinel': return <Shield size={16} className="text-cyan-400" />;
      case 'Archwing': return <Zap size={16} className="text-green-400" />;
      case 'Companion': return <Heart size={16} className="text-pink-400" />;
    }
  };

  const getProgressColor = (percentage: number) => {
    return 'bg-gray-500'; // Always gray as requested
  };

  const getRelicsForPart = (partName: string): string[] => {
    const lowerPartName = partName.toLowerCase();
    const matchingOwnedRelics: string[] = [];

    // Check each owned relic's drop data to see if it contains our target part
    for (const ownedRelic of relicsInventory) {
      // Use the relic's existing drop data (should be populated when scanned)
      if (ownedRelic.relicDrops && ownedRelic.relicDrops.length > 0) {
        // Focus on reservation debugging only

        const hasTargetPart = ownedRelic.relicDrops.some(drop => {
          const dropName = drop.itemName.toLowerCase();
          const targetPart = lowerPartName;

          // Check for exact match
          if (dropName === targetPart) {
            return true;
          }

          // Check if the drop name contains the part name (removing "prime" for broader matching)
          if (dropName.includes(targetPart.replace(' prime ', ' '))) {
            return true;
          }

          // Check specific part type matching
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

        if (hasTargetPart) {
          matchingOwnedRelics.push(ownedRelic.name.replace(' Relic', ''));
        }
      }
    }

    // Focus on reservation debugging only

    return matchingOwnedRelics;
  };

  // Get better relic source display text
  const getRelicSourceText = (partName: string, isOwned: boolean, isObtainableFromRelics: boolean): string => {
    // Focus on reservation debugging only

    if (isOwned) {
      return 'Owned'; // Part is already owned
    }

    if (isObtainableFromRelics) {
      const relicSources = getRelicsForPart(partName);
      return relicSources.length > 0
        ? relicSources.join(', ') // Show all relics without truncation
        : 'Unknown Source';
    }

    return 'Not Available'; // Part is not owned and not in relics
  };

  // Get prime set image URL using unified service (synchronous)
  const getPrimeSetImageUrl = (setName: string): string => {
    // Try to get from unified service cache (after preload)
    const cachedUrl = getImageUrlSync(setName);
    if (cachedUrl) {
      return cachedUrl;
    }

    // Fallback for sets not in cache yet
    const fallbackUrl = `/images/primeparts/${setName.toLowerCase().replace(/ /g, '-')}.png`;
    return fallbackUrl;
  };

  // Preload image data when component mounts
  useEffect(() => {
    preloadImageData().catch(error => {
      console.error('Failed to preload prime sets image data:', error);
    });
  }, []);

  const filteredSets = () => {
    switch (activeTab) {
      case 'buildable':
        return setProgress.filter(p => p.canBuild && !p.ismastered);
      case 'relics':
        return potentiallyBuildable;
      case 'progress':
        return setProgress.filter(p => !p.canBuild && !p.ismastered && (plannedSets.get(p.set.id)?.planned || false));
      case 'built':
        return setProgress.filter(p => p.ismastered);
      case 'vaulted':
        return setProgress.filter(p => p.set.vaulted);
      case 'warframes':
        return setProgress.filter(p => p.set.type === 'Warframe');
      case 'weapons':
        return setProgress.filter(p => ['Primary', 'Secondary', 'Melee'].includes(p.set.type));
      case 'companions':
        return setProgress.filter(p => ['Sentinel', 'Archwing', 'Companion'].includes(p.set.type));
      case 'all':
        return setProgress;
      default:
        return setProgress;
    }
  };

  const sortedSets = filteredSets().sort((a, b) => {
    // First, sort by priority flag
    const aPriority = plannedSets.get(a.set.id)?.isPriority || false;
    const bPriority = plannedSets.get(b.set.id)?.isPriority || false;

    if (aPriority && !bPriority) return -1;
    if (!aPriority && bPriority) return 1;

    // Then sort by buildable status
    if (a.canBuild && !b.canBuild) return -1;
    if (!a.canBuild && b.canBuild) return 1;

    // Finally sort by completion percentage
    return b.completionPercentage - a.completionPercentage;
  });

  if (isLoading) {
    return (
      <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg">
        <Shield size={48} className="mx-auto text-gray-600 mb-4 animate-pulse" />
        <p className="text-gray-400">Loading prime sets...</p>
        <p className="text-sm text-gray-500 mt-1">Analyzing {setProgress.length || 'all'} prime sets from database.</p>
      </div>
    );
  }

  if (primePartsInventory.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg">
        <Shield size={48} className="mx-auto text-gray-600 mb-4" />
        <p className="text-gray-400">No prime parts detected yet.</p>
        <p className="text-sm text-gray-500 mt-1">Upload screenshots of your prime inventory to see buildable sets.</p>
      </div>
    );
  }

  // Calculate summary stats
  const totalSets = setProgress.length;
  const buildableSets = recommendations.buildable.length;
  const inProgressSets = setProgress.filter(p => plannedSets.get(p.set.id)?.planned || false).length;
  const builtSets = setProgress.filter(p => p.ismastered).length;

  // Helper function to get strategy icon and color
  const getStrategyDisplay = (strategy?: string) => {
    switch (strategy) {
      case 'SELL_PARTS':
        return {
          icon: Package,
          color: 'text-blue-400',
          bgColor: 'bg-blue-900/20',
          label: 'Sell Parts',
          description: 'Higher profit selling individual parts'
        };
      case 'BUILD_AND_SELL':
        return {
          icon: TrendingUp,
          color: 'text-green-400',
          bgColor: 'bg-green-900/20',
          label: 'Build & Sell',
          description: 'Higher profit selling complete set'
        };
      case 'OPEN_RELICS':
        return {
          icon: Dices,
          color: 'text-purple-400',
          bgColor: 'bg-purple-900/20',
          label: 'Open Relics',
          description: 'Open relics to get missing parts'
        };
      case 'BUY_MISSING':
        return {
          icon: ShoppingCart,
          color: 'text-orange-400',
          bgColor: 'bg-orange-900/20',
          label: 'Buy Missing',
          description: 'Buy missing parts to complete set'
        };
      case 'HYBRID_STRATEGY':
        return {
          icon: Combine,
          color: 'text-cyan-400',
          bgColor: 'bg-cyan-900/20',
          label: 'Hybrid Strategy',
          description: 'Combine relic opening + buying parts'
        };
      case 'KEEP_FOR_MASTERY':
        return {
          icon: Trophy,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-900/20',
          label: 'Keep',
          description: 'Already mastered'
        };
      default:
        return {
          icon: DollarSign,
          color: 'text-gray-400',
          bgColor: 'bg-gray-900/20',
          label: 'Unknown',
          description: 'Insufficient market data'
        };
    }
  };

  // Trading Strategy Card Component
  const TradingStrategyCard: React.FC<{ progress: SetProgress }> = ({ progress }) => {
    if (!progress.setMarketStatus || progress.setMarketStatus === 'loading') {
      return (
        <div className="mt-3 p-3 bg-gray-900/20 rounded-lg">
          <div className="flex items-center gap-2 text-gray-400">
            <DollarSign size={16} className="animate-pulse" />
            <span className="text-sm">Loading market analysis...</span>
          </div>
        </div>
      );
    }

    if (progress.setMarketStatus === 'error') {
      return (
        <div className="mt-3 p-3 bg-red-900/20 rounded-lg border border-red-800/30">
          <div className="flex items-center gap-2 text-red-400">
            <DollarSign size={16} />
            <span className="text-sm">Market analysis unavailable</span>
          </div>
          {progress.setMarketError && (
            <p className="text-xs text-red-500 mt-1">{progress.setMarketError}</p>
          )}
        </div>
      );
    }

    const strategy = getStrategyDisplay(progress.recommendedStrategy);
    const individualValue = progress.individualPartsValue || 0;
    const completeSetValue = progress.completeSetPrice || 0;
    const profitDiff = progress.profitDifference || 0;
    const investment = progress.investmentAnalysis;

    const hasMarketData = individualValue > 0 || completeSetValue > 0;

    if (!hasMarketData) {
      return (
        <div className="mt-3 p-3 bg-gray-900/20 rounded-lg">
          <div className="flex items-center gap-2 text-gray-400">
            <DollarSign size={16} />
            <span className="text-sm">No market data available</span>
          </div>
        </div>
      );
    }

    return (
      <div className={`mt-3 p-3 rounded-lg border ${strategy.bgColor} border-gray-700/50`}>
        {/* Strategy Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <strategy.icon size={16} className={strategy.color} />
            <span className={`text-sm font-medium ${strategy.color}`}>
              {strategy.label}
            </span>
          </div>
          {/* Profit/ROI Indicator */}
          {investment ? (
            <div className={`flex items-center gap-1 text-xs ${investment.expectedProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {investment.expectedProfit > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{investment.expectedProfit > 0 ? '+' : ''}{investment.expectedProfit.toFixed(0)}p</span>
              <span className="text-gray-400">({investment.roiPercentage.toFixed(0)}% ROI)</span>
            </div>
          ) : Math.abs(profitDiff) > 0 && (
            <div className={`flex items-center gap-1 text-xs ${profitDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {profitDiff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {profitDiff > 0 ? '+' : ''}{profitDiff.toFixed(0)}p
            </div>
          )}
        </div>

        {/* Investment Analysis Details */}
        {investment && (progress.recommendedStrategy === 'OPEN_RELICS' || progress.recommendedStrategy === 'BUY_MISSING' || progress.recommendedStrategy === 'HYBRID_STRATEGY') ? (
          <div className="space-y-3">
            {/* Current vs Potential */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="text-gray-400">Current Value</div>
                <div className="text-white font-medium">{investment.currentValue.toFixed(0)}p</div>
              </div>
              <div className="space-y-1">
                <div className="text-gray-400">Potential Value</div>
                <div className="text-white font-medium">{investment.potentialValue.toFixed(0)}p</div>
              </div>
            </div>

            {/* Investment Breakdown */}
            <div className="bg-gray-800/30 rounded p-2 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Investment Required:</span>
                <span className="text-orange-400 font-medium">{investment.totalInvestmentCost.toFixed(0)}p</span>
              </div>

              {investment.relicInvestmentCost > 0 && (
                <div className="flex justify-between items-center text-xs pl-2">
                  <span className="text-gray-500">• Relic opening ({investment.missingPartsFromRelics.length} parts):</span>
                  <span className="text-purple-400">{investment.relicInvestmentCost.toFixed(0)}p</span>
                </div>
              )}

              {investment.buyInvestmentCost > 0 && (
                <div className="flex justify-between items-center text-xs pl-2">
                  <span className="text-gray-500">• Buy missing ({investment.missingPartsToBuy.length} parts):</span>
                  <span className="text-orange-400">{investment.buyInvestmentCost.toFixed(0)}p</span>
                </div>
              )}

              <div className="border-t border-gray-700/50 pt-1 flex justify-between items-center text-xs">
                <span className="text-gray-400">Expected Profit:</span>
                <span className={`font-medium ${investment.expectedProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {investment.expectedProfit > 0 ? '+' : ''}{investment.expectedProfit.toFixed(0)}p
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {investment.missingPartsFromRelics.length > 0 && (
                <button
                  onClick={() => {
                    // TODO: Show modal or navigate to relics section filtered by needed parts
                    console.log('View Relics for:', investment.missingPartsFromRelics);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-purple-600/20 border border-purple-500/30 rounded text-xs text-purple-400 hover:bg-purple-600/30 transition-colors"
                >
                  <Dices size={12} />
                  View Relics
                </button>
              )}

              {investment.missingPartsToBuy.length > 0 && (
                <button
                  onClick={() => {
                    // Open Warframe Market search for missing parts
                    const searchQuery = investment.missingPartsToBuy.map(part =>
                      part.replace(/^.*?\s/, '').toLowerCase() // Remove prime name, keep part type
                    ).join('%20');
                    const searchUrl = `https://warframe.market/search?q=${searchQuery}`;
                    window.open(searchUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-orange-600/20 border border-orange-500/30 rounded text-xs text-orange-400 hover:bg-orange-600/30 transition-colors"
                >
                  <ShoppingCart size={12} />
                  Find Parts
                </button>
              )}

              {progress.completeSetBuyerUsername && (
                <button
                  onClick={() => {
                    const message = `/w ${progress.completeSetBuyerUsername} Hi! I want to sell: "${progress.set.name} Set" for ${progress.completeSetPrice} platinum. (warframe.market)`;
                    handleClipboardCopy(message, `set-${progress.set.id}`);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded text-xs text-blue-400 hover:bg-blue-600/30 transition-colors ${
                    copiedItems.has(`set-${progress.set.id}`) ? 'text-green-400' : ''
                  }`}
                >
                  {copiedItems.has(`set-${progress.set.id}`) ? <Check size={12} /> : <MessageCircle size={12} />}
                  Message
                </button>
              )}
            </div>

            {/* Missing Parts List */}
            {(investment.missingPartsFromRelics.length > 0 || investment.missingPartsToBuy.length > 0) && (
              <div className="text-xs space-y-1">
                {investment.missingPartsFromRelics.length > 0 && (
                  <div>
                    <span className="text-purple-400">From relics:</span>
                    <span className="text-gray-300 ml-1">{investment.missingPartsFromRelics.map(part => part.split(' ').pop()).join(', ')}</span>
                  </div>
                )}
                {investment.missingPartsToBuy.length > 0 && (
                  <div>
                    <span className="text-orange-400">To buy:</span>
                    <span className="text-gray-300 ml-1">{investment.missingPartsToBuy.map(part => part.split(' ').pop()).join(', ')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // Original simple comparison for immediate strategies
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="text-gray-400">Individual Parts</div>
                <div className="text-white font-medium">
                  {individualValue > 0 ? `${individualValue.toFixed(0)}p` : 'No data'}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-gray-400">Complete Set</div>
                <div className="text-white font-medium">
                  {completeSetValue > 0 ? `${completeSetValue.toFixed(0)}p` : 'No data'}
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-400">
              {strategy.description}
            </div>

            {/* Action Buttons for immediate strategies */}
            <div className="flex gap-2">
              {progress.completeSetBuyerUsername && (
                <button
                  onClick={() => {
                    const message = `/w ${progress.completeSetBuyerUsername} Hi! I want to sell: "${progress.set.name} Set" for ${progress.completeSetPrice} platinum. (warframe.market)`;
                    handleClipboardCopy(message, `set-${progress.set.id}`);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded text-xs text-blue-400 hover:bg-blue-600/30 transition-colors ${
                    copiedItems.has(`set-${progress.set.id}`) ? 'text-green-400' : ''
                  }`}
                >
                  {copiedItems.has(`set-${progress.set.id}`) ? <Check size={12} /> : <MessageCircle size={12} />}
                  Message {progress.completeSetBuyerUsername}
                </button>
              )}

              <button
                onClick={() => {
                  const marketUrl = `https://warframe.market/items/${progress.set.name.toLowerCase().replace(/\s+/g, '_')}_set`;
                  window.open(marketUrl, '_blank', 'noopener,noreferrer');
                }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-600/20 border border-gray-500/30 rounded text-xs text-gray-400 hover:bg-gray-600/30 transition-colors"
              >
                <ExternalLink size={12} />
                View Market
              </button>
            </div>

            {progress.completeSetBuyerUsername && progress.completeSetBuyerQuantity && progress.completeSetBuyerQuantity > 0 && (
              <div className="text-xs text-gray-400">
                Top buyer wants {progress.completeSetBuyerQuantity}x sets
              </div>
            )}
          </div>
        )}
      </div>
    );
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
                {totalSets} set{totalSets !== 1 ? 's' : ''} • {buildableSets} buildable • {inProgressSets} planned
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center justify-end gap-1 mb-1">
              <Trophy size={14} className="text-green-400" />
              <span className="text-lg font-bold text-green-400">{buildableSets}</span>
            </div>
            <div className="flex items-center justify-end gap-1">
              <Star size={10} className="text-purple-400" />
              <span className="text-xs text-purple-400">{builtSets}</span>
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

        {/* Buildable Sets */}
        <button
          onClick={() => setActiveTab('buildable')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeTab === 'buildable'
              ? 'bg-green-900/50 border-green-500/50 text-green-400 ring-1 ring-green-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Trophy size={16} />
          <span>Buildable</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'buildable' ? 'bg-green-800/50 text-green-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {recommendations.buildable.length}
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
          <span>Buildable with Relics</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'relics'
              ? 'bg-yellow-800/50 text-yellow-300'
              : potentiallyBuildable.length > 0
                ? 'bg-gray-800/50 text-gray-400'
                : 'bg-gray-800/50 text-gray-500'
          }`}>
            {potentiallyBuildable.length}
          </span>
        </button>

        {/* Planned Sets */}
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
            {setProgress.filter(p => plannedSets.get(p.set.id)?.planned || false).length}
          </span>
        </button>

        {/* Vaulted Sets */}
        <button
          onClick={() => setActiveTab('vaulted')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeTab === 'vaulted'
              ? 'bg-red-900/50 border-red-500/50 text-red-400 ring-1 ring-red-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Zap size={16} />
          <span>Vaulted</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'vaulted' ? 'bg-red-800/50 text-red-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {setProgress.filter(p => p.set.vaulted).length}
          </span>
        </button>

        {/* Warframes */}
        <button
          onClick={() => setActiveTab('warframes')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeTab === 'warframes'
              ? 'bg-blue-900/50 border-blue-500/50 text-blue-400 ring-1 ring-blue-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Shield size={16} />
          <span>Warframes</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'warframes' ? 'bg-blue-800/50 text-blue-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {setProgress.filter(p => p.set.type === 'Warframe').length}
          </span>
        </button>

        {/* Weapons */}
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

        {/* Companions & Others */}
        <button
          onClick={() => setActiveTab('companions')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeTab === 'companions'
              ? 'bg-pink-900/50 border-pink-500/50 text-pink-400 ring-1 ring-pink-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Heart size={16} />
          <span>Companions</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'companions' ? 'bg-pink-800/50 text-pink-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {setProgress.filter(p => ['Sentinel', 'Archwing', 'Companion'].includes(p.set.type)).length}
          </span>
        </button>

        {/* Owned Sets */}
        <button
          onClick={() => setActiveTab('built')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeTab === 'built'
              ? 'bg-purple-900/50 border-purple-500/50 text-purple-400 ring-1 ring-purple-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Star size={16} />
          <span>Owned</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'built' ? 'bg-purple-800/50 text-purple-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {setProgress.filter(p => p.ismastered).length}
          </span>
        </button>
      </div>

      {/* Sets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-6 pb-6">
        {sortedSets.map((progress) => (
          <div
            key={progress.set.id}
            className={`bg-gray-900/50 rounded-lg border p-4 transition-all hover:bg-gray-800/50 ${(() => {
              const currentState = getSetState(progress);
              if (currentState === 'owned') {
                return 'border-purple-500/50 ring-1 ring-purple-500/20';
              } else if (currentState === 'planned') {
                return 'border-yellow-500/50 ring-1 ring-yellow-500/20';
              } else if (progress.canBuild) {
                return 'border-green-500/50 ring-1 ring-green-500/20';
              } else {
                return 'border-gray-700';
              }
            })()}`}
          >
            {/* Set Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={getPrimeSetImageUrl(progress.set.name)}
                    alt={progress.set.name}
                    className="w-10 h-10 rounded-lg bg-gray-800/50 object-cover border border-gray-600/50"
                    onError={(e) => {
                      // Hide image if it fails to load
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {/* Status Symbol on Image */}
                  <div className="absolute -top-1 -right-1">
                    {(() => {
                      const currentState = getSetState(progress);
                      const isPriority = plannedSets.get(progress.set.id)?.isPriority || false;

                      if (currentState === 'owned') {
                        return (
                          <div className="bg-purple-600 text-white rounded-full p-1 border border-purple-400 shadow-lg">
                            <Star size={10} />
                          </div>
                        );
                      } else if (currentState === 'planned') {
                        return (
                          <div className={`${isPriority ? 'bg-red-600' : 'bg-yellow-600'} text-white rounded-full p-1 border ${isPriority ? 'border-red-400' : 'border-yellow-400'} shadow-lg`}>
                            <BookOpen size={10} />
                          </div>
                        );
                      } else {
                        return (
                          <div className="bg-gray-600 text-white rounded-full p-1 border border-gray-400 shadow-lg">
                            <Trophy size={10} />
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <h3 className="font-semibold text-white text-sm">{progress.set.name}</h3>
                    {plannedSets.get(progress.set.id)?.isPriority && (
                      <span className="text-red-400 text-xs">⭐️</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 text-xs rounded border bg-gray-800/30 text-gray-400 border-gray-600/30">
                      {progress.set.type.toUpperCase()}
                    </span>
                    {progress.set.vaulted && (
                      <span className="px-1.5 py-0.5 bg-gray-800/30 text-gray-400 text-xs rounded border border-gray-600/30">
                        VAULTED
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* Actions for each tab */}
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
                    size={14}
                    className={progress.setMarketStatus === 'loading' ? 'animate-spin' : ''}
                  />
                </button>

                {/* Priority toggle for planned sets */}
                {getSetState(progress) === 'planned' && (
                  <button
                    onClick={() => handleStateChange(progress, 'planned', !plannedSets.get(progress.set.id)?.isPriority)}
                    className={`p-1 rounded-full transition-colors ${
                      plannedSets.get(progress.set.id)?.isPriority
                        ? 'bg-red-700/30 text-red-400 border border-red-500/30'
                        : 'bg-gray-800/30 text-gray-400 border border-gray-600/30 hover:text-red-300'
                    }`}
                    title={plannedSets.get(progress.set.id)?.isPriority ? "Remove from top candidates" : "Mark as top candidate"}
                  >
                    <Star size={14} />
                  </button>
                )}
                {/* Remove for built tab */}
                {activeTab === 'built' && (
                  <button
                    onClick={() => handleStateChange(progress, 'buildable')}
                    className="p-1 rounded transition-colors text-gray-500 hover:text-red-400"
                    title="Remove from built (if marked by mistake)"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Progress</span>
                <span>{Math.round(progress.completionPercentage)}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${getProgressColor(progress.completionPercentage)}`}
                  style={{ width: `${progress.completionPercentage}%` }}
                />
              </div>
            </div>

            {/* Parts Status */}
            <div className="space-y-2 mb-4">
              <div className="text-xs text-gray-400">
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
                          {getRelicSourceText(part.name, isOwned, isObtainableFromRelics)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* NEW: Trading Strategy Analysis */}
            <TradingStrategyCard progress={progress} />

            {/* Simple 3-State Toggle - More Compact */}
            <div className="border-t border-gray-700/50 pt-3">
              <div className="flex gap-1">
                {(['buildable', 'planned', 'owned'] as const).map((state) => {
                  const currentState = getSetState(progress);
                  const isActive = currentState === state;
                  const isPriority = plannedSets.get(progress.set.id)?.isPriority || false;

                  const stateConfig = {
                    buildable: {
                      label: 'Buildable',
                      icon: <Trophy size={10} />,
                      color: 'text-gray-300',
                      bgColor: 'bg-gray-700/20 border-gray-700/30',
                      activeBgColor: 'bg-gray-400/30 border-gray-400/50'
                    },
                    planned: {
                      label: isPriority ? 'Top Candidate' : 'Planned',
                      icon: <BookOpen size={10} />,
                      color: isPriority ? 'text-red-400' : 'text-yellow-400',
                      bgColor: isPriority ? 'bg-red-600/20 border-red-600/30' : 'bg-yellow-600/20 border-yellow-600/30',
                      activeBgColor: isPriority ? 'bg-red-600/40 border-red-500/50' : 'bg-yellow-600/40 border-yellow-500/50'
                    },
                    owned: {
                      label: 'Owned',
                      icon: <Star size={10} />,
                      color: 'text-purple-400',
                      bgColor: 'bg-purple-600/20 border-purple-600/30',
                      activeBgColor: 'bg-purple-600/40 border-purple-500/50'
                    }
                  };

                  const config = stateConfig[state];

                  // Keep existing isPriority if staying in planned state, otherwise false
                  const nextPriority = state === 'planned' && currentState === 'planned'
                    ? isPriority
                    : state === 'planned' ? false : false;

                  return (
                    <button
                      key={state}
                      onClick={() => handleStateChange(progress, state, nextPriority)}
                      className={`flex-1 px-2 py-1.5 text-xs border rounded transition-colors ${
                        isActive
                          ? `${config.activeBgColor} ${config.color}`
                          : `${config.bgColor} text-gray-400 hover:bg-opacity-30`
                      }`}
                      title={`Mark as ${config.label.toLowerCase()}`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {config.icon}
                        <span>{config.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {sortedSets.length === 0 && (
        <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg mx-6 mb-6">
          <div className="text-gray-400 mb-2">
            {activeTab === 'buildable' && 'No buildable sets yet'}
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
            {activeTab === 'buildable' && 'Collect more prime parts to complete sets'}
            {activeTab === 'relics' && 'Open relics to get missing parts for sets'}
            {activeTab === 'progress' && 'Mark sets as "Planned" to track your build progress'}
            {activeTab === 'vaulted' && 'Vaulted sets are no longer obtainable from relics'}
            {activeTab === 'warframes' && 'Warframe prime sets include chassis, neuroptics, and systems'}
            {activeTab === 'weapons' && 'Weapon prime sets include barrels, receivers, and other parts'}
            {activeTab === 'companions' && 'Companion sets include sentinels, archwings, and kubrow collars'}
            {activeTab === 'all' && 'Prime parts will be analyzed for set completion'}
            {activeTab === 'built' && 'Mark completed sets as "Owned"'}
          </div>
        </div>
      )}
        </div>
      )}

      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 border-t-0 rounded-b-xl text-center p-3 hover:bg-gray-800/50 transition-colors"
        >
          <p className="text-gray-400 text-sm hover:text-gray-300 transition-colors">
            Tap to view {totalSets} prime sets • {buildableSets} buildable • {inProgressSets} planned
          </p>
        </button>
      )}
    </div>
  );
};

export default PrimeSetsSection;