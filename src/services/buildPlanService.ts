// Purpose: Manages prime set build planning and item reservations
// Features: Track planned builds, reserve items, prevent accidental selling

import { VoidRelic } from '../types';
import { cloudSyncService } from './cloudSyncService';

interface BuildPlan {
  setName: string;
  isPriority: boolean; // High priority builds (user really wants this)
  dateAdded: number;
  notes?: string;
}

interface ReservedItem {
  itemName: string;
  category: 'prime_parts' | 'relics';
  reservedFor: string[]; // Array of set names this item is reserved for
  dateReserved: number;
}

interface BuildPlanStorage {
  buildPlans: BuildPlan[];
  reservedItems: ReservedItem[];
  version: number;
}

const STORAGE_KEY = 'platscanner_build_plans';
const STORAGE_VERSION = 1;

/**
 * Load build plans from localStorage
 */
export const loadBuildPlans = (): BuildPlanStorage => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      if (data.version === STORAGE_VERSION) {
        return data;
      }
    }
  } catch (error) {
    console.error('Failed to load build plans:', error);
  }

  // Return default structure
  return {
    buildPlans: [],
    reservedItems: [],
    version: STORAGE_VERSION
  };
};

/**
 * Save build plans to localStorage
 */
export const saveBuildPlans = (data: BuildPlanStorage): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Notify cloud sync of local data modification
    cloudSyncService.onLocalDataModified().catch(error => {
      console.error('Failed to sync build plan changes to cloud:', error);
    });
  } catch (error) {
    console.error('Failed to save build plans:', error);
  }
};

/**
 * Add a prime set to build plans
 */
export const addToBuildPlan = (setName: string, isPriority: boolean = false, notes?: string): void => {
  const storage = loadBuildPlans();

  // Check if already exists
  const existing = storage.buildPlans.find(plan => plan.setName === setName);
  if (existing) {
    // Update priority if different
    existing.isPriority = isPriority;
    if (notes) existing.notes = notes;
  } else {
    storage.buildPlans.push({
      setName,
      isPriority,
      dateAdded: Date.now(),
      notes
    });
  }

  saveBuildPlans(storage);
};

/**
 * Remove a prime set from build plans (and unreserve related items)
 */
export const removeFromBuildPlan = (setName: string): void => {
  const storage = loadBuildPlans();

  // Remove build plan
  storage.buildPlans = storage.buildPlans.filter(plan => plan.setName !== setName);

  // Remove reservations for this set
  storage.reservedItems = storage.reservedItems
    .map(item => ({
      ...item,
      reservedFor: item.reservedFor.filter(planName => planName !== setName)
    }))
    .filter(item => item.reservedFor.length > 0); // Remove items with no reservations

  saveBuildPlans(storage);
};

/**
 * Check if a set is in build plans
 */
export const isSetPlanned = (setName: string): { planned: boolean; isPriority: boolean } => {
  const storage = loadBuildPlans();
  const plan = storage.buildPlans.find(p => p.setName === setName);
  return {
    planned: !!plan,
    isPriority: plan?.isPriority || false
  };
};

/**
 * Get all planned sets
 */
export const getAllPlannedSets = (): BuildPlan[] => {
  const storage = loadBuildPlans();
  return storage.buildPlans.sort((a, b) => {
    // Priority sets first, then by date added
    if (a.isPriority !== b.isPriority) {
      return a.isPriority ? -1 : 1;
    }
    return b.dateAdded - a.dateAdded;
  });
};

/**
 * Reserve an item for building a specific set
 */
export const reserveItem = (itemName: string, category: 'prime_parts' | 'relics', setName: string): void => {
  const storage = loadBuildPlans();

  const existing = storage.reservedItems.find(item => item.itemName === itemName && item.category === category);
  if (existing) {
    // Add to existing reservation if not already there
    if (!existing.reservedFor.includes(setName)) {
      existing.reservedFor.push(setName);
    }
  } else {
    storage.reservedItems.push({
      itemName,
      category,
      reservedFor: [setName],
      dateReserved: Date.now()
    });
  }

  saveBuildPlans(storage);
};

/**
 * Unreserve an item for a specific set
 */
export const unreserveItem = (itemName: string, category: 'prime_parts' | 'relics', setName: string): void => {
  const storage = loadBuildPlans();

  storage.reservedItems = storage.reservedItems
    .map(item => {
      if (item.itemName === itemName && item.category === category) {
        return {
          ...item,
          reservedFor: item.reservedFor.filter(planName => planName !== setName)
        };
      }
      return item;
    })
    .filter(item => item.reservedFor.length > 0);

  saveBuildPlans(storage);
};

/**
 * Check if an item is reserved
 */
export const isItemReserved = (itemName: string, category: 'prime_parts' | 'relics'): {
  reserved: boolean;
  reservedFor: string[];
  isPriority: boolean;
} => {
  const storage = loadBuildPlans();

  // First try exact match
  let reservation = storage.reservedItems.find(item => item.itemName === itemName && item.category === category);

  // If no exact match found for prime parts, try fuzzy matching
  if (!reservation && category === 'prime_parts') {
    // Try matching with/without "Blueprint" suffix
    const baseItemName = itemName.replace(/ Blueprint$/, '');
    const itemNameWithBlueprint = itemName.endsWith(' Blueprint') ? itemName : `${itemName} Blueprint`;

    reservation = storage.reservedItems.find(item =>
      item.category === category && (
        item.itemName === baseItemName ||
        item.itemName === itemNameWithBlueprint ||
        item.itemName.replace(/ Blueprint$/, '') === baseItemName
      )
    );
  }

    // Optional: Add debug logging for specific items (can be removed in production)
  const shouldDebugLog = false; // Set to true for debugging specific items
  if (shouldDebugLog && itemName.toLowerCase().includes('debug_item_name')) {
    console.log(`>>> [Reservation Check] Checking reservation for "${itemName}" (${category}) <<<`);
    if (reservation) {
      console.log(`>>> [Reservation Check] Found match: "${reservation.itemName}" <<<`);
    } else {
      console.log(`>>> [Reservation Check] No match found for "${itemName}" <<<`);
    }
  }

  if (!reservation) {
    return { reserved: false, reservedFor: [], isPriority: false };
  }

  // Check if any of the sets this is reserved for are priority
  const isPriority = reservation.reservedFor.some(setName =>
    storage.buildPlans.find(plan => plan.setName === setName)?.isPriority
  );

  return {
    reserved: true,
    reservedFor: reservation.reservedFor,
    isPriority
  };
};

/**
 * Get all reserved items
 */
export const getAllReservedItems = (): ReservedItem[] => {
  const storage = loadBuildPlans();
  return storage.reservedItems;
};

/**
 * Automatically reserve items when a set is added to build plans
 * @param setName Name of the prime set
 * @param requiredParts All required parts for the set
 * @param ownedParts Parts the user already owns (to avoid reserving relics for these)
 * @param relicsInventory Available relics inventory
 */
export const autoReserveItemsForSet = (
  setName: string,
  requiredParts: string[],
  ownedParts: string[] = [],
  relicsInventory?: VoidRelic[]
): void => {
  // Reserve ALL required prime parts (both owned and missing)
  // Owned parts are reserved to prevent accidental selling
  // Missing parts are reserved to track what we need
  requiredParts.forEach(partName => {
    reserveItem(partName, 'prime_parts', setName);
  });

  // Only reserve relics for missing parts (avoid unnecessary relic reservations)
  const missingParts = requiredParts.filter(part => !ownedParts.includes(part));

    // Also reserve relics that contain these MISSING parts
  if (relicsInventory && relicsInventory.length > 0) {
    missingParts.forEach(partName => {
            const relicsContainingPart = relicsInventory.filter(relic => {
        if (!relic.relicDrops) return false;

        const hasMatch = relic.relicDrops.some(drop => {
          const dropName = drop.itemName.toLowerCase();
          const targetPart = partName.toLowerCase();

          // Use the same smart matching logic as the prime set service
          // Check for exact match first
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

        return hasMatch;
      });

      relicsContainingPart.forEach(relic => {
        reserveItem(relic.name, 'relics', setName);
      });
    });
  }
};

/**
 * Update all reservations for existing build plans
 * This is used to batch update all reservations when inventory changes
 */
export const updateAllReservations = (
  sets: Array<{
    set: { name: string, requiredParts: Array<{ name: string, partType: string }> },
    ownedParts: string[]
  }>,
  relicsInventory: VoidRelic[]
): void => {
  // First, clear all existing reservations (both prime parts and relics)
  const storage = loadBuildPlans();
  storage.reservedItems = [];
  saveBuildPlans(storage);

  // Then, recreate reservations for all planned sets
  const plannedSets = getAllPlannedSets();

  sets.forEach(({ set, ownedParts }) => {
    const isPlanActive = plannedSets.some(plan => plan.setName === set.name);

    if (isPlanActive) {
      const requiredPartNames = set.requiredParts.map(part => `${set.name} ${part.partType}`);
      autoReserveItemsForSet(set.name, requiredPartNames, ownedParts, relicsInventory);
    }
  });
};

/**
 * Get reservation warnings for selling items
 */
export const getSellingWarnings = (itemNames: string[], category: 'prime_parts' | 'relics'): string[] => {
  const warnings: string[] = [];

  itemNames.forEach(itemName => {
    const reservation = isItemReserved(itemName, category);
    if (reservation.reserved) {
      const setsText = reservation.reservedFor.join(', ');
      const priorityText = reservation.isPriority ? ' (HIGH PRIORITY)' : '';
      warnings.push(`"${itemName}" is reserved for: ${setsText}${priorityText}`);
    }
  });

  return warnings;
};