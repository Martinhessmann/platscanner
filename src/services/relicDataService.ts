// Purpose: Handles Warframe Void Relic drop data using a local static JSON file.
// This provides the list of items that can drop from each relic, along with their drop chances.
// The relics.json file should be updated manually when new relics are added to the game.

import { RelicRewardItem, VoidRelic } from '../types';

// Cache for relic data
let relicsData: any[] = [];

// Load relic data from the static file
const loadRelicsData = async (): Promise<any[]> => {
  if (relicsData.length === 0) {
    try {
      // Fetch from our local static file
      const response = await fetch('/relics.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch relics data: ${response.statusText}`);
      }

      const allItems = await response.json();

      // Filter for relics only
      relicsData = allItems.filter((item: any) => item.category === 'Relics');

      console.log(`Loaded ${relicsData.length} relics from local static file`);
    } catch (error) {
      console.error('Failed to load relics data from static file:', error);
      throw new Error('Failed to load relic drop data from static file.');
    }
  }
  return relicsData;
};

/**
 * Gets the drop data for a specific Void Relic by its name.
 */
export const getRelicDropsByName = async (relicName: string): Promise<RelicRewardItem[] | undefined> => {
  try {
    const allRelics = await loadRelicsData();

    // Try to find the relic by exact name match first
    let relic = allRelics.find(r => r.name === relicName);

    // If not found, try without the refinement level (e.g., "Axi A1" instead of "Axi A1 Intact")
    if (!relic) {
      const baseRelicName = relicName.replace(/\s+(Intact|Exceptional|Flawless|Radiant)$/, '');
      relic = allRelics.find(r => r.name.startsWith(baseRelicName));
    }

    if (!relic || !relic.rewards) {
      console.warn(`No drop data found for relic: ${relicName}`);
      return undefined;
    }

    // Convert to our internal RelicRewardItem format
    return relic.rewards.map((reward: any) => ({
      itemName: reward.item.name,
      rarity: reward.rarity.charAt(0).toUpperCase() + reward.rarity.slice(1) as 'Common' | 'Uncommon' | 'Rare',
      dropChance: reward.chance,
      warframeMarketUrlName: reward.item.marketInfo?.urlName || '',
    }));
  } catch (error) {
    console.error('Error getting relic drops:', error);
    return undefined;
  }
};