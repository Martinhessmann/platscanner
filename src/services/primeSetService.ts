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
    missingPartsWithPrices?: Array<{ name: string; price: number; buyerPrice?: number; avg48h?: number }>; // Individual prices for missing parts (price=seller, buyerPrice=buyer)
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
// For warframes, prefers blueprint over built part if both exist
const hasItemInInventory = (itemName: string, requiredCount: number, inventory: DetectedItem[], setType?: PrimeSet['type']): boolean => {
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

  // For warframes, ONLY count blueprints as owned (built parts are NOT tradeable)
  if (setType === 'Warframe') {
    // Check if the part name already includes "Blueprint" (e.g., "Wisp Prime Blueprint")
    const partNameIsBlueprint = lowerItemName.includes('blueprint');
    
    // Only look for blueprint (tradeable) - built parts don't count toward set completion
    const blueprintItem = validInventory.find(item => {
      const lowerInventoryItemName = item.name.toLowerCase();
      
      // If part name already includes "Blueprint", match it directly
      if (partNameIsBlueprint) {
        const exactMatch = lowerInventoryItemName === lowerItemName;
        const underscoreMatch = lowerInventoryItemName === underscoreFormat;
        return exactMatch || underscoreMatch;
      }
      
      // Otherwise, try adding "Blueprint" suffix
      const blueprintMatch = lowerInventoryItemName === `${lowerItemName} blueprint`;
      const underscoreBlueprintMatch = lowerInventoryItemName === `${underscoreFormat}_blueprint`;
      return blueprintMatch || underscoreBlueprintMatch;
    });

    // Only return true if blueprint exists - built parts are NOT counted
    return blueprintItem ? (blueprintItem.quantity || 1) >= requiredCount : false;
  }

  // For weapons, find any matching item
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

/**
 * Get the set type (Warframe, Primary, Secondary, Melee, etc.) for a prime part
 * Returns null if the set cannot be determined
 */
export const getPrimePartSetType = (itemName: string): PrimeSet['type'] | null => {
  const primeSets = getStaticPrimeSetsCache();
  if (!primeSets || primeSets.length === 0) {
    return null;
  }
  
  // Extract the prime set name from the item name
  // Pattern: "Wisp Prime Chassis" -> "Wisp Prime"
  // Pattern: "Acceltra Prime Barrel" -> "Acceltra Prime"
  // Also handle underscore format: "wisp_prime_chassis" -> "Wisp Prime"
  const normalizedName = itemName.replace(/_/g, ' ');
  const words = normalizedName.split(' ');
  const primeIndex = words.findIndex(w => w.toLowerCase() === 'prime');
  
  if (primeIndex === -1 || primeIndex === 0) {
    return null;
  }
  
  // Extract set name: everything up to and including "Prime"
  const setName = words.slice(0, primeIndex + 1).join(' ');
  
  // Find matching set - handle both raw JSON format (with category) and transformed PrimeSet format (with type)
  const matchingSet = primeSets.find((set: any) => {
    const setNameLower = setName.toLowerCase();
    const setNameInData = (set.name || '').toLowerCase();
    return setNameInData === setNameLower;
  });
  
  if (!matchingSet) {
    return null;
  }
  
  // Handle both raw JSON format (category field) and transformed PrimeSet format (type field)
  if (matchingSet.type) {
    // Already transformed PrimeSet object
    return matchingSet.type;
  } else if (matchingSet.category) {
    // Raw JSON format - map category to type
    return mapCategoryToType(matchingSet.category);
  }
  
  return null;
};

/**
 * Check if a prime part item is tradeable
 * Built warframe components (chassis, systems, neuroptics without blueprint) are NOT tradeable
 * This is a standalone function that doesn't require set type context
 */
export const isPrimePartTradeable = (itemName: string): boolean => {
  const lowerName = itemName.toLowerCase();
  
  // Check if it's a blueprint - blueprints are always tradeable
  if (lowerName.includes('blueprint')) {
    return true;
  }
  
  // Check if it's a warframe component (chassis, systems, neuroptics)
  const warframeComponents = ['chassis', 'systems', 'neuroptics'];
  const matchingComponent = warframeComponents.find(component => lowerName.includes(component));
  
  if (!matchingComponent) {
    // Not a warframe component, so it's tradeable (weapons, etc.)
    return true;
  }
  
  // It's a warframe component without "blueprint" - check if it belongs to a warframe set
  const primeSets = getStaticPrimeSetsCache();
  if (!primeSets || primeSets.length === 0) {
    // Can't determine, assume tradeable to be safe
    return true;
  }
  
  // Extract the prime set name from the item name
  // Pattern: "Wisp Prime Chassis" -> "Wisp Prime"
  // Pattern: "Harrow Prime Systems" -> "Harrow Prime"
  const words = itemName.split(' ');
  const primeIndex = words.findIndex(w => w.toLowerCase() === 'prime');
  
  if (primeIndex === -1 || primeIndex === 0) {
    // No "Prime" found or it's the first word, assume tradeable
    return true;
  }
  
  // Extract set name: everything up to and including "Prime"
  const setName = words.slice(0, primeIndex + 1).join(' ');
  
  // Check if this set exists and is a Warframe
  const matchingSet = primeSets.find(set => 
    set.name.toLowerCase() === setName.toLowerCase() && set.type === 'Warframe'
  );
  
  if (matchingSet) {
    // It's a built warframe component - NOT tradeable
    return false;
  }
  
  // Not found in warframe sets, assume tradeable (might be a weapon component with similar name)
  return true;
};

// NEW: Calculate the total market value of owned individual parts
// Excludes built warframe parts (non-blueprint chassis/systems/neuroptics) as they cannot be traded
// If both built part and blueprint exist, prefer blueprint (tradeable)
// CRITICAL: Only counts parts with buyers (hasBuyers === true) - parts without buyers cannot be sold
const calculateIndividualPartsValue = (
  ownedParts: string[],
  primePartsInventory: DetectedItem[],
  setType?: PrimeSet['type']
): number => {
  let totalValue = 0;

  ownedParts.forEach(partName => {
    // For warframes, prefer blueprint if both exist
    let inventoryItem: DetectedItem | undefined;
    
    if (setType === 'Warframe') {
      // First try to find blueprint (tradeable)
      const blueprintItem = primePartsInventory.find(item => {
        const lowerItemName = item.name.toLowerCase();
        const lowerPartName = partName.toLowerCase();
        return lowerItemName === `${lowerPartName} blueprint` || 
               lowerItemName === `${lowerPartName.replace(/\s+/g, '_')}_blueprint`;
      });
      
      if (blueprintItem) {
        inventoryItem = blueprintItem;
      } else {
        // Fallback to built part (but it's not tradeable, so value is 0)
        inventoryItem = primePartsInventory.find(item => {
          const lowerItemName = item.name.toLowerCase();
          const lowerPartName = partName.toLowerCase();
          return lowerItemName === lowerPartName || lowerItemName === lowerPartName.replace(/\s+/g, '_');
        });
      }
    } else {
      // For weapons, find any matching item
      inventoryItem = primePartsInventory.find(item => {
        const lowerItemName = item.name.toLowerCase();
        const lowerPartName = partName.toLowerCase();
        return lowerItemName === lowerPartName || lowerItemName === `${lowerPartName} blueprint`;
      });
    }

    // Skip built warframe parts - check the ACTUAL inventory item name, not the part name
    if (inventoryItem && setType && isBuiltWarframeInventoryItem(inventoryItem.name, setType)) {
      return; // Built warframe component cannot be traded
    }

    // CRITICAL: Only count parts that have buyers AND a price > 0
    // Parts without buyers cannot be sold, so they have no value
    if (inventoryItem && 
        inventoryItem.price && 
        inventoryItem.price > 0 && 
        inventoryItem.hasBuyers === true) {
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
    console.log(`💰 [Investment] Using fetched prices for ${missingPartsToBuy.length} parts to buy`);
    // Use fetched prices (more accurate) - these should be seller prices
    missingPartsToBuy.forEach(partName => {
      const fetchedPrice = fetchedPrices.find(p => {
        const pName = p.name.toLowerCase();
        const partNameLower = partName.toLowerCase();
        // Try exact match first
        if (pName === partNameLower) return true;
        // Try with/without blueprint suffix
        if (pName === `${partNameLower} blueprint` || partNameLower === `${pName} blueprint`) return true;
        // Try underscore format
        const pNameUnderscore = pName.replace(/\s+/g, '_');
        const partNameUnderscore = partNameLower.replace(/\s+/g, '_');
        if (pNameUnderscore === partNameUnderscore) return true;
        return false;
      });
      if (fetchedPrice) {
        if (fetchedPrice.price > 0) {
          buyInvestmentCost += fetchedPrice.price;
          console.log(`💰 [Investment] ${partName}: ${fetchedPrice.price}p (from fetched price)`);
        } else {
          console.warn(`💰 [Investment] ${partName}: No seller price in fetched data (using 0)`);
        }
      } else {
        // NO FALLBACK ESTIMATES - if price not found, use 0
        console.warn(`💰 [Investment] ${partName}: Not found in fetched prices, using 0 (no fallback estimate)`);
        // Don't add anything to buyInvestmentCost - price is 0
      }
    });
  } else {
    console.warn(`💰 [Investment] No fetched prices available - all missing parts cost = 0p (no fallback estimates)`);
    // NO FALLBACK ESTIMATES - if no fetched prices, cost is 0
    buyInvestmentCost = 0;
  }
  
  console.log(`💰 [Investment] Total buyInvestmentCost: ${buyInvestmentCost}p`);

  // Calculate void trace cost for relic opening (estimated)
  // Assume average 75 void traces per missing part from relics
  // 1 void trace ≈ 0.3 platinum (rough market equivalent)
  const avgVoidTracesPerPart = 75;
  const voidTraceToplatinumRatio = 0.3;
  const relicInvestmentCost = missingPartsFromRelics.length * avgVoidTracesPerPart * voidTraceToplatinumRatio;

  const totalInvestmentCost = buyInvestmentCost + relicInvestmentCost;
  
  // FIXED ROI: Complete set buyer price - investment cost - current parts value (opportunity cost)
  // This represents the actual profit if you buy missing parts and sell the complete set
  // We subtract currentValue because selling the set means giving up the ability to sell individual parts
  const expectedProfit = potentialValue - totalInvestmentCost - currentValue;
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

// REMOVED: getEstimatedPartPrice - NO FALLBACK ESTIMATES ALLOWED
// If we can't get a real price from the market or inventory, use 0

// NEW: Enhanced strategy determination with investment analysis
// Smart formula that considers:
// 1. Parts with buyers vs no buyers (unsellable parts)
// 2. Set with buyers vs no buyers
// 3. Real sellable value comparison
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

  // SMART FORMULA: Check if set has buyers
  const setHasBuyers = setProgress.completeSetBuyerUsername != null || 
                       (setProgress.completeSetBuyerQuantity != null && setProgress.completeSetBuyerQuantity > 0) ||
                       completeSetPrice > 0; // If price > 0, assume buyers exist (from market data)

  // Count how many owned parts have buyers vs no buyers
  const primePartsInventory = getCategorizedInventory().prime_parts || [];
  let partsWithBuyers = 0;
  let partsWithoutBuyers = 0;
  
  setProgress.ownedParts.forEach(partName => {
    let inventoryItem: DetectedItem | undefined;
    
    if (setProgress.set.type === 'Warframe') {
      const blueprintItem = primePartsInventory.find(item => {
        const lowerItemName = item.name.toLowerCase();
        const lowerPartName = partName.toLowerCase();
        return lowerItemName === `${lowerPartName} blueprint` || 
               lowerItemName === `${lowerPartName.replace(/\s+/g, '_')}_blueprint`;
      });
      inventoryItem = blueprintItem || primePartsInventory.find(item => {
        const lowerItemName = item.name.toLowerCase();
        const lowerPartName = partName.toLowerCase();
        return lowerItemName === lowerPartName || lowerItemName === lowerPartName.replace(/\s+/g, '_');
      });
    } else {
      inventoryItem = primePartsInventory.find(item => {
        const lowerItemName = item.name.toLowerCase();
        const lowerPartName = partName.toLowerCase();
        return lowerItemName === lowerPartName || lowerItemName === `${lowerPartName} blueprint`;
      });
    }

    if (inventoryItem && 
        !isBuiltWarframeInventoryItem(inventoryItem.name, setProgress.set.type)) {
      if (inventoryItem.hasBuyers === true && inventoryItem.price && inventoryItem.price > 0) {
        partsWithBuyers++;
      } else {
        partsWithoutBuyers++;
      }
    }
  });

  // SMART DECISION LOGIC:
  // 1. If set has buyers and individualPartsValue < set price, sell the set
  //    (This catches cases like Bronco Prime where some parts have no buyers)
  // 2. If set has buyers and individualPartsValue >= set price, sell parts
  // 3. If set has no buyers but parts have buyers, sell parts
  // 4. If some parts have no buyers, heavily favor selling the set (if set has buyers)
  // 5. If NO parts have buyers but set has buyers, definitely sell the set
  
  console.log(`🎯 [Strategy Logic] ${setProgress.set.name}: partsValue=${individualPartsValue}p, setPrice=${completeSetPrice}p, setHasBuyers=${setHasBuyers}, partsWithBuyers=${partsWithBuyers}, partsWithoutBuyers=${partsWithoutBuyers}`);
  
  if (setHasBuyers) {
    // Set can be sold - compare real sellable value
    if (individualPartsValue === 0 && completeSetPrice > 0) {
      // No parts can be sold individually, but set can be sold - definitely sell the set
      console.log(`🎯 [Strategy] ${setProgress.set.name}: No parts sellable individually, but set can be sold → BUILD_AND_SELL`);
      return 'BUILD_AND_SELL';
    } else if (individualPartsValue < completeSetPrice) {
      // Set is worth more than sellable parts - sell the set
      console.log(`🎯 [Strategy] ${setProgress.set.name}: Set price (${completeSetPrice}p) > parts value (${individualPartsValue}p) → BUILD_AND_SELL`);
      return 'BUILD_AND_SELL';
    } else if (partsWithoutBuyers > 0 && completeSetPrice > 0) {
      // Some parts can't be sold individually, but set can be sold
      // If set price is reasonable (at least 50% of parts value), sell the set
      // OR if more than half the parts have no buyers, sell the set
      const partsValueRatio = individualPartsValue > 0 ? completeSetPrice / individualPartsValue : 1;
      const unsellableRatio = partsWithoutBuyers / (partsWithBuyers + partsWithoutBuyers);
      
      console.log(`🎯 [Strategy] ${setProgress.set.name}: Some parts unsellable (${partsWithoutBuyers}/${partsWithBuyers + partsWithoutBuyers}), valueRatio=${partsValueRatio.toFixed(2)}, unsellableRatio=${unsellableRatio.toFixed(2)}`);
      
      if (partsValueRatio >= 0.5 || unsellableRatio > 0.5) {
        console.log(`🎯 [Strategy] ${setProgress.set.name}: Unsellable parts detected, set price reasonable → BUILD_AND_SELL`);
        return 'BUILD_AND_SELL';
      }
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
      if (hasItemInInventory(part.name, requiredCount, primePartsInventory, set.type)) {
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

      // Fetch missing part prices for ALL sets with owned parts (not just 50%+)
      // This provides accurate investment costs and display prices
      // Fetch prices for ALL missing parts (both market-only and relic-obtainable) for display
      if (setsNeedingMarketData.length > 0) {
        console.log(`💰 [Batch Refresh] Fetching missing part prices for ${setsNeedingMarketData.length} sets`);

        for (const progress of setsNeedingMarketData) {
          // Fetch prices for ALL missing parts (for display purposes)
          // But only use market-only parts for investment cost calculation
          const allMissingParts = progress.missingParts;
          const partsToBuy = progress.missingParts.filter(part =>
            !progress.obtainableFromRelics.includes(part)
          );

          if (allMissingParts.length > 0) {
            try {
              console.log(`💰 [Batch Refresh] ${progress.set.name}: Fetching ${allMissingParts.length} missing parts (${partsToBuy.length} to buy, ${progress.obtainableFromRelics.length} from relics)`);

              // CRITICAL: For warframes, parts need "Blueprint" suffix for market lookup
              const missingPartItems: DetectedItem[] = allMissingParts.map(name => {
                // For warframe parts, add "Blueprint" suffix if not already present
                let marketName = name;
                if (progress.set.type === 'Warframe') {
                  const lowerName = name.toLowerCase();
                  const isComponent = ['chassis', 'systems', 'neuroptics'].some(comp => 
                    lowerName.includes(comp) && !lowerName.includes('blueprint')
                  );
                  if (isComponent) {
                    marketName = `${name} Blueprint`;
                  }
                }
                
                return {
                  id: `missing-${name.toLowerCase().replace(/\s+/g, '-')}`,
                  name: marketName, // Use market name for API lookup
                  originalName: name, // Keep original for storage
                  category: 'prime_parts',
                  status: 'loading'
                } as any;
              });

              const priced = await Promise.all(
                missingPartItems.map(item => fetchSinglePriceData(item).catch(() => null))
              );

              // Store individual SELLER prices for ALL missing parts (for display)
              // CRITICAL: Must use sellerPrice (lowest sell order), not average or buyer price
              // IMPORTANT: Use original part name for storage, not market lookup name
              const missingPartsWithPrices = priced
                .map((p, i) => {
                  const originalPartName = (missingPartItems[i] as any).originalName || missingPartItems[i].name;
                  return {
                    name: originalPartName, // Use original name (e.g., "Protea Prime Systems") for consistent matching
                    price: p?.sellerPrice || 0, // Use seller price ONLY (lowest sell order) - 0 if no sellers
                    buyerPrice: p?.price || 0, // Also store buyer price for display reference
                    avg48h: p?.recentAverage48h || p?.average || 0 // Include 48h average for display
                  };
                })
                // Keep all entries, even with 0 price, for debugging
                .map(p => {
                  if (p.price === 0) {
                    console.warn(`💰 [Batch] No seller price for "${p.name}" (buyerPrice=${p.buyerPrice || 0})`);
                  }
                  return p;
                });

              // Calculate cost using SELLER prices ONLY for parts that must be BOUGHT (not from relics)
              const missingCost = priced
                .filter((p, i) => partsToBuy.includes(missingPartItems[i].name))
                .reduce((sum, p) => {
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
            console.log(`💰 [Batch Refresh] ${progress.set.name}: No missing parts, skipping price fetch`);
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
      if (hasItemInInventory(part.name, requiredCount, primePartsInventory, targetSet.type)) {
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
        // Fetch prices for ALL missing parts (for display), but only use market-only parts for investment cost
        let missingPartsWithPrices: Array<{ name: string; price: number; avg48h?: number }> = [];
        const allMissingParts = setProgress.missingParts;
        const partsToBuy = setProgress.missingParts.filter(part =>
          !setProgress.obtainableFromRelics.includes(part)
        );

        if (allMissingParts.length > 0) {
          try {
            console.log(`💰 [Individual Set] ${setName}: Fetching ${allMissingParts.length} missing parts (${partsToBuy.length} to buy, ${setProgress.obtainableFromRelics.length} from relics)`);

            // CRITICAL: For warframes, parts need "Blueprint" suffix for market lookup
            // e.g., "Protea Prime Systems" → "Protea Prime Systems Blueprint"
            const missingPartItems: DetectedItem[] = allMissingParts.map(name => {
              // For warframe parts, add "Blueprint" suffix if not already present
              let marketName = name;
              if (setProgress.set.type === 'Warframe') {
                const lowerName = name.toLowerCase();
                // Check if it's a component that needs blueprint (not already a blueprint)
                const isComponent = ['chassis', 'systems', 'neuroptics'].some(comp => 
                  lowerName.includes(comp) && !lowerName.includes('blueprint')
                );
                if (isComponent) {
                  marketName = `${name} Blueprint`;
                  console.log(`💰 [Price Fetch] Warframe part "${name}" → market lookup: "${marketName}"`);
                }
              }
              
              return {
                id: `missing-${name.toLowerCase().replace(/\s+/g, '-')}`,
                name: marketName, // Use market name for API lookup
                originalName: name, // Keep original for storage
                category: 'prime_parts',
                status: 'loading'
              } as any;
            });

            const priced = await Promise.all(
              missingPartItems.map(item => {
                const originalName = (item as any).originalName || item.name;
                console.log(`💰 [Price Fetch] Fetching price for: ${originalName} (market: ${item.name})`);
                return fetchSinglePriceData(item).catch((err) => {
                  console.warn(`💰 [Price Fetch] Failed to fetch price for ${originalName}:`, err);
                  return null;
                });
              })
            );

            // Store individual SELLER prices for ALL missing parts (for display)
            // CRITICAL: Must use sellerPrice (lowest sell order), not average or buyer price
            // IMPORTANT: Store prices using the ORIGINAL part name from missingParts, not the market lookup name
            // This ensures matching works correctly in the UI
            missingPartsWithPrices = priced
              .map((p, i) => {
                const originalPartName = (missingPartItems[i] as any).originalName || missingPartItems[i].name; // Original: "Protea Prime Systems"
                const marketLookupName = missingPartItems[i].name; // Market: "Protea Prime Systems Blueprint"
                const apiItemName = p?.name || marketLookupName; // API response name
                const sellerPrice = p?.sellerPrice || 0;
                
                console.log(`💰 [Price Fetch] Original: "${originalPartName}" → Market lookup: "${marketLookupName}" → API: "${apiItemName}" → sellerPrice=${sellerPrice}, buyerPrice=${p?.price || 0}`);
                
                // CRITICAL: Always use the original part name for storage, not the market lookup or API response name
                // This ensures the UI matching logic works correctly
                // If sellerPrice is 0 but buyerPrice exists, we might want to show buyerPrice as reference
                // But for investment cost, we ONLY use sellerPrice (what it costs to buy)
                return {
                  name: originalPartName, // Use original name (e.g., "Protea Prime Systems") for consistent matching
                  price: sellerPrice, // Use seller price ONLY (lowest sell order) - 0 if no sellers
                  buyerPrice: p?.price || 0, // Also store buyer price for display reference
                  avg48h: p?.recentAverage48h || p?.average || 0 // Include 48h average for display
                };
              })
              // Keep all prices, even if 0, so we can debug matching issues
              .map(p => {
                if (p.price === 0) {
                  console.warn(`💰 [Price Fetch] No seller price found for "${p.name}" (might not be available on market or no sellers)`);
                } else {
                  console.log(`💰 [Price Fetch] ✓ Stored price for "${p.name}": ${p.price}p`);
                }
                return p;
              });

            // Calculate cost using SELLER prices ONLY for parts that must be BOUGHT (not from relics)
            // Use the stored prices from missingPartsWithPrices (which uses original names) instead of priced array
            const missingCost = missingPartsWithPrices
              .filter(p => partsToBuy.includes(p.name))
              .reduce((sum, p) => {
                const cost = p.price > 0 ? p.price : 0;
                if (cost > 0) {
                  console.log(`💰 [Cost Calc] ${p.name}: ${cost}p`);
                } else {
                  console.warn(`💰 [Cost Calc] ${p.name}: No seller price (using 0, not fallback estimate)`);
                }
                return sum + cost;
              }, 0);
            console.log(`💰 [Cost Calc] Total missing cost for ${setName}: ${missingCost}p (from ${partsToBuy.length} parts, ${missingPartsWithPrices.filter(p => p.price > 0).length} with prices)`);
            setProgress.missingCost = missingCost;
          } catch (_err) {
            // Keep existing estimated missingCost on failure
          }
        } else {
          console.log(`💰 [Individual Set] ${setName}: No missing parts, skipping price fetch`);
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