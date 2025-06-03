// Purpose: Handle persistent inventory storage and management
// Supports Story #3: Persistent Inventory across sessions
// Extended for Story #8: Support for multiple item categories (Prime Parts, Relics, etc.)

import { DetectedItem, PrimePart, VoidRelic, ItemCategory } from '../types';

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
      ...item,
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
      version: '1.3.0'
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