// Purpose: Global singleton service for static game data (Prime Sets & Relics)
// This service loads JSON data ONCE and caches it to prevent excessive re-loading
// Only user inventory changes should trigger re-analysis, not static data reloading

import { PrimeSet } from './primeSetService';

// Global caches - loaded once and reused
let primeSetsCache: PrimeSet[] | null = null;
let relicsDataCache: any[] | null = null;
let isLoadingPrimeSets = false;
let isLoadingRelics = false;

/**
 * Load Prime Sets data once and cache it globally
 * Subsequent calls return the cached data instantly
 */
export const loadPrimeSetsData = async (): Promise<PrimeSet[]> => {
  // Return cached data if already loaded
  if (primeSetsCache) {
    return primeSetsCache;
  }

  // Prevent duplicate loading if already in progress
  if (isLoadingPrimeSets) {
    // Wait for the current loading to complete
    while (isLoadingPrimeSets) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    return primeSetsCache || [];
  }

  try {
    isLoadingPrimeSets = true;
    console.log('📦 [Static Data] Loading Prime Sets data (once)...');

    const response = await fetch('/primesets.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch prime sets: ${response.statusText}`);
    }

    const data = await response.json();
    primeSetsCache = data;

    console.log(`✅ [Static Data] Loaded ${data.length} prime sets (cached)`);
    return data;

  } catch (error) {
    console.error('❌ [Static Data] Failed to load prime sets:', error);
    throw error;
  } finally {
    isLoadingPrimeSets = false;
  }
};

/**
 * Load Relics data once and cache it globally
 * Subsequent calls return the cached data instantly
 */
export const loadRelicsData = async (): Promise<any[]> => {
  // Return cached data if already loaded
  if (relicsDataCache) {
    return relicsDataCache;
  }

  // Prevent duplicate loading if already in progress
  if (isLoadingRelics) {
    // Wait for the current loading to complete
    while (isLoadingRelics) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    return relicsDataCache || [];
  }

  try {
    isLoadingRelics = true;
    console.log('📦 [Static Data] Loading Relics data (once)...');

    const response = await fetch('/relics.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch relics data: ${response.statusText}`);
    }

    const allItems = await response.json();
    // Filter for relics only (by type, not category)
    const filteredRelics = allItems.filter((item: any) => item.type === 'Relic');
    relicsDataCache = filteredRelics;

    console.log(`✅ [Static Data] Loaded ${filteredRelics.length} relics (cached)`);
    return filteredRelics;

  } catch (error) {
    console.error('❌ [Static Data] Failed to load relics data:', error);
    throw error;
  } finally {
    isLoadingRelics = false;
  }
};

/**
 * Get cached Prime Sets data (must be loaded first)
 */
export const getPrimeSetsCache = (): PrimeSet[] | null => {
  return primeSetsCache;
};

/**
 * Get cached Relics data (must be loaded first)
 */
export const getRelicsCache = (): any[] | null => {
  return relicsDataCache;
};

/**
 * Force reload static data (only use when needed)
 */
export const invalidateStaticDataCache = (): void => {
  console.log('🔄 [Static Data] Invalidating caches...');
  primeSetsCache = null;
  relicsDataCache = null;
  isLoadingPrimeSets = false;
  isLoadingRelics = false;
};

/**
 * Initialize all static data on app startup
 * Call this once when the app loads
 */
export const initializeStaticData = async (): Promise<void> => {
  console.log('🚀 [Static Data] Initializing static data...');

  try {
    // Load both datasets in parallel
    await Promise.all([
      loadPrimeSetsData(),
      loadRelicsData()
    ]);

    console.log('✅ [Static Data] All static data initialized');
  } catch (error) {
    console.error('❌ [Static Data] Failed to initialize static data:', error);
    throw error;
  }
};