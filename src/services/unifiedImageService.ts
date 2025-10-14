// Purpose: Unified image service using primesets.json as single source of truth
// Replaces: localImageService.ts (173 lines) + hardcoded mapping in PrimeSetsSection.tsx (127 lines)

/**
 * Unified Image Service - Single Source of Truth
 * Uses staticDataService for centralized primesets.json access
 * Eliminates duplicate image URL systems and 300+ lines of redundant code
 */

import { getPrimeSetsCache } from './staticDataService';

interface PrimeSet {
  name: string;
  image: string;
  category: string;
  components: Array<{
    name: string;
    count: number;
  }>;
}

/**
 * Gets primesets data from centralized cache
 * @returns Prime sets array from staticDataService cache
 */
const getCachedPrimeSets = (): PrimeSet[] => {
  const cached = getPrimeSetsCache();
  if (!cached) {
    console.error('Prime sets cache not initialized. Call initializeStaticData() first.');
    return [];
  }
  return cached as PrimeSet[];
};

/**
 * Extracts parent set name from a prime part name
 * e.g., "Valkyr Prime Systems" → "Valkyr Prime"
 * e.g., "Oberon Prime Neuroptics Blueprint" → "Oberon Prime"
 */
const getParentSetName = (partName: string): string => {
  // Common prime part suffixes to remove
  const partSuffixes = [
    'Blueprint', 'Chassis', 'Neuroptics', 'Systems',
    'Barrel', 'Receiver', 'Stock', 'Blade', 'Handle',
    'Grip', 'String', 'Link', 'Guard', 'Hilt',
    'Upper Limb', 'Lower Limb', 'Carapace', 'Cerebrum',
    'Wings', 'Harness', 'Gauntlet', 'Pouch', 'Stars',
    'Boot', 'Chain', 'Disc', 'Head', 'Ornament',
    'Band', 'Buckle', 'Blades'
  ];

  // Sort by length (descending) to match longer suffixes first
  const sortedSuffixes = partSuffixes.sort((a, b) => b.length - a.length);

  let result = partName;
  let changed = true;
  
  // Keep removing suffixes until no more can be removed (handles compound suffixes)
  while (changed) {
    changed = false;
    for (const suffix of sortedSuffixes) {
      if (result.endsWith(` ${suffix}`)) {
        result = result.replace(` ${suffix}`, '');
        changed = true;
        break; // Start over from the beginning after each change
      }
    }
  }

  return result;
};

/**
 * Gets the image URL for ANY prime item (part or set)
 * This is the ONLY function needed for all image URLs
 *
 * @param itemName - Name of prime part or set (e.g., "Valkyr Prime Systems", "Sevagoth Prime")
 * @returns Image URL path or fallback
 */
export const getImageUrl = async (itemName: string): Promise<string> => {
  try {
    const primeSets = getCachedPrimeSets();

    // Direct set match (e.g., "Sevagoth Prime")
    const directMatch = primeSets.find(set => set.name === itemName);
    if (directMatch) {
      return `/images/primeparts/${directMatch.image}`;
    }

    // Part match - extract parent set name (e.g., "Valkyr Prime Systems" → "Valkyr Prime")
    const parentSetName = getParentSetName(itemName);
    if (parentSetName !== itemName) {
      const parentMatch = primeSets.find(set => set.name === parentSetName);
      if (parentMatch) {
        return `/images/primeparts/${parentMatch.image}`;
      }
    }

    // Handle "Set" suffix (e.g., "Valkyr Prime Set" → "Valkyr Prime")
    const setNameWithoutSuffix = itemName.replace(' Set', '');
    if (setNameWithoutSuffix !== itemName) {
      const setMatch = primeSets.find(set => set.name === setNameWithoutSuffix);
      if (setMatch) {
        return `/images/primeparts/${setMatch.image}`;
      }
    }

    // Fallback: normalize name and try to construct filename
    const normalizedName = itemName.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/&/g, '')
      .replace(/'/g, '');

    return `/images/primeparts/${normalizedName}.png`;
  } catch (error) {
    console.error(`Failed to get image for ${itemName}:`, error);
    return '/images/primeparts/unknown.png';
  }
};

/**
 * Synchronous version - uses centralized cache
 * Assumes initializeStaticData() has been called first
 */
export const getImageUrlSync = (itemName: string): string | null => {
  const primeSets = getCachedPrimeSets();

  if (primeSets.length === 0) {
    return null;
  }

  // Direct match
  const directMatch = primeSets.find(set => set.name === itemName);
  if (directMatch) {
    return `/images/primeparts/${directMatch.image}`;
  }

  // Parent set match
  const parentSetName = getParentSetName(itemName);
  if (parentSetName !== itemName) {
    const parentMatch = primeSets.find(set => set.name === parentSetName);
    if (parentMatch) {
      return `/images/primeparts/${parentMatch.image}`;
    }
  }

  // Set suffix match
  const setNameWithoutSuffix = itemName.replace(' Set', '');
  if (setNameWithoutSuffix !== itemName) {
    const setMatch = primeSets.find(set => set.name === setNameWithoutSuffix);
    if (setMatch) {
      return `/images/primeparts/${setMatch.image}`;
    }
  }

  return null;
};

/**
 * Preloads primesets.json for faster subsequent calls
 * Note: With centralized cache, this is handled by initializeStaticData()
 */
export const preloadImageData = async (): Promise<void> => {
  // No-op: Data is preloaded by initializeStaticData()
  // Keeping for backward compatibility
};

/**
 * Gets all available prime sets (useful for components that need the full list)
 */
export const getAllPrimeSets = async (): Promise<PrimeSet[]> => {
  return getCachedPrimeSets();
};

export default {
  getImageUrl,
  getImageUrlSync,
  preloadImageData,
  getAllPrimeSets,
  getParentSetName
};