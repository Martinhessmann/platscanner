// Purpose: Handle persistent inventory storage and management
// Supports Story #3: Persistent Inventory across sessions

import { PrimePart } from '../types';

const INVENTORY_STORAGE_KEY = 'platscanner_inventory';
const LAST_SCAN_STORAGE_KEY = 'platscanner_last_scan';

export interface InventoryItem extends PrimePart {
  addedAt: Date;
  lastUpdated: Date;
  scanSession?: string; // Which scan session this item came from
}

export interface InventoryStorage {
  items: InventoryItem[];
  lastScanDate: Date;
  version: string;
}

/**
 * Save detected items to persistent inventory
 */
export const saveToInventory = (items: PrimePart[], sessionId?: string): void => {
  try {
    const currentInventory = loadInventory();
    const now = new Date();

    // Convert PrimeParts to InventoryItems
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
 * Update prices for items in persistent inventory
 */
export const updateInventoryPrices = (updatedItems: PrimePart[]): void => {
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
} => {
  const inventory = loadInventory();

  const totalValue = inventory.items.reduce((sum, item) => sum + (item.price || 0), 0);
  const totalDucats = inventory.items.reduce((sum, item) => sum + (item.ducats || 0), 0);

  return {
    totalItems: inventory.items.length,
    totalValue,
    totalDucats,
    lastScanDate: inventory.lastScanDate
  };
};