// Purpose: Manage owned items state - distinguish between inventory items and truly owned items
// Author: Assistant
// Last Updated: 2025-01-28

import { DetectedItem } from '../types';

const OWNED_ITEMS_KEY = 'warframe_owned_items';

// Get all owned items from localStorage
export const getOwnedItems = (): Set<string> => {
  try {
    const stored = localStorage.getItem(OWNED_ITEMS_KEY);
    if (stored) {
      const ownedItems = JSON.parse(stored);
      return new Set(ownedItems);
    }
  } catch (error) {
    console.error('Failed to load owned items from localStorage:', error);
  }
  return new Set();
};

// Save owned items to localStorage
export const saveOwnedItems = (ownedItems: Set<string>): void => {
  try {
    localStorage.setItem(OWNED_ITEMS_KEY, JSON.stringify(Array.from(ownedItems)));
  } catch (error) {
    console.error('Failed to save owned items to localStorage:', error);
  }
};

// Check if an item is marked as owned
export const isItemOwned = (itemName: string): boolean => {
  const ownedItems = getOwnedItems();
  return ownedItems.has(itemName.toLowerCase());
};

// Mark an item as owned
export const markItemAsOwned = (itemName: string): void => {
  const ownedItems = getOwnedItems();
  ownedItems.add(itemName.toLowerCase());
  saveOwnedItems(ownedItems);
};

// Mark an item as not owned (can be sold)
export const markItemAsNotOwned = (itemName: string): void => {
  const ownedItems = getOwnedItems();
  ownedItems.delete(itemName.toLowerCase());
  saveOwnedItems(ownedItems);
};

// Toggle the owned status of an item
export const toggleItemOwned = (itemName: string): boolean => {
  const isOwned = isItemOwned(itemName);
  if (isOwned) {
    markItemAsNotOwned(itemName);
    return false;
  } else {
    markItemAsOwned(itemName);
    return true;
  }
};

// Get owned items from inventory (items that are both in inventory and marked as owned)
export const getOwnedItemsFromInventory = (inventory: DetectedItem[]): DetectedItem[] => {
  return inventory.filter(item => isItemOwned(item.name));
};

// Update inventory items with their owned status
export const updateInventoryWithOwnedStatus = (inventory: DetectedItem[]): DetectedItem[] => {
  return inventory.map(item => ({
    ...item,
    isOwned: isItemOwned(item.name)
  }));
};
