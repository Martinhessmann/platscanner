// Purpose: Manages prime set build planning and item reservations
// Features: Track planned builds, reserve items, prevent accidental selling

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
  const reservation = storage.reservedItems.find(item => item.itemName === itemName && item.category === category);

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
 */
export const autoReserveItemsForSet = (setName: string, requiredParts: string[]): void => {
  // This would be called from the Prime Sets component when adding a set to build plans
  requiredParts.forEach(partName => {
    reserveItem(partName, 'prime_parts', setName);
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