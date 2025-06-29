// Purpose: Unified image service using primesets.json as single source of truth
// Replaces: localImageService.ts (173 lines) + hardcoded mapping in PrimeSetsSection.tsx (127 lines)

/**
 * Unified Image Service - Single Source of Truth
 * Uses /public/primesets.json for both prime parts and prime sets
 * Eliminates duplicate image URL systems and 300+ lines of redundant code
 */

interface PrimeSet {
  name: string;
  image: string;
  category: string;
  components: Array<{
    name: string;
    count: number;
  }>;
}

// Cache for primesets.json to avoid repeated file loads
let primeSetsCache: PrimeSet[] | null = null;

/**
 * Loads primesets.json data - the single source of truth for all images
 */
const loadPrimeSets = async (): Promise<PrimeSet[]> => {
  if (primeSetsCache) {
    return primeSetsCache;
  }

  try {
    const response = await fetch('/primesets.json');
    if (!response.ok) {
      throw new Error(`Failed to load primesets.json: ${response.status}`);
    }
    primeSetsCache = await response.json();
    return primeSetsCache!;
  } catch (error) {
    console.error('Failed to load primesets.json:', error);
    return [];
  }
};

/**
 * Extracts parent set name from a prime part name
 * e.g., "Valkyr Prime Systems" → "Valkyr Prime"
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

  for (const suffix of sortedSuffixes) {
    if (partName.endsWith(` ${suffix}`)) {
      return partName.replace(` ${suffix}`, '');
    }
  }

  return partName; // Return original if no suffix found
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
    const primeSets = await loadPrimeSets();

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
        console.log(`🔗 Using parent set image for "${itemName}" → "${parentSetName}"`);
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
    console.warn(`⚠️ No image found for "${itemName}", using fallback`);
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
 * Synchronous version - only works if primesets.json is already cached
 * Use this when you know loadPrimeSets() has already been called
 */
export const getImageUrlSync = (itemName: string): string | null => {
  if (!primeSetsCache) {
    return null;
  }

  // Direct match
  const directMatch = primeSetsCache.find(set => set.name === itemName);
  if (directMatch) {
    return `/images/primeparts/${directMatch.image}`;
  }

  // Parent set match
  const parentSetName = getParentSetName(itemName);
  if (parentSetName !== itemName) {
    const parentMatch = primeSetsCache.find(set => set.name === parentSetName);
    if (parentMatch) {
      return `/images/primeparts/${parentMatch.image}`;
    }
  }

  // Set suffix match
  const setNameWithoutSuffix = itemName.replace(' Set', '');
  if (setNameWithoutSuffix !== itemName) {
    const setMatch = primeSetsCache.find(set => set.name === setNameWithoutSuffix);
    if (setMatch) {
      return `/images/primeparts/${setMatch.image}`;
    }
  }

  return null;
};

/**
 * Preloads primesets.json for faster subsequent calls
 */
export const preloadImageData = async (): Promise<void> => {
  await loadPrimeSets();
};

/**
 * Gets all available prime sets (useful for components that need the full list)
 */
export const getAllPrimeSets = async (): Promise<PrimeSet[]> => {
  return await loadPrimeSets();
};

export default {
  getImageUrl,
  getImageUrlSync,
  preloadImageData,
  getAllPrimeSets,
  getParentSetName
};