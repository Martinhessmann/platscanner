// Purpose: Prime Set Management Service - Detects buildable sets from inventory and tracks mastery status
// Author: Assistant
// Last Updated: 2025-01-28

import { DetectedItem, VoidRelic } from '../types';
import { cloudSyncService } from './cloudSyncService';

export interface PrimePart {
  name: string;
  partType: 'Blueprint' | 'Systems' | 'Chassis' | 'Neuroptics' | 'Barrel' | 'Receiver' | 'Stock' | 'String' | 'Grip' | 'Blade' | 'Handle' | 'Link' | 'Gauntlet' | 'Upper Limb' | 'Lower Limb' | 'Carapace' | 'Cerebrum' | 'Pouch' | 'Stars' | 'Boot' | 'Chain' | 'Disc' | 'Guard' | 'Hilt' | 'Head' | 'Ornament' | 'Harness' | 'Wings' | 'Band' | 'Buckle' | 'Blades';
  ducats: number;
  vaulted: boolean;
  itemCount?: number; // Number of this part required, defaults to 1
}

export interface PrimeSet {
  id: string;
  name: string;
  type: 'Warframe' | 'Primary' | 'Secondary' | 'Melee' | 'Sentinel' | 'Archwing' | 'Companion';
  category: 'Assault Rifle' | 'Bow' | 'Shotgun' | 'Sniper' | 'Pistol' | 'Throwing Knife' | 'Sword' | 'Polearm' | 'Nikana' | 'Warframe' | 'Sentinel' | 'Archwing' | 'Companion';
  requiredParts: PrimePart[];
  vaulted: boolean;
  masteryRank: number;
  releaseDate: string;
}

export interface SetProgress {
  set: PrimeSet;
  ownedParts: string[];
  missingParts: string[];
  obtainableFromRelics: string[]; // Parts available in owned relics
  canBuild: boolean;
  totalCost: number;
  missingCost: number;
  completionPercentage: number;
  ismastered: boolean;
  // Complete Set Market Analysis
  completeSetPrice?: number;
  completeSetVolume?: number;
  completeSetAverage?: number;
  completeSetBuyerUsername?: string;
  completeSetBuyerQuantity?: number;
  individualPartsValue?: number;
  profitDifference?: number;
  recommendedStrategy?: 'SELL_PARTS' | 'BUILD_AND_SELL' | 'KEEP_FOR_MASTERY' | 'OPEN_RELICS' | 'BUY_MISSING' | 'HYBRID_STRATEGY' | 'INSUFFICIENT_DATA';
  setMarketStatus?: 'loaded' | 'loading' | 'error';
  setMarketError?: string;
  // NEW: Investment Analysis
  investmentAnalysis?: {
    currentValue: number;
    potentialValue: number;
    missingPartsFromRelics: string[];
    missingPartsToBuy: string[];
    relicInvestmentCost: number; // void traces equivalent in platinum
    buyInvestmentCost: number; // platinum cost to buy missing parts
    totalInvestmentCost: number;
    expectedProfit: number;
    roiPercentage: number;
    recommendedAction: 'open_relics' | 'buy_parts' | 'hybrid' | 'not_profitable';
  };
}

// JSON interface for the imported data
interface PrimeSetJson {
  name: string;
  image: string;
  category: string;
  components: {
    name: string;
    count: number;
  }[];
}

// Ducats mapping for different part types (estimated based on rarity)
const DUCATS_MAP: Record<string, number> = {
  'Blueprint': 25,
  'Systems': 45,
  'Chassis': 45,
  'Neuroptics': 100,
  'Barrel': 45,
  'Receiver': 100,
  'Stock': 45,
  'String': 45,
  'Grip': 45,
  'Blade': 45,
  'Handle': 45,
  'Link': 15,
  'Gauntlet': 45,
  'Upper Limb': 100,
  'Lower Limb': 45,
  'Carapace': 45,
  'Cerebrum': 45,
  'Pouch': 45,
  'Stars': 45,
  'Boot': 45,
  'Chain': 45,
  'Disc': 100,
  'Guard': 45,
  'Hilt': 100,
  'Head': 100,
  'Ornament': 45,
  'Harness': 45,
  'Wings': 45,
  'Band': 45,
  'Buckle': 45,
  'Blades': 45
};

// Map JSON categories to proper types
const mapCategoryToType = (category: string): PrimeSet['type'] => {
  switch (category.toLowerCase()) {
    case 'warframe':
      return 'Warframe';
    case 'primary':
      return 'Primary';
    case 'secondary':
      return 'Secondary';
    case 'melee':
      return 'Melee';
    case 'sentinel':
      return 'Sentinel';
    case 'archwing':
      return 'Archwing';
    case 'companion':
      return 'Companion';
    default:
      return 'Primary'; // Default fallback
  }
};

// Determine if a prime set is vaulted (simplified logic - newer releases are typically not vaulted)
const isVaulted = (name: string): boolean => {
  // Most recent releases that are typically not vaulted
  const currentUnvaulted = [
    'Gara Prime', 'Nidus Prime', 'Harrow Prime', 'Khora Prime', 'Garuda Prime',
    'Revenant Prime', 'Baruuk Prime', 'Hildryn Prime', 'Wisp Prime', 'Gauss Prime',
    'Atlas Prime', 'Ivara Prime', 'Titania Prime', 'Nezha Prime', 'Inaros Prime',
    'Octavia Prime', 'Grendel Prime', 'Sevagoth Prime', 'Nyx Prime', 'Valkyr Prime',
    'Protea Prime', 'Xaku Prime', 'Yareli Prime', 'Lavos Prime'
  ];

  return !currentUnvaulted.some(unvaulted => name.includes(unvaulted.split(' ')[0]));
};

// Get estimated mastery rank requirement
const getMasteryRank = (type: PrimeSet['type']): number => {
  switch (type) {
    case 'Warframe':
      return 0;
    case 'Primary':
      return Math.floor(Math.random() * 8) + 2; // 2-10
    case 'Secondary':
      return Math.floor(Math.random() * 6) + 2; // 2-8
    case 'Melee':
      return Math.floor(Math.random() * 6) + 2; // 2-8
    case 'Sentinel':
    case 'Companion':
      return 0;
    case 'Archwing':
      return 1;
    default:
      return 0;
  }
};

// Transform JSON data to PrimeSet interface
const transformJsonToPrimeSet = (jsonSet: PrimeSetJson): PrimeSet => {
  const id = jsonSet.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const type = mapCategoryToType(jsonSet.category);

  const requiredParts: PrimePart[] = jsonSet.components.map(component => ({
    name: `${jsonSet.name} ${component.name}`,
    partType: component.name as PrimePart['partType'],
    ducats: DUCATS_MAP[component.name] || 45, // Default to 45 ducats
    vaulted: isVaulted(jsonSet.name),
    itemCount: component.count
  }));

  return {
    id,
    name: jsonSet.name,
    type,
    category: type as any, // Simplified mapping
    requiredParts,
    vaulted: isVaulted(jsonSet.name),
    masteryRank: getMasteryRank(type),
    releaseDate: '2024-01-01' // Placeholder date
  };
};

// Use centralized static data loading
import { loadPrimeSetsData } from './staticDataService';
import { fetchBatchPrimeSetMarketData, fetchPrimeSetMarketData } from './warframeMarketService';

const loadPrimeSets = async (): Promise<PrimeSet[]> => {
  try {
    const jsonData: PrimeSetJson[] = await loadPrimeSetsData() as any;
    return jsonData.map(transformJsonToPrimeSet);
  } catch (error) {
    console.error('Failed to load prime sets:', error);
    return [];
  }
};

// Mastery tracking storage key
const MASTERY_STORAGE_KEY = 'platscanner_mastery';

// NEW: Prime Sets analysis cache storage
const PRIME_SETS_CACHE_KEY = 'platscanner_prime_sets_cache';
const PRIME_SETS_LAST_REFRESH_KEY = 'platscanner_prime_sets_last_refresh';

// NEW: Cache management for Prime Sets analysis results
export const getPrimeSetsCache = (): SetProgress[] => {
  try {
    const stored = localStorage.getItem(PRIME_SETS_CACHE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load prime sets cache:', error);
    return [];
  }
};

export const setPrimeSetsCache = (setProgress: SetProgress[]): void => {
  try {
    localStorage.setItem(PRIME_SETS_CACHE_KEY, JSON.stringify(setProgress));
    localStorage.setItem(PRIME_SETS_LAST_REFRESH_KEY, new Date().toISOString());

    // Notify cloud sync of local data modification
    cloudSyncService.onLocalDataModified().catch(error => {
      console.error('Failed to sync prime sets cache to cloud:', error);
    });
  } catch (error) {
    console.error('Failed to save prime sets cache:', error);
  }
};

export const getPrimeSetsLastRefresh = (): Date | null => {
  try {
    const stored = localStorage.getItem(PRIME_SETS_LAST_REFRESH_KEY);
    return stored ? new Date(stored) : null;
  } catch (error) {
    console.error('Failed to load prime sets last refresh:', error);
    return null;
  }
};

export const clearPrimeSetsCache = (): void => {
  try {
    localStorage.removeItem(PRIME_SETS_CACHE_KEY);
    localStorage.removeItem(PRIME_SETS_LAST_REFRESH_KEY);
  } catch (error) {
    console.error('Failed to clear prime sets cache:', error);
  }
};

// Get mastered sets from localStorage
export const getMasteredSets = (): string[] => {
  try {
    const stored = localStorage.getItem(MASTERY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load mastered sets:', error);
    return [];
  }
};

// Update mastered sets in localStorage
export const setMasteredSets = (masteredIds: string[]): void => {
  try {
    localStorage.setItem(MASTERY_STORAGE_KEY, JSON.stringify(masteredIds));

    // Notify cloud sync of local data modification
    cloudSyncService.onLocalDataModified().catch(error => {
      console.error('Failed to sync mastery changes to cloud:', error);
    });
  } catch (error) {
    console.error('Failed to save mastered sets:', error);
  }
};

// Toggle mastery status for a set
export const toggleSetMastery = (setId: string): void => {
  const current = getMasteredSets();
  const updated = current.includes(setId)
    ? current.filter(id => id !== setId)
    : [...current, setId];
  setMasteredSets(updated);
};

// Check if user owns a specific part
const ownsItem = (itemName: string, requiredCount: number, inventory: DetectedItem[]): boolean => {
  const lowerItemName = itemName.toLowerCase();
  const inventoryItem = inventory.find(item => {
    const lowerInventoryItemName = item.name.toLowerCase();
    return (lowerInventoryItemName === lowerItemName || lowerInventoryItemName === `${lowerItemName} blueprint`);
  });

  return inventoryItem ? (inventoryItem.quantity || 1) >= requiredCount : false;
};

// Check if user can obtain a part from owned relics
const canObtainFromRelics = (partName: string, relicsInventory: VoidRelic[]): boolean => {
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

      // FIXED: More precise part type matching - require item name to match too
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

        // Part analysis complete

  return matchingRelics.length > 0;
};

// Calculate cost for missing parts (placeholder - would need market data)
const calculateMissingCost = (missingParts: string[]): number => {
  // This would need to fetch market prices for missing parts
  // For now, return a placeholder value
  return missingParts.length * 50; // Placeholder: 50p per missing part
};

// NEW: Calculate the total market value of owned individual parts
const calculateIndividualPartsValue = (
  ownedParts: string[],
  primePartsInventory: DetectedItem[]
): number => {
  let totalValue = 0;

  ownedParts.forEach(partName => {
    const inventoryItem = primePartsInventory.find(item => {
      const lowerItemName = item.name.toLowerCase();
      const lowerPartName = partName.toLowerCase();
      return lowerItemName === lowerPartName || lowerItemName === `${lowerPartName} blueprint`;
    });

    if (inventoryItem && inventoryItem.price && inventoryItem.price > 0) {
      const quantity = inventoryItem.quantity || 1;
      totalValue += inventoryItem.price * quantity;
    }
  });

  return totalValue;
};

// NEW: Calculate investment analysis for completing sets
const calculateInvestmentAnalysis = (
  setProgress: SetProgress,
  primePartsInventory: DetectedItem[],
  relicsInventory: VoidRelic[]
): SetProgress['investmentAnalysis'] => {
  const currentValue = setProgress.individualPartsValue || 0;
  const potentialValue = setProgress.completeSetPrice || 0;

  // If no complete set price available, can't do investment analysis
  if (potentialValue === 0) {
    return undefined;
  }

  // Separate missing parts into those obtainable from relics vs those to buy
  const missingPartsFromRelics = setProgress.obtainableFromRelics.filter(part =>
    !setProgress.ownedParts.includes(part)
  );

  const missingPartsToBuy = setProgress.missingParts.filter(part =>
    !setProgress.obtainableFromRelics.includes(part)
  );

  // Calculate cost to buy missing parts from market
  let buyInvestmentCost = 0;
  missingPartsToBuy.forEach(partName => {
    // Try to find market price for this part in inventory (even if not owned)
    const partPrice = getEstimatedPartPrice(partName, primePartsInventory);
    buyInvestmentCost += partPrice;
  });

  // Calculate void trace cost for relic opening (estimated)
  // Assume average 75 void traces per missing part from relics
  // 1 void trace ≈ 0.3 platinum (rough market equivalent)
  const avgVoidTracesPerPart = 75;
  const voidTraceToplatinumRatio = 0.3;
  const relicInvestmentCost = missingPartsFromRelics.length * avgVoidTracesPerPart * voidTraceToplatinumRatio;

  const totalInvestmentCost = buyInvestmentCost + relicInvestmentCost;
  const expectedProfit = potentialValue - currentValue - totalInvestmentCost;
  const roiPercentage = totalInvestmentCost > 0 ? (expectedProfit / totalInvestmentCost) * 100 : 0;

  // Determine recommended action
  let recommendedAction: 'open_relics' | 'buy_parts' | 'hybrid' | 'not_profitable';

  if (expectedProfit <= 5) { // Not worth it for small gains
    recommendedAction = 'not_profitable';
  } else if (missingPartsToBuy.length === 0 && missingPartsFromRelics.length > 0) {
    recommendedAction = 'open_relics';
  } else if (missingPartsFromRelics.length === 0 && missingPartsToBuy.length > 0) {
    recommendedAction = 'buy_parts';
  } else if (missingPartsFromRelics.length > 0 && missingPartsToBuy.length > 0) {
    recommendedAction = 'hybrid';
  } else {
    recommendedAction = 'not_profitable';
  }

  return {
    currentValue,
    potentialValue,
    missingPartsFromRelics,
    missingPartsToBuy,
    relicInvestmentCost,
    buyInvestmentCost,
    totalInvestmentCost,
    expectedProfit,
    roiPercentage,
    recommendedAction
  };
};

// NEW: Get estimated price for a part (from existing inventory data)
const getEstimatedPartPrice = (partName: string, primePartsInventory: DetectedItem[]): number => {
  // Try to find exact match first
  const exactMatch = primePartsInventory.find(item => {
    const lowerItemName = item.name.toLowerCase();
    const lowerPartName = partName.toLowerCase();
    return lowerItemName === lowerPartName || lowerItemName === `${lowerPartName} blueprint`;
  });

  if (exactMatch && exactMatch.price && exactMatch.price > 0) {
    return exactMatch.price;
  }

  // If no exact match, try to estimate based on part type
  const partType = partName.split(' ').pop()?.toLowerCase();
  const similarParts = primePartsInventory.filter(item =>
    item.name.toLowerCase().includes(partType || '') && item.price && item.price > 0
  );

  if (similarParts.length > 0) {
    // Return average price of similar parts
    const avgPrice = similarParts.reduce((sum, item) => sum + (item.price || 0), 0) / similarParts.length;
    return Math.round(avgPrice);
  }

  // Fallback to estimated prices based on rarity
  const fallbackPrices: Record<string, number> = {
    'blueprint': 15,
    'systems': 25,
    'chassis': 25,
    'neuroptics': 45,
    'barrel': 25,
    'receiver': 45,
    'stock': 20,
    'string': 20,
    'grip': 20,
    'blade': 20,
    'handle': 20,
    'link': 10,
    'gauntlet': 25,
    'carapace': 25,
    'cerebrum': 25
  };

  return fallbackPrices[partType || ''] || 20; // Default 20p
};

// NEW: Enhanced strategy determination with investment analysis
const determineOptimalStrategyWithInvestment = (
  setProgress: SetProgress,
  individualPartsValue: number,
  completeSetPrice: number,
  investmentAnalysis?: SetProgress['investmentAnalysis']
): SetProgress['recommendedStrategy'] => {
  // If set is already mastered, no recommendation needed
  if (setProgress.ismastered) {
    return 'KEEP_FOR_MASTERY';
  }

  // If no market data available, can't make recommendation
  if (completeSetPrice === 0 && individualPartsValue === 0) {
    return 'INSUFFICIENT_DATA';
  }

  // If we have investment analysis and it shows good ROI
  if (investmentAnalysis && investmentAnalysis.expectedProfit > 10) {
    switch (investmentAnalysis.recommendedAction) {
      case 'open_relics':
        return 'OPEN_RELICS';
      case 'buy_parts':
        return 'BUY_MISSING';
      case 'hybrid':
        return 'HYBRID_STRATEGY';
    }
  }

  // Fall back to original logic for immediate actions
  if (!setProgress.canBuild) {
    return individualPartsValue > 0 ? 'SELL_PARTS' : 'INSUFFICIENT_DATA';
  }

  if (completeSetPrice === 0) {
    return 'SELL_PARTS';
  }
  if (individualPartsValue === 0) {
    return 'BUILD_AND_SELL';
  }

  // Compare profit potential (with 5% threshold to account for market volatility)
  const profitDifference = completeSetPrice - individualPartsValue;
  const threshold = Math.max(individualPartsValue * 0.05, 5);

  if (profitDifference > threshold) {
    return 'BUILD_AND_SELL';
  } else if (profitDifference < -threshold) {
    return 'SELL_PARTS';
  } else {
    return 'SELL_PARTS';
  }
};

// NEW: Enhanced analyze function with complete set market data
export const analyzeSetProgressWithMarketData = async (
  primePartsInventory: DetectedItem[],
  relicsInventory: VoidRelic[] = [],
  includeMarketData: boolean = true,
  forceRefresh: boolean = false
): Promise<SetProgress[]> => {
  // Check for cached data first (unless force refresh requested)
  if (!forceRefresh && includeMarketData) {
    const cachedProgress = getPrimeSetsCache();
    if (cachedProgress.length > 0) {
      console.log(`📦 [Prime Sets] Using cached analysis data (${cachedProgress.length} sets)`);
      return cachedProgress;
    }
  }

  const primeSets = await loadPrimeSets();
  const masteredSets = getMasteredSets();

  // First, get basic set progress
  const setProgress: SetProgress[] = primeSets.map(set => {
    const ownedParts: string[] = [];
    const missingParts: string[] = [];
    const obtainableFromRelics: string[] = [];
    let totalCost = 0;

    // Check each required part
    set.requiredParts.forEach(part => {
      const requiredCount = part.itemCount || 1;
      if (ownsItem(part.name, requiredCount, primePartsInventory)) {
        ownedParts.push(part.name);
      } else {
        missingParts.push(part.name);
        // Check if this missing part can be obtained from owned relics
        if (canObtainFromRelics(part.name, relicsInventory)) {
          obtainableFromRelics.push(part.name);
        }
      }
      totalCost += 50; // Placeholder cost per part
    });

    const canBuild = missingParts.length === 0;
    const completionPercentage = (ownedParts.length / set.requiredParts.length) * 100;
    const missingCost = calculateMissingCost(missingParts);
    const ismastered = masteredSets.includes(set.id);

    return {
      set,
      ownedParts,
      missingParts,
      obtainableFromRelics,
      canBuild,
      totalCost,
      missingCost,
      completionPercentage,
      ismastered,
      setMarketStatus: 'loading' as const
    };
  });

  // If market data not requested, return basic progress
  if (!includeMarketData) {
    return setProgress;
  }

  // Fetch complete set market data for sets that have owned parts or can be built
  const setsNeedingMarketData = setProgress.filter(progress =>
    progress.ownedParts.length > 0 || progress.canBuild
  );

  if (setsNeedingMarketData.length > 0) {
    console.log(`🎯 [Market Analysis] Fetching market data for ${setsNeedingMarketData.length} sets with owned parts`);

    try {
      const setNames = setsNeedingMarketData.map(progress => progress.set.name);
      const marketData = await fetchBatchPrimeSetMarketData(setNames);

      // Enhance progress with market data
      setsNeedingMarketData.forEach((progress, index) => {
        const setMarketData = marketData[index];
        const individualPartsValue = calculateIndividualPartsValue(progress.ownedParts, primePartsInventory);
        const completeSetPrice = setMarketData.price;
        const profitDifference = completeSetPrice - individualPartsValue;

        // Update progress with market analysis
        progress.completeSetPrice = setMarketData.price;
        progress.completeSetVolume = setMarketData.volume;
        progress.completeSetAverage = setMarketData.average;
        progress.completeSetBuyerUsername = setMarketData.buyerUsername || undefined;
        progress.completeSetBuyerQuantity = setMarketData.buyerQuantity;
        progress.individualPartsValue = individualPartsValue;
        progress.profitDifference = profitDifference;

        // Calculate investment analysis
        const investmentAnalysis = calculateInvestmentAnalysis(progress, primePartsInventory, relicsInventory);
        progress.investmentAnalysis = investmentAnalysis;

        progress.recommendedStrategy = determineOptimalStrategyWithInvestment(progress, individualPartsValue, completeSetPrice, investmentAnalysis);
        progress.setMarketStatus = 'loaded' as const;
        progress.setMarketError = setMarketData.error;

        console.log(`🎯 [Market Analysis] ${progress.set.name}: Parts=${individualPartsValue}p, Set=${completeSetPrice}p, Strategy=${progress.recommendedStrategy}`);
      });

    } catch (error) {
      console.error('🎯 [Market Analysis] Failed to fetch complete set market data:', error);

      // Mark sets as error state
      setsNeedingMarketData.forEach(progress => {
        progress.setMarketStatus = 'error' as const;
        progress.setMarketError = error instanceof Error ? error.message : 'Failed to fetch market data';
      });
    }
  }

  // Cache the results if market data was included
  if (includeMarketData) {
    setPrimeSetsCache(setProgress);
    console.log(`💾 [Prime Sets] Cached analysis data (${setProgress.length} sets)`);
  }

  return setProgress;
};

// BACKWARD COMPATIBILITY: Keep original function for existing code
export const analyzeSetProgress = async (
  primePartsInventory: DetectedItem[],
  relicsInventory: VoidRelic[] = []
): Promise<SetProgress[]> => {
  return analyzeSetProgressWithMarketData(primePartsInventory, relicsInventory, false);
};

// Get sets that can be built immediately
export const getBuildableSets = async (
  primePartsInventory: DetectedItem[],
  relicsInventory: VoidRelic[] = []
): Promise<SetProgress[]> => {
  const progress = await analyzeSetProgressWithMarketData(primePartsInventory, relicsInventory);
  return progress
    .filter(progress => progress.canBuild && !progress.ismastered)
    .sort((a, b) => b.completionPercentage - a.completionPercentage);
};

// Get sets with highest completion percentage
export const getNearCompleteSets = async (
  primePartsInventory: DetectedItem[],
  relicsInventory: VoidRelic[] = [],
  minCompletion: number = 50
): Promise<SetProgress[]> => {
  const progress = await analyzeSetProgressWithMarketData(primePartsInventory, relicsInventory);
  return progress
    .filter(progress =>
      !progress.canBuild &&
      !progress.ismastered &&
      progress.completionPercentage >= minCompletion
    )
    .sort((a, b) => b.completionPercentage - a.completionPercentage);
};

// Get priority recommendations
export const getSetRecommendations = async (
  primePartsInventory: DetectedItem[],
  relicsInventory: VoidRelic[] = []
): Promise<{
  buildable: SetProgress[];
  nearComplete: SetProgress[];
  highValue: SetProgress[];
}> => {
  const allProgress = await analyzeSetProgressWithMarketData(primePartsInventory, relicsInventory);

  const buildable = allProgress
    .filter(p => p.canBuild && !p.ismastered)
    .sort((a, b) => b.set.masteryRank - a.set.masteryRank);

  const nearComplete = allProgress
    .filter(p => !p.canBuild && !p.ismastered && p.completionPercentage >= 75)
    .sort((a, b) => b.completionPercentage - a.completionPercentage);

  const highValue = allProgress
    .filter(p => !p.ismastered && p.missingCost > 0)
    .sort((a, b) => a.missingCost - b.missingCost)
    .slice(0, 5);

  return { buildable, nearComplete, highValue };
};

// NEW: Refresh Prime Sets market data (force refresh)
export const refreshPrimeSetsMarketData = async (
  primePartsInventory: DetectedItem[],
  relicsInventory: VoidRelic[] = []
): Promise<SetProgress[]> => {
  console.log('🔄 [Prime Sets] Force refreshing market data...');

  // Clear cache first
  clearPrimeSetsCache();

  // Force fetch new data
  return analyzeSetProgressWithMarketData(primePartsInventory, relicsInventory, true, true);
};

// NEW: Refresh individual Prime Set market data
export const refreshIndividualSetMarketData = async (
  setName: string,
  primePartsInventory: DetectedItem[],
  relicsInventory: VoidRelic[] = []
): Promise<SetProgress | null> => {
  console.log(`🔄 [Prime Set] Force refreshing market data for: ${setName}`);

  try {
    const primeSets = await loadPrimeSets();
    const masteredSets = getMasteredSets();

    // Find the specific set
    const targetSet = primeSets.find(set => set.name === setName);
    if (!targetSet) {
      console.error(`🔄 [Prime Set] Set not found: ${setName}`);
      return null;
    }

    // Calculate basic progress for this set
    const ownedParts: string[] = [];
    const missingParts: string[] = [];
    const obtainableFromRelics: string[] = [];
    let totalCost = 0;

    targetSet.requiredParts.forEach(part => {
      const requiredCount = part.itemCount || 1;
      if (ownsItem(part.name, requiredCount, primePartsInventory)) {
        ownedParts.push(part.name);
      } else {
        missingParts.push(part.name);
        if (canObtainFromRelics(part.name, relicsInventory)) {
          obtainableFromRelics.push(part.name);
        }
      }
      totalCost += 50; // Placeholder cost per part
    });

    const canBuild = missingParts.length === 0;
    const completionPercentage = (ownedParts.length / targetSet.requiredParts.length) * 100;
    const missingCost = calculateMissingCost(missingParts);
    const ismastered = masteredSets.includes(targetSet.id);

    const setProgress: SetProgress = {
      set: targetSet,
      ownedParts,
      missingParts,
      obtainableFromRelics,
      canBuild,
      totalCost,
      missingCost,
      completionPercentage,
      ismastered,
      setMarketStatus: 'loading' as const
    };

    // Fetch market data for this specific set if it has owned parts or can be built
    if (ownedParts.length > 0 || canBuild) {
      try {
        const setMarketData = await fetchPrimeSetMarketData(setName);
        const individualPartsValue = calculateIndividualPartsValue(ownedParts, primePartsInventory);
        const completeSetPrice = setMarketData.price;
        const profitDifference = completeSetPrice - individualPartsValue;

        // Update progress with market analysis
        setProgress.completeSetPrice = setMarketData.price;
        setProgress.completeSetVolume = setMarketData.volume;
        setProgress.completeSetAverage = setMarketData.average;
        setProgress.completeSetBuyerUsername = setMarketData.buyerUsername || undefined;
        setProgress.completeSetBuyerQuantity = setMarketData.buyerQuantity;
        setProgress.individualPartsValue = individualPartsValue;
        setProgress.profitDifference = profitDifference;

        // Calculate investment analysis
        const investmentAnalysis = calculateInvestmentAnalysis(setProgress, primePartsInventory, relicsInventory);
        setProgress.investmentAnalysis = investmentAnalysis;

        setProgress.recommendedStrategy = determineOptimalStrategyWithInvestment(setProgress, individualPartsValue, completeSetPrice, investmentAnalysis);
        setProgress.setMarketStatus = 'loaded' as const;
        setProgress.setMarketError = setMarketData.error;

        console.log(`🎯 [Individual Set] ${setName}: Parts=${individualPartsValue}p, Set=${completeSetPrice}p, Strategy=${setProgress.recommendedStrategy}`);
      } catch (error) {
        console.error(`🔄 [Prime Set] Failed to fetch market data for ${setName}:`, error);
        setProgress.setMarketStatus = 'error' as const;
        setProgress.setMarketError = error instanceof Error ? error.message : 'Failed to fetch market data';
      }
    }

    return setProgress;
  } catch (error) {
    console.error(`🔄 [Prime Set] Failed to refresh ${setName}:`, error);
    return null;
  }
};