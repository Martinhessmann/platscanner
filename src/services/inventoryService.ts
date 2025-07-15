// Purpose: Handle persistent inventory storage and management
// Supports Story #3: Persistent Inventory across sessions
// Extended for Story #8: Support for multiple item categories (Prime Parts, Relics, etc.)

import { DetectedItem, PrimePart, VoidRelic, ItemCategory, RelicRewardItem } from '../types';
import { getRelicDropsByName } from './relicDataService';
import { fetchSinglePriceData, fetchBatchPriceData } from './warframeMarketService';
import { cloudSyncService } from './cloudSyncService';
import { getImageUrl } from './unifiedImageService';

const INVENTORY_STORAGE_KEY = 'platscanner_inventory';
const LAST_SCAN_STORAGE_KEY = 'platscanner_last_scan';

// Last refresh tracking for each module
const PRIME_PARTS_LAST_REFRESH_KEY = 'platscanner_prime_parts_last_refresh';
const RELICS_LAST_REFRESH_KEY = 'platscanner_relics_last_refresh';

export interface InventoryItem {
  id: string;
  name: string;
  category: ItemCategory;
  quantity?: number; // Number of this item owned (default: 1)
  imgUrl?: string;
  price?: number;
  ducats?: number;
  volume?: number;
  average?: number;
  status: 'loading' | 'loaded' | 'error';
  error?: string;
  addedAt: Date;
  lastUpdated: Date;
  scanSession?: string; // Which scan session this item came from

  // Relic analysis properties (for VoidRelic items)
  rarity?: 'intact' | 'exceptional' | 'flawless' | 'radiant';
  relicDrops?: RelicRewardItem[];
  minDropValue?: number;
  maxDropValue?: number;
  expectedDropValue?: number;
  directSalePrice?: number;
  recommendation?: 'OPEN' | 'SELL' | 'REFINE_TO_EXCEPTIONAL' | 'REFINE_TO_FLAWLESS' | 'REFINE_TO_RADIANT';
  expectedProfit?: number;
  refinementAnalysis?: {
    platPerVoidTrace?: number;
    bestRefinementTarget?: 'exceptional' | 'flawless' | 'radiant';
    bestRefinementCost?: number;
    bestRefinementGain?: number;
    // New optimal analysis fields
    optimalMarketPrice?: number;
    optimalMarketPriceFallback?: string; // 'exact', 'fallback_flawless', etc.
    reasoning?: string; // Human-readable explanation
    comparison?: string; // Comparison details
  };
}

export interface CategorizedInventory {
  prime_parts: InventoryItem[];
  relics: InventoryItem[];
}

export interface InventoryStorage {
  items: InventoryItem[];
  lastScanDate: Date;
  version: string;
}

/**
 * Save detected items to persistent inventory
 */
export const saveToInventory = (items: DetectedItem[], sessionId?: string): void => {
  try {
    const currentInventory = loadInventory();
    const now = new Date();

    // Convert DetectedItems to InventoryItems
    const inventoryItems: InventoryItem[] = items.map(item => {
      const baseItem = {
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        imgUrl: item.imgUrl,
        price: item.price,
        ducats: item.ducats,
        volume: item.volume,
        average: item.average,
        status: item.status,
        error: item.error,
        addedAt: now,
        lastUpdated: now,
        scanSession: sessionId || `scan_${Date.now()}`
      };

      // Include relic analysis properties for VoidRelic items
      if (item.category === 'relics' && 'expectedDropValue' in item) {
        const relicItem = item as VoidRelic;
        return {
          ...baseItem,
          rarity: relicItem.rarity,
          relicDrops: relicItem.relicDrops,
          minDropValue: relicItem.minDropValue,
          maxDropValue: relicItem.maxDropValue,
          expectedDropValue: relicItem.expectedDropValue,
          directSalePrice: relicItem.directSalePrice,
          recommendation: relicItem.recommendation,
          expectedProfit: relicItem.expectedProfit,
          refinementAnalysis: relicItem.refinementAnalysis
        };
      }

      return baseItem;
    });

    // Merge with existing inventory (avoid duplicates by name)
    const updatedItems = [...currentInventory.items];

    inventoryItems.forEach(newItem => {
      const existingIndex = updatedItems.findIndex(existing => existing.name === newItem.name);
      if (existingIndex >= 0) {
        // Update existing item with latest data but preserve addedAt
        updatedItems[existingIndex] = {
          ...newItem,
          addedAt: updatedItems[existingIndex].addedAt,
          lastUpdated: now
        };
      } else {
        // Add new item
        updatedItems.push(newItem);
      }
    });

    const updatedInventory: InventoryStorage = {
      items: updatedItems,
      lastScanDate: now,
      version: '1.5.0' // Update version to reflect new features
    };

    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(updatedInventory));
    localStorage.setItem(LAST_SCAN_STORAGE_KEY, now.toISOString());

    // Notify cloud sync of local data modification
    cloudSyncService.onLocalDataModified().catch(error => {
      console.error('Failed to sync inventory changes to cloud:', error);
    });
  } catch (error) {
    console.error('Failed to save inventory:', error);
  }
};

/**
 * Load persistent inventory from localStorage
 */
export const loadInventory = (): InventoryStorage => {
  try {
    const stored = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (!stored) {
      return {
        items: [],
        lastScanDate: new Date(),
        version: '1.3.0'
      };
    }

    const parsed = JSON.parse(stored);

    // Convert date strings back to Date objects
    const inventory: InventoryStorage = {
      ...parsed,
      lastScanDate: new Date(parsed.lastScanDate),
      items: parsed.items.map((item: any) => ({
        ...item,
        addedAt: new Date(item.addedAt),
        lastUpdated: new Date(item.lastUpdated)
      }))
    };

    return inventory;
  } catch (error) {
    console.error('Failed to load inventory:', error);
    return {
      items: [],
      lastScanDate: new Date(),
      version: '1.3.0'
    };
  }
};

/**
 * Get inventory organized by category
 */
export const getCategorizedInventory = (): CategorizedInventory => {
  const inventory = loadInventory();

  return {
    prime_parts: inventory.items.filter(item => item.category === 'prime_parts'),
    relics: inventory.items.filter(item => item.category === 'relics')
  };
};

/**
 * Remove item from persistent inventory
 */
export const removeFromInventory = (itemName: string): void => {
  try {
    const currentInventory = loadInventory();
    const updatedItems = currentInventory.items.filter(item => item.name !== itemName);

    const updatedInventory: InventoryStorage = {
      ...currentInventory,
      items: updatedItems,
      lastScanDate: new Date()
    };

    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(updatedInventory));

    // Notify cloud sync of local data modification
    cloudSyncService.onLocalDataModified().catch(error => {
      console.error('Failed to sync inventory changes to cloud:', error);
    });
  } catch (error) {
    console.error('Failed to remove item from inventory:', error);
  }
};

/**
 * Clear entire persistent inventory
 */
export const clearInventory = (): void => {
  try {
    localStorage.removeItem(INVENTORY_STORAGE_KEY);
    localStorage.removeItem(LAST_SCAN_STORAGE_KEY);

    // Mark this as an intentional deletion to prevent cloud sync from restoring data
    cloudSyncService.markIntentionalDeletion('inventory');

    // Notify cloud sync of local data modification
    cloudSyncService.onLocalDataModified().catch(error => {
      console.error('Failed to sync inventory changes to cloud:', error);
    });
  } catch (error) {
    console.error('Failed to clear inventory:', error);
  }
};

/**
 * Clear inventory by category
 */
export const clearInventoryByCategory = (category: ItemCategory): void => {
  try {
    const currentInventory = loadInventory();
    const updatedItems = currentInventory.items.filter(item => item.category !== category);

    const updatedInventory: InventoryStorage = {
      ...currentInventory,
      items: updatedItems,
      lastScanDate: new Date()
    };

    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(updatedInventory));

    // Mark this as an intentional deletion if clearing all data
    if (updatedItems.length === 0) {
      cloudSyncService.markIntentionalDeletion('inventory');
    }

    // Notify cloud sync of local data modification
    cloudSyncService.onLocalDataModified().catch(error => {
      console.error('Failed to sync inventory changes to cloud:', error);
    });
  } catch (error) {
    console.error('Failed to clear category inventory:', error);
  }
};

/**
 * Update prices for items in persistent inventory
 */
export const updateInventoryPrices = (updatedItems: DetectedItem[]): void => {
  try {
    const currentInventory = loadInventory();
    const now = new Date();

    // Update prices for existing items
    const updatedInventoryItems = currentInventory.items.map(inventoryItem => {
      const updatedItem = updatedItems.find(item => item.name === inventoryItem.name);
      if (updatedItem) {
        const baseUpdate = {
          ...inventoryItem,
          ...updatedItem,
          quantity: updatedItem.quantity || inventoryItem.quantity, // Preserve or update quantity
          addedAt: inventoryItem.addedAt, // Preserve original add date
          lastUpdated: now
        };

        // Include relic analysis properties for VoidRelic items
        if (updatedItem.category === 'relics' && 'expectedDropValue' in updatedItem) {
          const relicItem = updatedItem as VoidRelic;
          return {
            ...baseUpdate,
            rarity: relicItem.rarity,
            relicDrops: relicItem.relicDrops,
            minDropValue: relicItem.minDropValue,
            maxDropValue: relicItem.maxDropValue,
            expectedDropValue: relicItem.expectedDropValue,
            directSalePrice: relicItem.directSalePrice,
            recommendation: relicItem.recommendation,
            expectedProfit: relicItem.expectedProfit,
            refinementAnalysis: relicItem.refinementAnalysis
          };
        }

        return baseUpdate;
      }
      return inventoryItem;
    });

    const updatedInventory: InventoryStorage = {
      ...currentInventory,
      items: updatedInventoryItems,
      lastScanDate: now
    };

    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(updatedInventory));

    // Notify cloud sync of local data modification
    cloudSyncService.onLocalDataModified().catch(error => {
      console.error('Failed to sync inventory changes to cloud:', error);
    });
  } catch (error) {
    console.error('Failed to update inventory prices:', error);
  }
};

/**
 * Get summary statistics for the inventory
 */
export const getInventoryStats = (): {
  totalItems: number;
  totalValue: number;
  totalDucats: number;
  lastScanDate: Date;
  byCategory: Record<ItemCategory, { count: number; value: number; ducats: number }>;
} => {
  const inventory = loadInventory();
  const categorized = getCategorizedInventory();

  const totalValue = inventory.items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
  const totalDucats = inventory.items.reduce((sum, item) => sum + ((item.ducats || 0) * (item.quantity || 1)), 0);

  const byCategory: Record<ItemCategory, { count: number; value: number; ducats: number }> = {
    prime_parts: {
      count: categorized.prime_parts.reduce((sum, item) => sum + (item.quantity || 1), 0),
      value: categorized.prime_parts.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0),
      ducats: categorized.prime_parts.reduce((sum, item) => sum + ((item.ducats || 0) * (item.quantity || 1)), 0)
    },
    relics: {
      count: categorized.relics.reduce((sum, item) => sum + (item.quantity || 1), 0),
      value: categorized.relics.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0),
      ducats: categorized.relics.reduce((sum, item) => sum + ((item.ducats || 0) * (item.quantity || 1)), 0)
    }
  };

  return {
    totalItems: inventory.items.reduce((sum, item) => sum + (item.quantity || 1), 0),
    totalValue,
    totalDucats,
    lastScanDate: inventory.lastScanDate,
    byCategory
  };
};

/**
 * Calculate relic value analysis on-demand for UI display
 * This ensures fresh market data and doesn't bloat the stored inventory
 */
export const calculateRelicValueAnalysis = async (
  relicName: string,
  rarity: VoidRelic['rarity'] = 'intact',
  directSalePrice: number = 0
): Promise<{
  relicDrops: RelicRewardItem[];
  minDropValue: number;
  maxDropValue: number;
  expectedDropValue: number;
  directSalePrice: number;
  recommendation: VoidRelic['recommendation'];
  expectedProfit: number;
  refinementAnalysis?: {
    platPerVoidTrace?: number;
    bestRefinementTarget?: 'exceptional' | 'flawless' | 'radiant';
    bestRefinementCost?: number;
    bestRefinementGain?: number;
    // New optimal analysis fields
    optimalMarketPrice?: number;
    optimalMarketPriceFallback?: string; // 'exact', 'fallback_flawless', etc.
    reasoning?: string; // Human-readable explanation
    comparison?: string; // Comparison details
  };
} | null> => {
  try {
    const relicDrops = await getRelicDropsByName(relicName, rarity);

    if (!relicDrops || relicDrops.length === 0) {
      console.warn(`No drop data found for relic: ${relicName}`);
      return null;
    }

    // Fetch prices for all potential drops using batch API
    const validDrops = relicDrops.filter(drop => drop.warframeMarketUrlName);
    const itemNames = validDrops.map(drop => drop.warframeMarketUrlName);

    let batchPriceData: any[] = [];
    if (itemNames.length > 0) {
      try {
        console.log(`Fetching batch prices for ${itemNames.length} drop items from ${relicName}`);
        batchPriceData = await fetchBatchPriceData(itemNames);
      } catch (error) {
        console.error('Failed to fetch batch price data:', error);
        // Fall back to returning drops with 0 price
        batchPriceData = itemNames.map(name => ({ name, price: 0, error: 'Batch fetch failed' }));
      }
    }

    // Combine drop data with price data
    const dropsWithPrices = relicDrops.map(drop => {
      if (!drop.warframeMarketUrlName) {
        console.warn(`No market URL for item: ${drop.itemName}`);
        return {
          ...drop,
          currentPrice: 0,
        };
      }

      const priceData = batchPriceData.find(p => p.name === drop.itemName ||
        p.name.toLowerCase().replace(/\s+/g, '_') === drop.itemName.toLowerCase().replace(/\s+/g, '_'));

      return {
        ...drop,
        currentPrice: priceData?.price || 0,
      };
    });

    // Calculate min, max, and expected values
    const prices = dropsWithPrices.map(d => d.currentPrice || 0).filter(p => p > 0);
    const minDropValue = prices.length > 0 ? Math.min(...prices) : 0;
    const maxDropValue = prices.length > 0 ? Math.max(...prices) : 0;

    let expectedDropValue = 0;
    dropsWithPrices.forEach(drop => {
      expectedDropValue += (drop.currentPrice || 0) * (drop.dropChance / 100);
    });

    // Use comprehensive refinement analysis to determine best recommendation
    let recommendation: VoidRelic['recommendation'] = 'OPEN';
    let expectedProfit = expectedDropValue - directSalePrice;
    let refinementAnalysis: any = undefined;

    try {
      // Import and use the new optimal refinement analysis
      const { analyzeOptimalRefinementStrategy } = await import('./relicDataService');
      const optimalAnalysis = await analyzeOptimalRefinementStrategy(relicName, rarity, batchPriceData);

      // Use the optimal analysis results
      recommendation = optimalAnalysis.recommendation;
      expectedProfit = optimalAnalysis.expectedProfit;
      refinementAnalysis = {
        platPerVoidTrace: optimalAnalysis.platPerVoidTrace,
        bestRefinementTarget: optimalAnalysis.optimalRefinementLevel,
        bestRefinementCost: optimalAnalysis.investmentCost,
        bestRefinementGain: optimalAnalysis.optimalExpectedValue - optimalAnalysis.currentExpectedValue,
        optimalMarketPrice: optimalAnalysis.optimalMarketPrice,
        optimalMarketPriceFallback: optimalAnalysis.optimalMarketPriceFallback,
        reasoning: optimalAnalysis.analysis.reasoning,
        comparison: optimalAnalysis.analysis.comparison
      };

    } catch (error) {
      console.warn(`Optimal refinement analysis failed, falling back to basic logic:`, error);
      // Fallback to basic logic
      if (directSalePrice > expectedDropValue) {
        recommendation = 'SELL';
        expectedProfit = directSalePrice - expectedDropValue;
      } else {
        recommendation = 'OPEN';
        expectedProfit = expectedDropValue - directSalePrice;
      }
    }

    const result = {
      relicDrops: dropsWithPrices,
      minDropValue,
      maxDropValue,
      expectedDropValue: parseFloat(expectedDropValue.toFixed(2)),
      directSalePrice,
      recommendation,
      expectedProfit: parseFloat(expectedProfit.toFixed(2)),
      refinementAnalysis,
    };

    return result;
  } catch (error) {
    console.error('Relic analysis failed:', error);
    return null;
  }
};

// NEW: Last refresh time tracking for modules
export const setLastRefreshTime = (category: 'prime_parts' | 'relics'): void => {
  const key = category === 'prime_parts' ? PRIME_PARTS_LAST_REFRESH_KEY : RELICS_LAST_REFRESH_KEY;
  try {
    localStorage.setItem(key, new Date().toISOString());
  } catch (error) {
    console.error(`Failed to save last refresh time for ${category}:`, error);
  }
};

export const getLastRefreshTime = (category: 'prime_parts' | 'relics'): Date | null => {
  const key = category === 'prime_parts' ? PRIME_PARTS_LAST_REFRESH_KEY : RELICS_LAST_REFRESH_KEY;
  try {
    const stored = localStorage.getItem(key);
    return stored ? new Date(stored) : null;
  } catch (error) {
    console.error(`Failed to load last refresh time for ${category}:`, error);
    return null;
  }
};

/**
 * Migrate existing inventory items to use local images instead of external CDN URLs
 */
export const migrateInventoryToLocalImages = async (): Promise<void> => {
  try {
    const inventory = loadInventory();
    let hasChanges = false;


    // Update all items to use local images if they have external URLs
    const updatedItems = await Promise.all(
      inventory.items.map(async (item) => {
        // Check if item has external CDN URL and valid name
        if (item.imgUrl && (item.imgUrl.includes('warframe.market') || item.imgUrl.includes('content.warframe.com')) && isValidPrimePartName(item.name)) {
          console.log(`🔄 Migrating ${item.name} from external URL to local image`);
          const localImageUrl = await getImageUrl(item.name);
          hasChanges = true;
          return {
            ...item,
            imgUrl: localImageUrl,
            lastUpdated: new Date()
          };
        }
        return item;
      })
    );

    // Save updated inventory if changes were made
    if (hasChanges) {
      const updatedInventory: InventoryStorage = {
        ...inventory,
        items: updatedItems,
        lastScanDate: new Date()
      };

      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(updatedInventory));
      console.log('✅ Inventory migration completed - all items now use local images');

      // Notify cloud sync of local data modification
      cloudSyncService.onLocalDataModified().catch(error => {
        console.error('Failed to sync inventory migration to cloud:', error);
      });
    } else {
      console.log('✅ No migration needed - all items already use local images');
    }

    // Also check and clean any other cached data that might contain external URLs
    await cleanupExternalImageReferences();

    // Run part-to-parent image migration
    await migratePartsToParentImages();
  } catch (error) {
    console.error('❌ Failed to migrate inventory to local images:', error);
  }
};

/**
 * Validates if a string is a valid prime part name
 * Filters out AI responses and invalid item names
 */
const isValidPrimePartName = (name: string): boolean => {
  // Filter out common AI response patterns
  const invalidPatterns = [
    /here are the/i,
    /screenshot/i,
    /image/i,
    /visible/i,
    /detected/i,
    /found/i,
    /see/i,
    /items/i,
    /following/i,
    /^i /i,
    /^the /i,
    /analysis/i,
    /result/i
  ];
  
  // Check for invalid patterns
  if (invalidPatterns.some(pattern => pattern.test(name))) {
    return false;
  }
  
  // Must contain "Prime" and have reasonable length
  if (!name.includes('Prime') || name.length < 5 || name.length > 50) {
    return false;
  }
  
  // Should not contain multiple sentences or question marks
  if (name.includes('.') || name.includes('?') || name.includes(':')) {
    return false;
  }
  
  return true;
};

/**
 * Migrate prime parts to use their parent item images
 * e.g., "Akarius Prime Link" should use "Akarius Prime" image
 */
export const migratePartsToParentImages = async (): Promise<void> => {
  try {
    const inventory = loadInventory();
    let hasChanges = false;


    // Update all prime parts to use correct parent images
    const updatedItems = await Promise.all(
      inventory.items.map(async (item) => {
        // Only process prime parts category with valid prime part names
        if (item.category === 'prime_parts' && isValidPrimePartName(item.name)) {
          const newImageUrl = await getImageUrl(item.name);

          // Check if the image URL has changed (indicating we found a better parent mapping)
          if (item.imgUrl !== newImageUrl) {
            console.log(`🔗 Updating part "${item.name}" to use parent image`);
            hasChanges = true;
            return {
              ...item,
              imgUrl: newImageUrl,
              lastUpdated: new Date()
            };
          }
        }
        return item;
      })
    );

    // Save updated inventory if changes were made
    if (hasChanges) {
      const updatedInventory: InventoryStorage = {
        ...inventory,
        items: updatedItems,
        lastScanDate: new Date()
      };

      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(updatedInventory));
      console.log('✅ Prime parts migration completed - all parts now use parent images');

      // Notify cloud sync of local data modification
      cloudSyncService.onLocalDataModified().catch(error => {
        console.error('Failed to sync parts migration to cloud:', error);
      });
    } else {
      console.log('✅ No parts migration needed - all parts already use correct images');
    }
  } catch (error) {
    console.error('❌ Failed to migrate parts to parent images:', error);
  }
};

/**
 * Clean up any other localStorage data that might contain external image URLs
 */
const cleanupExternalImageReferences = async (): Promise<void> => {
  try {
    // Clear any cached data that might contain external URLs
    const keysToCheck = [
      'platscanner_prime_sets_cache',
      'platscanner_scan_results',
      'platscanner_market_cache'
    ];

    keysToCheck.forEach(key => {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          if (JSON.stringify(parsed).includes('warframe.market/static')) {
            console.log(`🔄 Clearing cached data with external URLs: ${key}`);
            localStorage.removeItem(key);
          }
        }
      } catch (error) {
        // Ignore parse errors for non-JSON data
      }
    });

    console.log('✅ External image reference cleanup completed');
  } catch (error) {
    console.error('❌ Failed to cleanup external image references:', error);
  }
};

/**
 * Verify that no external URLs are present in stored data (for debugging)
 */
export const verifyLocalImageMigration = (): {
  hasExternalUrls: boolean;
  externalUrls: string[];
  totalItems: number;
  partsUsingParentImages: number;
} => {
  try {
    const inventory = loadInventory();
    const externalUrls: string[] = [];
    let partsUsingParentImages = 0;

    inventory.items.forEach(item => {
      if (item.imgUrl && (item.imgUrl.includes('warframe.market') || item.imgUrl.includes('content.warframe.com'))) {
        externalUrls.push(`${item.name}: ${item.imgUrl}`);
      }

      // Count parts that are likely using parent images
      if (item.category === 'prime_parts' && item.imgUrl && !item.imgUrl.includes('unknown.png')) {
        // Check if this appears to be a part (has part suffix)
        const partSuffixes = ['Blueprint', 'Chassis', 'Neuroptics', 'Systems', 'Barrel', 'Receiver', 'Stock', 'Link', 'Grip', 'Handle'];
        const hasPartSuffix = partSuffixes.some(suffix => item.name.includes(` ${suffix}`));
        if (hasPartSuffix) {
          partsUsingParentImages++;
        }
      }
    });

    const result = {
      hasExternalUrls: externalUrls.length > 0,
      externalUrls,
      totalItems: inventory.items.length,
      partsUsingParentImages
    };

    if (result.hasExternalUrls) {
      console.warn('⚠️ External URLs still found in inventory:', result.externalUrls);
    } else {
      console.log('✅ All inventory items use local images');
    }

    if (result.partsUsingParentImages > 0) {
      console.log(`🔗 ${result.partsUsingParentImages} prime parts using parent item images`);
    }

    return result;
  } catch (error) {
    console.error('❌ Failed to verify image migration:', error);
    return {
      hasExternalUrls: false,
      externalUrls: [],
      totalItems: 0,
      partsUsingParentImages: 0
    };
  }
};