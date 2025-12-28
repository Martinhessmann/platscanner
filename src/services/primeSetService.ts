// Purpose: Prime Set Management Service - Detects buildable sets from inventory and tracks mastery status
// Author: Assistant
// Last Updated: 2025-01-28

import { DetectedItem, VoidRelic } from '../types';
import { saveToInventory, getCategorizedInventory, clearInventoryByCategory } from './inventoryService';
import { cloudSyncService } from './cloudSyncService';
import { isItemOwned } from './ownedItemsService';

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
  vaultStatus: 'active' | 'vaulted' | 'unvaulted';
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
    missingPartsWithPrices?: Array<{ name: string; price: number; avg48h?: number }>; // Individual prices for missing parts
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

// Determine vault status for a prime set
const getVaultStatus = (name: string): PrimeSet['vaultStatus'] => {
  // Most recent releases that are currently active
  const currentActive = [
    'Gara Prime', 'Nidus Prime', 'Harrow Prime', 'Khora Prime', 'Garuda Prime',
    'Revenant Prime', 'Baruuk Prime', 'Hildryn Prime', 'Wisp Prime', 'Gauss Prime',
    'Atlas Prime', 'Ivara Prime', 'Titania Prime', 'Nezha Prime', 'Inaros Prime',
    'Octavia Prime', 'Grendel Prime', 'Sevagoth Prime', 'Nyx Prime', 'Valkyr Prime',
    'Protea Prime', 'Xaku Prime', 'Yareli Prime', 'Lavos Prime'
  ];

  // Check if it's currently active
  if (currentActive.some(active => name.includes(active.split(' ')[0]))) {
    return 'active';
  }

  // For now, everything else is considered vaulted
  // In a real implementation, this would check against Warframe's API or a comprehensive database
  return 'vaulted';
};

// Determine if a prime set is vaulted (for backward compatibility)
const isVaulted = (name: string): boolean => {
  return getVaultStatus(name) === 'vaulted';
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

  const vaultStatus = getVaultStatus(jsonSet.name);
  const vaulted = isVaulted(jsonSet.name);

  const requiredParts: PrimePart[] = jsonSet.components.map(component => ({
    name: `${jsonSet.name} ${component.name}`,
    partType: component.name as PrimePart['partType'],
    ducats: DUCATS_MAP[component.name] || 45, // Default to 45 ducats
    vaulted,
    itemCount: component.count
  }));

  return {
    id,
    name: jsonSet.name,
    type,
    category: type as any, // Simplified mapping
    requiredParts,
    vaulted,
    vaultStatus,
    masteryRank: getMasteryRank(type),
    releaseDate: '2024-01-01' // Placeholder date
  };
};

// Use centralized static data loading
import { getPrimeSetsCache as getStaticPrimeSetsCache, loadPrimeSetsData } from './staticDataService';
import { fetchBatchPrimeSetMarketData, fetchPrimeSetMarketData, fetchSinglePriceData } from './warframeMarketService';

export const loadPrimeSets = async (): Promise<PrimeSet[]> => {
  try {
    // Try cache first, lazily initialize if missing
    let jsonData: PrimeSetJson[] | null = getStaticPrimeSetsCache() as any;
    if (!jsonData || jsonData.length === 0) {
      const loaded = await loadPrimeSetsData();
      jsonData = loaded as any;
    }

    return jsonData.map(transformJsonToPrimeSet);
  } catch (error) {
    console.error('Failed to load prime sets:', error);
    return [];
  }
};

// Mastery tracking storage key
const MASTERY_STORAGE_KEY = 'platscanner_mastery';

// Prime Sets analysis last refresh tracking
const PRIME_SETS_LAST_REFRESH_KEY = 'platscanner_prime_sets_last_refresh';

// NEW: Inventory-backed storage for Prime Sets analysis results
export const getPrimeSetsCache = (): SetProgress[] => {
  try {
    const categorized = getCategorizedInventory();
    const sets = categorized.prime_sets || [];
    return sets
      .map(item => item.setData)
      .filter(Boolean);
  } catch (error) {
    console.error('Failed to load prime sets from inventory:', error);
    return [];
  }
};

export const setPrimeSetsCache = (setProgress: SetProgress[]): void => {
  try {
    // Transform SetProgress[] to inventory items and save
    const items: DetectedItem[] = setProgress.map(progress => ({
      id: `set-${progress.set.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: progress.set.name,
      category: 'prime_sets',
      quantity: 1,
      status: 'loaded',
      // Quick summary fields for list rendering without parsing setData
      price: progress.individualPartsValue || 0,
      completeSetPrice: progress.completeSetPrice,
      completeSetBuyerUsername: progress.completeSetBuyerUsername,
      completeSetBuyerQuantity: progress.completeSetBuyerQuantity,
      completeSetVolume: progress.completeSetVolume,
      completeSetAverage: progress.completeSetAverage,
      individualPartsValue: progress.individualPartsValue,
      ownedPartsCount: progress.ownedParts?.length || 0,
      totalPartsCount: progress.set.requiredParts?.length || 0,
      completionPercentage: progress.completionPercentage,
      obtainableFromRelicsCount: progress.obtainableFromRelics?.length || 0,
      missingPartsToBuyCount: progress.missingParts?.length || 0,
      setData: progress
    }) as unknown as DetectedItem);

    // Clear existing prime_sets and save fresh list to avoid stale items
    clearInventoryByCategory('prime_sets');
    if (items.length > 0) {
      saveToInventory(items);
    }

    localStorage.setItem(PRIME_SETS_LAST_REFRESH_KEY, new Date().toISOString());

    // Notify cloud sync of local data modification
    cloudSyncService.onLocalDataModified().catch(error => {
      console.error('Failed to sync prime sets to cloud:', error);
    });
  } catch (error) {
    console.error('Failed to save prime sets to inventory:', error);
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
  clearInventoryByCategory('prime_sets');
  localStorage.removeItem(PRIME_SETS_LAST_REFRESH_KEY);
  console.log('>>> [Cache] Prime Sets (inventory) cleared <<<');
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

// REMOVED: ownsItem function - using hasItemInInventory directly for completion

// Check if item exists in inventory (regardless of owned status)
const hasItemInInventory = (itemName: string, requiredCount: number, inventory: DetectedItem[]): boolean => {
  // Filter out invalid items (Gemini response text, etc.)
  const validInventory = inventory.filter(item => {
    // Must be prime_parts category
    if (item.category !== 'prime_parts') return false;

    // Must not contain Gemini response artifacts
    const lowerName = item.name.toLowerCase();
    if (lowerName.includes('here are the') ||
        lowerName.includes('visible in the screenshot') ||
        lowerName.includes('items detected') ||
        lowerName.length < 5) return false;

    return true;
  });

  const lowerItemName = itemName.toLowerCase();


  // Convert "Acceltra Prime Barrel" to "acceltra_prime_barrel" format
  const underscoreFormat = lowerItemName.replace(/\s+/g, '_');

  const inventoryItem = validInventory.find(item => {
    const lowerInventoryItemName = item.name.toLowerCase();

    // Try multiple matching strategies
    const exactMatch = lowerInventoryItemName === lowerItemName;
    const blueprintMatch = lowerInventoryItemName === `${lowerItemName} blueprint`;
    const underscoreMatch = lowerInventoryItemName === underscoreFormat;
    const underscoreBlueprintMatch = lowerInventoryItemName === `${underscoreFormat}_blueprint`;

    return exactMatch || blueprintMatch || underscoreMatch || underscoreBlueprintMatch;
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

  return matchingRelics.length > 0;
};

// Calculate cost for missing parts (placeholder - would need market data)
const calculateMissingCost = (missingParts: string[]): number => {
  // This would need to fetch market prices for missing parts
  // For now, return a placeholder value
  return missingParts.length * 50; // Placeholder: 50p per missing part
};

// Helper: Check if a part is a built (non-blueprint) warframe component
// Warframe parts: Only blueprints are tradeable (built chassis/systems/neuroptics cannot be sold)
// Weapon parts: Built parts CAN be traded
const isBuiltWarframePart = (partName: string, setType: PrimeSet['type']): boolean => {
  // Only applies to Warframes
  if (setType !== 'Warframe') {
    return false;
  }
  
  // Check if it's a built component (not a blueprint)
  const lowerName = partName.toLowerCase();
  const isBlueprint = lowerName.includes('blueprint');
  
  // If it's a blueprint, it's tradeable
  if (isBlueprint) {
    return false;
  }
  
  // Check if it's a warframe component (chassis, systems, neuroptics)
  const warframeComponents = ['chassis', 'systems', 'neuroptics'];
  const isWarframeComponent = warframeComponents.some(component => lowerName.includes(component));
  
  // If it's a built warframe component, it's not tradeable
  return isWarframeComponent;
};

// Helper: Check if an inventory item is a built (non-blueprint) warframe component
const isBuiltWarframeInventoryItem = (itemName: string, setType: PrimeSet['type']): boolean => {
  // Only applies to Warframes
  if (setType !== 'Warframe') {
    return false;
  }
  
  // Check if it's a built component (not a blueprint)
  const lowerName = itemName.toLowerCase();
  const isBlueprint = lowerName.includes('blueprint');
  
  // If it's a blueprint, it's tradeable
  if (isBlueprint) {
    return false;
  }
  
  // Check if it's a warframe component (chassis, systems, neuroptics)
  const warframeComponents = ['chassis', 'systems', 'neuroptics'];
  const isWarframeComponent = warframeComponents.some(component => lowerName.includes(component));
  
  // If it's a built warframe component, it's not tradeable
  return isWarframeComponent;
};

// NEW: Calculate the total market value of owned individual parts
// Excludes built warframe parts (non-blueprint chassis/systems/neuroptics) as they cannot be traded
const calculateIndividualPartsValue = (
  ownedParts: string[],
  primePartsInventory: DetectedItem[],
  setType?: PrimeSet['type']
): number => {
  let totalValue = 0;

  ownedParts.forEach(partName => {
    const inventoryItem = primePartsInventory.find(item => {
      const lowerItemName = item.name.toLowerCase();
      const lowerPartName = partName.toLowerCase();
      return lowerItemName === lowerPartName || lowerItemName === `${lowerPartName} blueprint`;
    });

    // Skip built warframe parts - check the ACTUAL inventory item name, not the part name
    if (inventoryItem && setType && isBuiltWarframeInventoryItem(inventoryItem.name, setType)) {
      return; // Built warframe component cannot be traded
    }

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
  const potentialValue = setProgress.completeSetPrice || 0; // Buyer price (highest buy order)

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

  // Calculate cost to buy missing parts from market using SELLER prices (lowest sell orders - what it costs to buy)
  // First try to use fetched prices from missingPartsWithPrices if available
  let buyInvestmentCost = 0;
  const fetchedPrices = (setProgress as any)._tempMissingPartsWithPrices as Array<{ name: string; price: number }> | undefined;
  
  if (fetchedPrices && fetchedPrices.length > 0) {
    // Use fetched prices (more accurate) - these should be seller prices
    missingPartsToBuy.forEach(partName => {
      const fetchedPrice = fetchedPrices.find(p => 
        p.name.toLowerCase() === partName.toLowerCase()
      );
      if (fetchedPrice && fetchedPrice.price > 0) {
        buyInvestmentCost += fetchedPrice.price;
      } else {
        // Fallback to estimated seller price if fetched price not found
        const partPrice = getEstimatedPartPrice(partName, primePartsInventory, true);
        buyInvestmentCost += partPrice;
      }
    });
  } else {
    // Use estimated seller prices if fetched prices not available
    missingPartsToBuy.forEach(partName => {
      // Use seller price (cost to buy) for investment calculations
      const partPrice = getEstimatedPartPrice(partName, primePartsInventory, true);
      buyInvestmentCost += partPrice;
    });
  }

  // Calculate void trace cost for relic opening (estimated)
  // Assume average 75 void traces per missing part from relics
  // 1 void trace ≈ 0.3 platinum (rough market equivalent)
  const avgVoidTracesPerPart = 75;
  const voidTraceToplatinumRatio = 0.3;
  const relicInvestmentCost = missingPartsFromRelics.length * avgVoidTracesPerPart * voidTraceToplatinumRatio;

  const totalInvestmentCost = buyInvestmentCost + relicInvestmentCost;
  
  // FIXED ROI: Complete set buyer price - sum of missing parts seller prices
  // This represents the actual profit if you buy missing parts and sell the complete set
  const expectedProfit = potentialValue - totalInvestmentCost;
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
// useSellerPrice: true = use seller price (cost to buy), false = use buyer price (what you can sell for)
const getEstimatedPartPrice = (
  partName: string,
  primePartsInventory: DetectedItem[],
  useSellerPrice: boolean = false
): number => {
  // Try to find exact match first
  const exactMatch = primePartsInventory.find(item => {
    const lowerItemName = item.name.toLowerCase();
    const lowerPartName = partName.toLowerCase();
    return lowerItemName === lowerPartName || lowerItemName === `${lowerPartName} blueprint`;
  });

  if (exactMatch) {
    // Use sellerPrice for investment cost (what it costs to buy), price (buyer) for current value
    if (useSellerPrice) {
      // For investment calculations: use seller price (cost to buy), fallback to average if no sellers
      const marketPrice = (exactMatch.sellerPrice && exactMatch.sellerPrice > 0)
        ? exactMatch.sellerPrice
        : (exactMatch.average && exactMatch.average > 0 ? exactMatch.average : 0);
      return marketPrice;
    } else {
      // For current value: use buyer price (what you can sell for)
      return (exactMatch.price && exactMatch.price > 0) ? exactMatch.price : 0;
    }
  }

  // If no exact match, try to estimate based on part type
  const partType = partName.split(' ').pop()?.toLowerCase();
  const similarParts = primePartsInventory.filter(item => {
    const hasPartType = item.name.toLowerCase().includes(partType || '');
    const hasPrice = useSellerPrice
      ? (item.sellerPrice && item.sellerPrice > 0)
      : (item.price && item.price > 0);
    return hasPartType && hasPrice;
  });

  if (similarParts.length > 0) {
    // Return average price of similar parts
    const avgPrice = similarParts.reduce((sum, item) => {
      const priceValue = useSellerPrice ? (item.sellerPrice || 0) : (item.price || 0);
      return sum + priceValue;
    }, 0) / similarParts.length;
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
  // If no market data available, can't make recommendation
  if (completeSetPrice === 0 && individualPartsValue === 0) {
    return 'INSUFFICIENT_DATA';
  }

  // If we have investment analysis and it shows good ROI (buy missing parts to complete set)
  if (investmentAnalysis && investmentAnalysis.expectedProfit > 5) {
    // Only recommend buying if there are missing parts to buy
    if (investmentAnalysis.missingPartsToBuy.length > 0 || investmentAnalysis.missingPartsFromRelics.length > 0) {
      return 'BUY_MISSING';
    }
  }

  // Default: sell individual parts (if you have parts but completing the set isn't profitable)
  if (individualPartsValue > 0) {
    return 'SELL_PARTS';
  }

  // If no parts owned, can't sell anything
  return 'INSUFFICIENT_DATA';
};

// NEW: Enhanced analyze function with complete set market data
export const analyzeSetProgressWithMarketData = async (
  primePartsInventory: DetectedItem[],
  relicsInventory: VoidRelic[] = [],
  includeMarketData: boolean = true,
  forceRefresh: boolean = false,
  setsToRefresh?: string[]
): Promise<SetProgress[]> => {

  // Check for cached data first (unless force refresh requested)
  if (!forceRefresh && includeMarketData && !setsToRefresh) {
    const cachedProgress = getPrimeSetsCache();
    console.log(`📦 [Prime Sets] Cache check: ${cachedProgress.length} cached sets, forceRefresh=${forceRefresh}`);
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
      if (hasItemInInventory(part.name, requiredCount, primePartsInventory)) {
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
    // Calculate completion percentage based on inventory items
    const completionPercentage = (ownedParts.length / set.requiredParts.length) * 100;
    const ismastered = masteredSets.includes(set.id);

    return {
      set,
      ownedParts,
      missingParts,
      obtainableFromRelics,
      canBuild,
      totalCost,
      missingCost: 0, // Will be calculated with real prices
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
  // If setsToRefresh is provided, ONLY refresh those sets (regardless of owned parts)
  const setsNeedingMarketData = setProgress.filter(progress => {
    if (setsToRefresh) {
      return setsToRefresh.includes(progress.set.name);
    }
    return progress.ownedParts.length > 0 || progress.canBuild;
  });

  if (setsNeedingMarketData.length > 0) {
    console.log(`🎯 [Market Analysis] Fetching market data for ${setsNeedingMarketData.length} sets with owned parts`);

    try {
      const setNames = setsNeedingMarketData.map(progress => progress.set.name);
      const marketData = await fetchBatchPrimeSetMarketData(setNames);

      // Enhance progress with market data
      setsNeedingMarketData.forEach((progress, index) => {
        const setMarketData = marketData[index];
        const individualPartsValue = calculateIndividualPartsValue(progress.ownedParts, primePartsInventory, progress.set.type);
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
        progress.setMarketStatus = 'loaded' as const;
        progress.setMarketError = setMarketData.error;

        console.log(`🎯 [Market Analysis] ${progress.set.name}: Parts=${individualPartsValue}p, Set=${completeSetPrice}p`);
      });

      // Fetch missing part prices for sets that are near completion (50%+)
      // This provides accurate investment costs without overwhelming the API
      // OPTIMIZATION: Only fetch prices for parts that must be BOUGHT (not obtainable from relics)
      const nearCompleteSets = setsNeedingMarketData.filter(p => p.completionPercentage >= 50);
      if (nearCompleteSets.length > 0) {
        console.log(`💰 [Batch Refresh] Fetching missing part prices for ${nearCompleteSets.length} near-complete sets`);

        for (const progress of nearCompleteSets) {
          // FILTER: Only fetch for parts that must be bought (not obtainable from relics)
          const partsToBuy = progress.missingParts.filter(part =>
            !progress.obtainableFromRelics.includes(part)
          );

          if (partsToBuy.length > 0) {
            try {
              console.log(`💰 [Batch Refresh] ${progress.set.name}: Fetching ${partsToBuy.length} parts to buy (skipping ${progress.obtainableFromRelics.length} relic-obtainable parts)`);

              const missingPartItems: DetectedItem[] = partsToBuy.map(name => ({
                id: `missing-${name.toLowerCase().replace(/\s+/g, '-')}`,
                name,
                category: 'prime_parts',
                status: 'loading'
              } as any));

              const priced = await Promise.all(
                missingPartItems.map(item => fetchSinglePriceData(item).catch(() => null))
              );

              // Store individual SELLER prices for display (cost to buy - lowest sell orders)
              // CRITICAL: Must use sellerPrice (lowest sell order), not average or buyer price
              const missingPartsWithPrices = priced
                .map((p, i) => ({
                  name: missingPartItems[i].name,
                  price: p?.sellerPrice || 0, // Use seller price ONLY (lowest sell order)
                  avg48h: p?.recentAverage48h || p?.average || 0 // Include 48h average for display
                }))
                .filter(p => p.price > 0);

              // Calculate cost using SELLER prices ONLY (what it costs to buy - lowest sell orders)
              const missingCost = priced.reduce((sum, p) => {
                const cost = (p && p.sellerPrice && p.sellerPrice > 0) ? p.sellerPrice : 0;
                return sum + cost;
              }, 0);
              progress.missingCost = missingCost;

              // Store the prices temporarily - will be added to investmentAnalysis later
              (progress as any)._tempMissingPartsWithPrices = missingPartsWithPrices;
            } catch (err) {
              console.warn(`Failed to fetch missing part prices for ${progress.set.name}:`, err);
            }
          } else {
            console.log(`💰 [Batch Refresh] ${progress.set.name}: All missing parts obtainable from relics, skipping price fetch`);
          }
        }
      }

      // NOW calculate investment analysis and strategies AFTER we have all the price data
      setsNeedingMarketData.forEach(progress => {
        const individualPartsValue = progress.individualPartsValue || 0;
        const completeSetPrice = progress.completeSetPrice || 0;

        // Calculate investment analysis with fetched prices
        const investmentAnalysis = calculateInvestmentAnalysis(progress, primePartsInventory, relicsInventory);

        // Add the fetched missing part prices to the analysis
        if (investmentAnalysis && (progress as any)._tempMissingPartsWithPrices) {
          investmentAnalysis.missingPartsWithPrices = (progress as any)._tempMissingPartsWithPrices;
          delete (progress as any)._tempMissingPartsWithPrices; // Clean up temp field
        }

        progress.investmentAnalysis = investmentAnalysis;
        progress.recommendedStrategy = determineOptimalStrategyWithInvestment(progress, individualPartsValue, completeSetPrice, investmentAnalysis);

        console.log(`🎯 [Strategy] ${progress.set.name}: Strategy=${progress.recommendedStrategy}, Investment=${investmentAnalysis?.totalInvestmentCost || 0}p`);
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

// Get priority recommendations from analyzed data
export const getSetRecommendations = (
  allProgress: SetProgress[]
): {
  buildable: SetProgress[];
  nearComplete: SetProgress[];
  highValue: SetProgress[];
} => {
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

// Get priority recommendations (async version for backward compatibility)
export const getSetRecommendationsAsync = async (
  primePartsInventory: DetectedItem[],
  relicsInventory: VoidRelic[] = []
): Promise<{
  buildable: SetProgress[];
  nearComplete: SetProgress[];
  highValue: SetProgress[];
}> => {
  const allProgress = await analyzeSetProgressWithMarketData(primePartsInventory, relicsInventory);
  return getSetRecommendations(allProgress);
};

// NEW: Refresh Prime Sets market data (force refresh)
export const refreshPrimeSetsMarketData = async (
  primePartsInventory: DetectedItem[],
  relicsInventory: VoidRelic[] = [],
  setsToRefresh?: string[]
): Promise<SetProgress[]> => {
  console.log(`🔄 [Prime Sets] Force refreshing market data... ${setsToRefresh ? `(${setsToRefresh.length} sets)` : '(all)'}`);

  // Clear cache first ONLY if refreshing all
  if (!setsToRefresh) {
    clearPrimeSetsCache();
  }

  // Force fetch new data
  return analyzeSetProgressWithMarketData(primePartsInventory, relicsInventory, true, true, setsToRefresh);
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
      if (hasItemInInventory(part.name, requiredCount, primePartsInventory)) {
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
    // Calculate completion percentage based on inventory items
    const completionPercentage = (ownedParts.length / targetSet.requiredParts.length) * 100;
    const ismastered = masteredSets.includes(targetSet.id);

    const setProgress: SetProgress = {
      set: targetSet,
      ownedParts,
      missingParts,
      obtainableFromRelics,
      canBuild,
      totalCost,
      missingCost: 0, // Will be calculated with real prices
      completionPercentage,
      ismastered,
      setMarketStatus: 'loading' as const
    };

    console.log(`🔄 [Prime Set] ${setName}: ownedParts=${ownedParts.length}, canBuild=${canBuild}, will fetch market data: ${ownedParts.length > 0 || canBuild}`);

    // Fetch market data for this specific set if it has owned parts or can be built
    if (ownedParts.length > 0 || canBuild) {
      console.log(`🔄 [Prime Set] Fetching market data for ${setName}...`);
      try {
        const setMarketData = await fetchPrimeSetMarketData(setName);
        const individualPartsValue = calculateIndividualPartsValue(ownedParts, primePartsInventory, targetSet.type);
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

        // NEW: Fetch real market prices for missing parts to compute accurate missingCost
        // OPTIMIZATION: Only fetch for parts that must be BOUGHT (not obtainable from relics)
        let missingPartsWithPrices: Array<{ name: string; price: number }> = [];
        const partsToBuy = setProgress.missingParts.filter(part =>
          !setProgress.obtainableFromRelics.includes(part)
        );

        if (partsToBuy.length > 0) {
          try {
            console.log(`💰 [Individual Set] ${setName}: Fetching ${partsToBuy.length} parts to buy (skipping ${setProgress.obtainableFromRelics.length} relic-obtainable parts)`);

            const missingPartItems: DetectedItem[] = partsToBuy.map(name => ({
              id: `missing-${name.toLowerCase().replace(/\s+/g, '-')}`,
              name,
              category: 'prime_parts',
              status: 'loading'
            } as any));

            const priced = await Promise.all(
              missingPartItems.map(item => fetchSinglePriceData(item).catch(() => null))
            );

            // Store individual SELLER prices for display (cost to buy - lowest sell orders)
            // CRITICAL: Must use sellerPrice (lowest sell order), not average or buyer price
            missingPartsWithPrices = priced
              .map((p, i) => ({
                name: missingPartItems[i].name,
                price: p?.sellerPrice || 0, // Use seller price ONLY (lowest sell order)
                avg48h: p?.recentAverage48h || p?.average || 0 // Include 48h average for display
              }))
              .filter(p => p.price > 0);

            // Calculate cost using SELLER prices ONLY (what it costs to buy - lowest sell orders)
            const missingCost = priced.reduce((sum, p) => {
              const cost = (p && p.sellerPrice && p.sellerPrice > 0) ? p.sellerPrice : 0;
              return sum + cost;
            }, 0);
            setProgress.missingCost = missingCost;
          } catch (_err) {
            // Keep existing estimated missingCost on failure
          }
        } else {
          console.log(`💰 [Individual Set] ${setName}: All missing parts obtainable from relics, skipping price fetch`);
        }

        // Store fetched prices temporarily so calculateInvestmentAnalysis can use them
        if (missingPartsWithPrices.length > 0) {
          (setProgress as any)._tempMissingPartsWithPrices = missingPartsWithPrices;
        }
        
        // Calculate investment analysis (now includes improved buy cost if available)
        const investmentAnalysis = calculateInvestmentAnalysis(setProgress, primePartsInventory, relicsInventory);
        
        // Add the fetched prices to investment analysis
        if (investmentAnalysis && missingPartsWithPrices.length > 0) {
          investmentAnalysis.missingPartsWithPrices = missingPartsWithPrices;
          // Clean up temp field
          delete (setProgress as any)._tempMissingPartsWithPrices;
        }
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

    // CRITICAL: Update the cache with the refreshed set data
    const cachedSets = getPrimeSetsCache();
    const updatedSets = cachedSets.map(cached =>
      cached.set.name === setName ? setProgress : cached
    );

    // If the set wasn't in cache (new), add it
    if (!cachedSets.some(cached => cached.set.name === setName)) {
      updatedSets.push(setProgress);
    }

    setPrimeSetsCache(updatedSets);
    console.log(`💾 [Individual Set] Updated cache for ${setName}`);

    return setProgress;
  } catch (error) {
    console.error(`🔄 [Prime Set] Failed to refresh ${setName}:`, error);
    return null;
  }
};