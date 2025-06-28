// Purpose: Prime Set Management Service - Detects buildable sets from inventory and tracks mastery status
// Author: Assistant
// Last Updated: 2025-01-03

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

// Analyze set completion progress
export const analyzeSetProgress = async (
  primePartsInventory: DetectedItem[],
  relicsInventory: VoidRelic[] = []
): Promise<SetProgress[]> => {
  const primeSets = await loadPrimeSets();
  const masteredSets = getMasteredSets();

  return primeSets.map(set => {
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
      ismastered
    };
  });
};

// Get sets that can be built immediately
export const getBuildableSets = async (
  primePartsInventory: DetectedItem[],
  relicsInventory: VoidRelic[] = []
): Promise<SetProgress[]> => {
  const progress = await analyzeSetProgress(primePartsInventory, relicsInventory);
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
  const progress = await analyzeSetProgress(primePartsInventory, relicsInventory);
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
  const allProgress = await analyzeSetProgress(primePartsInventory, relicsInventory);

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