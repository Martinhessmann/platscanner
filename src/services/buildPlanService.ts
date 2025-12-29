// Purpose: Manages prime set build planning and item reservations
// Features: Track planned builds, reserve items, prevent accidental selling

import { VoidRelic } from '../types';
import { cloudSyncService } from './cloudSyncService';
import { reservationLogger } from './reservationLogger';

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
    const wasPriority = existing.isPriority;
    existing.isPriority = isPriority;
    if (notes) existing.notes = notes;
    reservationLogger.info('set_planning', `Updated build plan for "${setName}" (priority: ${wasPriority} → ${isPriority})`, {
      setName,
      wasPriority,
      isPriority,
      notes
    });
  } else {
    storage.buildPlans.push({
      setName,
      isPriority,
      dateAdded: Date.now(),
      notes
    });
    reservationLogger.info('set_planning', `Added "${setName}" to build plans (priority: ${isPriority})`, {
      setName,
      isPriority,
      notes,
      totalPlans: storage.buildPlans.length
    });
  }

  saveBuildPlans(storage);
};

/**
 * Remove a prime set from build plans (and unreserve related items)
 */
export const removeFromBuildPlan = (setName: string): void => {
  const storage = loadBuildPlans();

  const planExists = storage.buildPlans.some(plan => plan.setName === setName);
  if (!planExists) {
    reservationLogger.warn('set_planning', `Attempted to remove non-existent plan: "${setName}"`, {
      setName,
      existingPlans: storage.buildPlans.map(p => p.setName)
    });
    return;
  }

  // Track items that will be affected
  const affectedItems = storage.reservedItems
    .filter(item => item.reservedFor.includes(setName))
    .map(item => ({ itemName: item.itemName, category: item.category, reservedFor: [...item.reservedFor] }));

  // Remove build plan
  storage.buildPlans = storage.buildPlans.filter(plan => plan.setName !== setName);

  // Remove reservations for this set
  const beforeCount = storage.reservedItems.length;
  storage.reservedItems = storage.reservedItems
    .map(item => ({
      ...item,
      reservedFor: item.reservedFor.filter(planName => planName !== setName)
    }))
    .filter(item => item.reservedFor.length > 0); // Remove items with no reservations
  const afterCount = storage.reservedItems.length;
  const removedCount = beforeCount - afterCount;

  reservationLogger.info('cleanup', `Removed build plan for "${setName}"`, {
    setName,
    affectedItems: affectedItems.length,
    removedReservations: removedCount,
    remainingPlans: storage.buildPlans.length,
    remainingReservations: storage.reservedItems.length,
    affectedItemsDetails: affectedItems
  });

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
      reservationLogger.info('reservation_update', `Added "${setName}" to existing reservation for "${itemName}"`, {
        itemName,
        category,
        setName,
        reservedFor: existing.reservedFor
      });
    } else {
      reservationLogger.debug('reservation_update', `Item "${itemName}" already reserved for "${setName}"`, {
        itemName,
        category,
        setName
      });
    }
  } else {
    storage.reservedItems.push({
      itemName,
      category,
      reservedFor: [setName],
      dateReserved: Date.now()
    });
    reservationLogger.info('reservation_update', `Created new reservation for "${itemName}" → "${setName}"`, {
      itemName,
      category,
      setName,
      totalReservations: storage.reservedItems.length
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
  let matchType = reservation ? 'exact' : null;

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
    if (reservation) {
      matchType = 'fuzzy';
    }
  }

  // Log reservation checks (debug level for verbose logging)
  reservationLogger.debug('reservation_check', `Checking reservation for "${itemName}" (${category})`, {
    itemName,
    category,
    matchType,
    found: !!reservation,
    matchedItemName: reservation?.itemName,
    reservedFor: reservation?.reservedFor || []
  });

  if (!reservation) {
    return { reserved: false, reservedFor: [], isPriority: false };
  }

  // Check if any of the sets this is reserved for are priority
  const reservedForSets = reservation.reservedFor;
  const activePlans = reservedForSets
    .map(setName => storage.buildPlans.find(plan => plan.setName === setName))
    .filter(plan => plan !== undefined);
  const isPriority = activePlans.some(plan => plan?.isPriority);

  // Log warning if reservation exists but set is not in build plans
  const orphanedReservations = reservedForSets.filter(setName => 
    !storage.buildPlans.some(plan => plan.setName === setName)
  );
  
  if (orphanedReservations.length > 0) {
    reservationLogger.warn('reservation_check', `Found orphaned reservation for "${itemName}"`, {
      itemName,
      category,
      reservedFor: reservedForSets,
      orphanedSets: orphanedReservations,
      activePlans: activePlans.map(p => p?.setName),
      allPlans: storage.buildPlans.map(p => p.setName)
    });
  }

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
  requiredParts: string[] = [],
  ownedParts: string[] = [],
  relicsInventory?: VoidRelic[]
): void => {
  // Ensure requiredParts is an array
  if (!Array.isArray(requiredParts)) {
    reservationLogger.warn('reservation_update', 'autoReserveItemsForSet: requiredParts is not an array, skipping reservation', {
      setName,
      requiredPartsType: typeof requiredParts
    });
    return;
  }

  reservationLogger.info('reservation_update', `Auto-reserving items for "${setName}"`, {
    setName,
    requiredPartsCount: requiredParts.length,
    ownedPartsCount: ownedParts.length,
    relicsInventoryCount: relicsInventory?.length || 0
  });

  // Reserve ALL required prime parts (both owned and missing)
  // Owned parts are reserved to prevent accidental selling
  // Missing parts are reserved to track what we need
  requiredParts.forEach(partName => {
    reserveItem(partName, 'prime_parts', setName);
  });

  // Only reserve relics for missing parts (avoid unnecessary relic reservations)
  const missingParts = requiredParts.filter(part => !ownedParts.includes(part));

  reservationLogger.debug('reservation_update', `Reserving relics for missing parts of "${setName}"`, {
    setName,
    missingPartsCount: missingParts.length,
    missingParts
  });

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

  const finalStorage = loadBuildPlans();
  const reservedParts = finalStorage.reservedItems.filter(item => 
    item.category === 'prime_parts' && item.reservedFor.includes(setName)
  );
  const reservedRelics = finalStorage.reservedItems.filter(item => 
    item.category === 'relics' && item.reservedFor.includes(setName)
  );

  reservationLogger.info('reservation_update', `Auto-reservation complete for "${setName}"`, {
    setName,
    reservedPartsCount: reservedParts.length,
    reservedRelicsCount: reservedRelics.length,
    reservedParts: reservedParts.map(p => p.itemName),
    reservedRelics: reservedRelics.map(r => r.itemName)
  });
};

/**
 * Update all reservations for existing build plans
 * This is used to batch update all reservations when inventory changes
 */
export const updateAllReservations = (
  sets?: Array<{
    set: { name: string, requiredParts: Array<{ name: string, partType: string }> },
    ownedParts: string[]
  }>,
  relicsInventory?: VoidRelic[]
): void => {
  // First, clear all existing reservations (both prime parts and relics)
  const storage = loadBuildPlans();
  const clearedCount = storage.reservedItems.length;
  storage.reservedItems = [];
  saveBuildPlans(storage);

  reservationLogger.info('cleanup', `Cleared all reservations (${clearedCount} items)`, {
    clearedCount,
    plannedSets: storage.buildPlans.length
  });

  // If no sets provided, just clear reservations and return
  if (!sets || !Array.isArray(sets)) {
    reservationLogger.warn('cleanup', 'updateAllReservations: No sets provided, only clearing reservations', {
      setsProvided: false
    });
    return;
  }

  // Then, recreate reservations for all planned sets
  const plannedSets = getAllPlannedSets();
  const activePlans = plannedSets.map(p => p.setName);

  reservationLogger.info('cleanup', `Updating reservations for ${activePlans.length} planned sets`, {
    plannedSets: activePlans,
    totalSets: sets.length
  });

  sets.forEach(({ set, ownedParts }) => {
    const isPlanActive = plannedSets.some(plan => plan.setName === set.name);

    if (isPlanActive) {
      const requiredPartNames = set.requiredParts.map(part => `${set.name} ${part.partType}`);
      reservationLogger.debug('cleanup', `Recreating reservations for "${set.name}"`, {
        setName: set.name,
        requiredParts: requiredPartNames.length,
        ownedParts: ownedParts.length
      });
      autoReserveItemsForSet(set.name, requiredPartNames, ownedParts, relicsInventory);
    }
  });

  const finalStorage = loadBuildPlans();
  reservationLogger.info('cleanup', `Reservation update complete`, {
    finalReservationCount: finalStorage.reservedItems.length,
    plannedSets: finalStorage.buildPlans.length
  });
};

/**
 * Combined function to toggle set planning status
 * Handles both adding/removing from build plan and managing reservations
 */
export const toggleSetPlanning = (
  setName: string,
  isPriority: boolean = false,
  setData?: {
    requiredParts: string[],
    ownedParts: string[],
    relicsInventory?: VoidRelic[]
  }
): void => {
  const currentStatus = isSetPlanned(setName);
  
  if (currentStatus.planned) {
    // Remove from build plan
    removeFromBuildPlan(setName);
  } else {
    // Add to build plan
    addToBuildPlan(setName, isPriority);
    
    // Optionally auto-reserve items if set data is provided
    if (setData) {
      autoReserveItemsForSet(
        setName,
        setData.requiredParts,
        setData.ownedParts,
        setData.relicsInventory
      );
    }
  }
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