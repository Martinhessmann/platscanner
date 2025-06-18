// Purpose: Handles Warframe Void Relic drop data using a local static JSON file.
// This provides the list of items that can drop from each relic, along with their drop chances.
// The relics.json file should be updated manually when new relics are added to the game.

import { RelicRewardItem, VoidRelic } from '../types';

// Cache for relic data
let relicsData: any[] = [];

// Hardcoded drop chances by refinement level
const DROP_CHANCES = {
  intact: {
    Common: 25.33, // 76% total (25.33% for each of 3 items)
    Uncommon: 11,  // 22% total (11% for each of 2 items)
    Rare: 2        // 2% total (for 1 item)
  },
  exceptional: {
    Common: 23.33, // 70% total (23.33% for each of 3 items)
    Uncommon: 13,  // 26% total (13% for each of 2 items)
    Rare: 4        // 4% total (for 1 item)
  },
  flawless: {
    Common: 20,    // 60% total (20% for each of 3 items)
    Uncommon: 17,  // 34% total (17% for each of 2 items)
    Rare: 6        // 6% total (for 1 item)
  },
  radiant: {
    Common: 16.67, // 50% total (16.67% for each of 3 items)
    Uncommon: 20,  // 40% total (20% for each of 2 items)
    Rare: 10       // 10% total (for 1 item)
  }
};

// Load relic data from the static file
const loadRelicsData = async (): Promise<any[]> => {
  if (relicsData.length === 0) {
    try {
      console.log(`>>> [Relic Data] Loading relics from /relics.json <<<`);
      // Fetch from our local static file
      const response = await fetch('/relics.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch relics data: ${response.statusText}`);
      }

      const allItems = await response.json();
      console.log(`>>> [Relic Data] Raw JSON loaded: ${allItems.length} total items <<<`);

      // Filter for relics only (by type, not category)
      relicsData = allItems.filter((item: any) => item.type === 'Relic');

      console.log(`>>> [Relic Data] Filtered to ${relicsData.length} relics <<<`);
      console.log(`>>> [Relic Data] Sample relic names:`, relicsData.slice(0, 5).map(r => r.name));
    } catch (error) {
      console.error('>>> [Relic Data] Failed to load relics data from static file:', error);
      throw new Error('Failed to load relic drop data from static file.');
    }
  }
  return relicsData;
};

/**
 * Adjusts drop chances based on relic refinement level
 */
const adjustDropChances = (drops: RelicRewardItem[], refinementLevel: VoidRelic['rarity']): RelicRewardItem[] => {
  // Ensure refinementLevel is a valid key for DROP_CHANCES
  const validRefinement = refinementLevel && ['intact', 'exceptional', 'flawless', 'radiant'].includes(refinementLevel)
    ? refinementLevel
    : 'intact';

  const dropChances = DROP_CHANCES[validRefinement];

  console.log(`>>> [Relic Adjustment] Using ${validRefinement} drop chances: Common=${dropChances.Common}%, Uncommon=${dropChances.Uncommon}%, Rare=${dropChances.Rare}% <<<`);

  return drops.map(drop => ({
    ...drop,
    dropChance: dropChances[drop.rarity] || drop.dropChance // Use hardcoded chance or fallback to original
  }));
};

/**
 * Gets the drop data for a specific Void Relic by its name and refinement level.
 */
export const getRelicDropsByName = async (relicName: string, rarity: VoidRelic['rarity'] = 'intact'): Promise<RelicRewardItem[] | undefined> => {
  try {
    console.log(`>>> [Relic Lookup] Searching for: "${relicName}" with rarity: "${rarity}" <<<`);
    const allRelics = await loadRelicsData();

    // Convert "Lith L2 Relic" or "Neo W2 Relic [Radiant]" to "Neo W2" for base matching
    let baseRelicName = relicName.replace(/\s+Relic$/, ''); // Remove " Relic" suffix
    baseRelicName = baseRelicName.replace(/\s+(Intact|Exceptional|Flawless|Radiant)$/, ''); // Remove space-separated refinement
    baseRelicName = baseRelicName.replace(/\s+\[(Intact|Exceptional|Flawless|Radiant)\]$/, ''); // Remove bracket-enclosed refinement
    console.log(`>>> [Relic Lookup] Base name extracted: "${baseRelicName}" <<<`);

    // For base relic lookup, we'll always use the Intact version first
    const targetRelicName = `${baseRelicName} Intact`;
    console.log(`>>> [Relic Lookup] Target base relic name: "${targetRelicName}" <<<`);

    // Try to find exact match with Intact version first (for consistent base data)
    let relic = allRelics.find((r: any) => r.name === targetRelicName);
    console.log(`>>> [Relic Lookup] Exact match for "${targetRelicName}": ${relic ? 'FOUND' : 'NOT FOUND'} <<<`);

    // If not found, try the original input name as fallback
    if (!relic) {
      relic = allRelics.find((r: any) => r.name === relicName);
      console.log(`>>> [Relic Lookup] Fallback match for "${relicName}": ${relic ? 'FOUND' : 'NOT FOUND'} <<<`);
    }

    // If still not found, look for any relics that start with the base name
    if (!relic) {
      const matchingRelics = allRelics.filter((r: any) => r.name.startsWith(baseRelicName + ' '));
      console.log(`>>> [Relic Lookup] Found ${matchingRelics.length} relics matching base name "${baseRelicName}" <<<`);
      console.log(`>>> [Relic Lookup] Matching relics:`, matchingRelics.map((r: any) => r.name));

      // Use the first matching relic
      relic = matchingRelics[0];
      console.log(`>>> [Relic Lookup] Fallback selected relic: ${relic ? relic.name : 'NONE'} <<<`);
    }

    if (!relic) {
      console.warn(`>>> [Relic Lookup] No relic found for: ${relicName} (base: ${baseRelicName}) <<<`);
      console.log(`>>> [Relic Lookup] Available relics starting with same prefix:`,
        allRelics.filter((r: any) => r.name.startsWith(baseRelicName.split(' ')[0])).slice(0, 5).map((r: any) => r.name));
      return undefined;
    }

    if (!relic.rewards) {
      console.warn(`>>> [Relic Lookup] Relic found but no rewards data: ${relicName} <<<`);
      console.log(`>>> [Relic Lookup] Relic structure:`, Object.keys(relic));
      return undefined;
    }

    console.log(`>>> [Relic Lookup] Found ${relic.rewards.length} rewards for ${relicName} <<<`);
    console.log(`>>> [Relic Lookup] Selected relic name: "${relic.name}" <<<`);
    console.log(`>>> [Relic Lookup] Raw rewards data:`, relic.rewards.map((r: any) => `${r.item.name}: ${r.chance}% (${r.rarity})`));

    // Convert to our internal RelicRewardItem format with proper rarity mapping
    const baseDrops = relic.rewards.map((reward: any) => {
      // Determine rarity based on drop chance rather than label
      // In the game, there are 3 Common items (25.33%), 2 Uncommon items (11%), and 1 Rare item (2%)
      let normalizedRarity: 'Common' | 'Uncommon' | 'Rare';

      // First check the drop chance to determine actual rarity
      if (Math.abs(reward.chance - 25.33) < 0.1) {
        normalizedRarity = 'Common'; // ~25.33% items are actually Common
      } else if (Math.abs(reward.chance - 11) < 0.1) {
        normalizedRarity = 'Uncommon'; // ~11% items are actually Uncommon
      } else if (Math.abs(reward.chance - 2) < 0.1) {
        normalizedRarity = 'Rare'; // ~2% items are actually Rare
      } else {
        // Fallback to the labeled rarity if drop chance doesn't match expected values
        const rawRarity = reward.rarity.toLowerCase();
        if (rawRarity === 'rare') {
          normalizedRarity = 'Rare';
        } else if (rawRarity === 'uncommon') {
          normalizedRarity = 'Uncommon';
        } else {
          normalizedRarity = 'Common';
        }
      }

      return {
        itemName: reward.item.name,
        rarity: normalizedRarity,
        dropChance: reward.chance, // Original drop chance from JSON (will be overridden by adjustDropChances)
        warframeMarketUrlName: reward.item.warframeMarket?.urlName || '',
      };
    });

    // Log the rarities before adjustment
    console.log(`>>> [Relic Lookup] Base drops with rarities:`,
      baseDrops.map((r: any) => `${r.itemName} (${r.rarity}) - Original: ${r.dropChance}%`));

    // Apply the correct drop chances based on refinement level
    const adjustedDrops = adjustDropChances(baseDrops, rarity);

    console.log(`>>> [Relic Lookup] Adjusted drops for ${rarity}:`,
      adjustedDrops.map((r: any) => `${r.itemName} (${r.rarity}: ${r.dropChance}%) -> ${r.warframeMarketUrlName}`));

    return adjustedDrops;
  } catch (error) {
    console.error('>>> [Relic Lookup] Error getting relic drops:', error);
    return undefined;
  }
};