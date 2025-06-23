// Purpose: Prime Set Management Service - Detects buildable sets from inventory and tracks mastery status
// Author: Assistant
// Last Updated: 2025-01-03

import { DetectedItem, VoidRelic } from '../types';

export interface PrimePart {
  name: string;
  partType: 'Blueprint' | 'Systems' | 'Chassis' | 'Neuroptics' | 'Barrel' | 'Receiver' | 'Stock' | 'String' | 'Grip' | 'Blade' | 'Handle' | 'Link' | 'Gauntlet' | 'Upper Limb' | 'Lower Limb' | 'Carapace' | 'Cerebrum';
  ducats: number;
  vaulted: boolean;
}

export interface PrimeSet {
  id: string;
  name: string;
  type: 'Warframe' | 'Primary' | 'Secondary' | 'Melee';
  category: 'Assault Rifle' | 'Bow' | 'Shotgun' | 'Sniper' | 'Pistol' | 'Throwing Knife' | 'Sword' | 'Polearm' | 'Nikana' | 'Warframe';
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

// Prime Sets Database (comprehensive collection)
export const PRIME_SETS: PrimeSet[] = [
  // Warframes
  {
    id: 'ash_prime',
    name: 'Ash Prime',
    type: 'Warframe',
    category: 'Warframe',
    requiredParts: [
      { name: 'Ash Prime Blueprint', partType: 'Blueprint', ducats: 25, vaulted: true },
      { name: 'Ash Prime Systems', partType: 'Systems', ducats: 45, vaulted: true },
      { name: 'Ash Prime Chassis', partType: 'Chassis', ducats: 45, vaulted: true },
      { name: 'Ash Prime Neuroptics', partType: 'Neuroptics', ducats: 100, vaulted: true }
    ],
    vaulted: true,
    masteryRank: 0,
    releaseDate: '2015-07-07'
  },
  {
    id: 'atlas_prime',
    name: 'Atlas Prime',
    type: 'Warframe',
    category: 'Warframe',
    requiredParts: [
      { name: 'Atlas Prime Blueprint', partType: 'Blueprint', ducats: 25, vaulted: false },
      { name: 'Atlas Prime Systems', partType: 'Systems', ducats: 45, vaulted: false },
      { name: 'Atlas Prime Chassis', partType: 'Chassis', ducats: 45, vaulted: false },
      { name: 'Atlas Prime Neuroptics', partType: 'Neuroptics', ducats: 100, vaulted: false }
    ],
    vaulted: false,
    masteryRank: 0,
    releaseDate: '2019-10-01'
  },
  {
    id: 'banshee_prime',
    name: 'Banshee Prime',
    type: 'Warframe',
    category: 'Warframe',
    requiredParts: [
      { name: 'Banshee Prime Blueprint', partType: 'Blueprint', ducats: 25, vaulted: true },
      { name: 'Banshee Prime Systems', partType: 'Systems', ducats: 45, vaulted: true },
      { name: 'Banshee Prime Chassis', partType: 'Chassis', ducats: 45, vaulted: true },
      { name: 'Banshee Prime Neuroptics', partType: 'Neuroptics', ducats: 100, vaulted: true }
    ],
    vaulted: true,
    masteryRank: 0,
    releaseDate: '2017-02-28'
  },
  // Primary Weapons
  {
    id: 'braton_prime',
    name: 'Braton Prime',
    type: 'Primary',
    category: 'Assault Rifle',
    requiredParts: [
      { name: 'Braton Prime Blueprint', partType: 'Blueprint', ducats: 25, vaulted: false },
      { name: 'Braton Prime Barrel', partType: 'Barrel', ducats: 45, vaulted: false },
      { name: 'Braton Prime Receiver', partType: 'Receiver', ducats: 45, vaulted: false },
      { name: 'Braton Prime Stock', partType: 'Stock', ducats: 100, vaulted: false }
    ],
    vaulted: false,
    masteryRank: 2,
    releaseDate: '2013-05-03'
  },
  {
    id: 'paris_prime',
    name: 'Paris Prime',
    type: 'Primary',
    category: 'Bow',
    requiredParts: [
      { name: 'Paris Prime Blueprint', partType: 'Blueprint', ducats: 25, vaulted: true },
      { name: 'Paris Prime Grip', partType: 'Grip', ducats: 45, vaulted: true },
      { name: 'Paris Prime String', partType: 'String', ducats: 45, vaulted: true },
      { name: 'Paris Prime Upper Limb', partType: 'Upper Limb', ducats: 100, vaulted: true }
    ],
    vaulted: true,
    masteryRank: 4,
    releaseDate: '2013-03-18'
  },
  // Secondary Weapons
  {
    id: 'lex_prime',
    name: 'Lex Prime',
    type: 'Secondary',
    category: 'Pistol',
    requiredParts: [
      { name: 'Lex Prime Blueprint', partType: 'Blueprint', ducats: 25, vaulted: true },
      { name: 'Lex Prime Barrel', partType: 'Barrel', ducats: 45, vaulted: true },
      { name: 'Lex Prime Receiver', partType: 'Receiver', ducats: 100, vaulted: true }
    ],
    vaulted: true,
    masteryRank: 3,
    releaseDate: '2013-12-17'
  },
  // Melee Weapons
  {
    id: 'nikana_prime',
    name: 'Nikana Prime',
    type: 'Melee',
    category: 'Nikana',
    requiredParts: [
      { name: 'Nikana Prime Blueprint', partType: 'Blueprint', ducats: 25, vaulted: true },
      { name: 'Nikana Prime Blade', partType: 'Blade', ducats: 45, vaulted: true },
      { name: 'Nikana Prime Hilt', partType: 'Handle', ducats: 100, vaulted: true }
    ],
    vaulted: true,
    masteryRank: 4,
    releaseDate: '2016-07-05'
  }
  // Add more sets as needed...
];

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
const ownsItem = (itemName: string, inventory: DetectedItem[]): boolean => {
  return inventory.some(item =>
    item.name.toLowerCase() === itemName.toLowerCase() &&
    (item.quantity || 1) > 0
  );
};

// Check if user can obtain a part from owned relics
const canObtainFromRelics = (partName: string, relicsInventory: VoidRelic[]): boolean => {
  return relicsInventory.some(relic =>
    relic.relicDrops && relic.relicDrops.some(drop => {
      const dropName = drop.itemName.toLowerCase();
      const targetPart = partName.toLowerCase();

      // Check for exact match or if the drop name contains the part name
      return dropName === targetPart ||
             dropName.includes(targetPart.replace(' prime ', ' ')) ||
             (targetPart.includes('blueprint') && dropName.includes('blueprint')) ||
             (targetPart.includes('systems') && dropName.includes('systems')) ||
             (targetPart.includes('chassis') && dropName.includes('chassis')) ||
             (targetPart.includes('neuroptics') && dropName.includes('neuroptics'));
    })
  );
};

// Calculate cost for missing parts (placeholder - would need market data)
const calculateMissingCost = (missingParts: string[]): number => {
  // This would need to fetch market prices for missing parts
  // For now, return a placeholder value
  return missingParts.length * 50; // Placeholder: 50p per missing part
};

// Analyze set completion progress
export const analyzeSetProgress = (
  primePartsInventory: DetectedItem[],
  relicsInventory: VoidRelic[] = []
): SetProgress[] => {
  const masteredSets = getMasteredSets();

    return PRIME_SETS.map(set => {
    const ownedParts: string[] = [];
    const missingParts: string[] = [];
    const obtainableFromRelics: string[] = [];
    let totalCost = 0;

    // Check each required part
    set.requiredParts.forEach(part => {
      if (ownsItem(part.name, primePartsInventory)) {
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
export const getBuildableSets = (
  primePartsInventory: DetectedItem[],
  relicsInventory: VoidRelic[] = []
): SetProgress[] => {
  return analyzeSetProgress(primePartsInventory, relicsInventory)
    .filter(progress => progress.canBuild && !progress.ismastered)
    .sort((a, b) => b.completionPercentage - a.completionPercentage);
};

// Get sets with highest completion percentage
export const getNearCompleteSets = (
  primePartsInventory: DetectedItem[],
  relicsInventory: VoidRelic[] = [],
  minCompletion: number = 50
): SetProgress[] => {
  return analyzeSetProgress(primePartsInventory, relicsInventory)
    .filter(progress =>
      !progress.canBuild &&
      !progress.ismastered &&
      progress.completionPercentage >= minCompletion
    )
    .sort((a, b) => b.completionPercentage - a.completionPercentage);
};

// Get priority recommendations
export const getSetRecommendations = (
  primePartsInventory: DetectedItem[],
  relicsInventory: VoidRelic[] = []
): {
  buildable: SetProgress[];
  nearComplete: SetProgress[];
  highValue: SetProgress[];
} => {
  const allProgress = analyzeSetProgress(primePartsInventory, relicsInventory);

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