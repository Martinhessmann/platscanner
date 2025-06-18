// Purpose: Handle persistent inventory storage and management
// Supports Story #3: Persistent Inventory across sessions
// Extended for Story #8: Support for multiple item categories (Prime Parts, Relics, etc.)

import { DetectedItem, PrimePart, VoidRelic, ItemCategory, RelicRewardItem } from '../types';
import { getRelicDropsByName } from './relicDataService';
import { fetchSinglePriceData, fetchBatchPriceData } from './warframeMarketService';

const INVENTORY_STORAGE_KEY = 'platscanner_inventory';
const LAST_SCAN_STORAGE_KEY = 'platscanner_last_scan';

export interface InventoryItem {
  id: string;
  name: string;
  category: ItemCategory;
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
    const inventoryItems: InventoryItem[] = items.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
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
    }));

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
        return {
          ...inventoryItem,
          ...updatedItem,
          addedAt: inventoryItem.addedAt, // Preserve original add date
          lastUpdated: now
        };
      }
      return inventoryItem;
    });

    const updatedInventory: InventoryStorage = {
      ...currentInventory,
      items: updatedInventoryItems,
      lastScanDate: now
    };

    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(updatedInventory));
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

  const totalValue = inventory.items.reduce((sum, item) => sum + (item.price || 0), 0);
  const totalDucats = inventory.items.reduce((sum, item) => sum + (item.ducats || 0), 0);

  const byCategory: Record<ItemCategory, { count: number; value: number; ducats: number }> = {
    prime_parts: {
      count: categorized.prime_parts.length,
      value: categorized.prime_parts.reduce((sum, item) => sum + (item.price || 0), 0),
      ducats: categorized.prime_parts.reduce((sum, item) => sum + (item.ducats || 0), 0)
    },
    relics: {
      count: categorized.relics.length,
      value: categorized.relics.reduce((sum, item) => sum + (item.price || 0), 0),
      ducats: categorized.relics.reduce((sum, item) => sum + (item.ducats || 0), 0)
    }
  };

  return {
    totalItems: inventory.items.length,
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
export const calculateRelicValueAnalysis = async (relicName: string, rarity: VoidRelic['rarity'] = 'intact'): Promise<{
  relicDrops: RelicRewardItem[];
  minDropValue: number;
  maxDropValue: number;
  expectedDropValue: number;
  directSalePrice: number;
  recommendation: VoidRelic['recommendation'];
  expectedProfit: number;
} | null> => {
  try {
    const relicDrops = await getRelicDropsByName(relicName);

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

    // Placeholder for direct sale price (this needs to be fetched separately if available)
    // For now, assume it's 0 or can be fetched from warframeMarketService if relic itself is tradable
    const directSalePrice = 0; // TODO: Fetch actual relic price if available

    // Determine recommendation (simplified for Phase 1)
    let recommendation: VoidRelic['recommendation'] = 'OPEN';
    let expectedProfit = expectedDropValue - directSalePrice;

    if (directSalePrice > expectedDropValue) {
      recommendation = 'SELL';
    } else if (rarity !== 'radiant' && expectedDropValue * 1.2 > directSalePrice) { // Example logic for refine
      recommendation = 'REFINE_THEN_OPEN';
      expectedProfit = (expectedDropValue * 1.2) - directSalePrice; // Adjust expected profit if refined
    }

    return {
      relicDrops: dropsWithPrices,
      minDropValue,
      maxDropValue,
      expectedDropValue: parseFloat(expectedDropValue.toFixed(2)),
      directSalePrice,
      recommendation,
      expectedProfit: parseFloat(expectedProfit.toFixed(2)),
    };
  } catch (error) {
    console.error('Failed to calculate relic value analysis:', error);
    return null;
  }
};