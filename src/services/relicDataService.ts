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

    // Construct the exact relic name with the specified refinement level
    const refinementLevel = rarity.charAt(0).toUpperCase() + rarity.slice(1); // Capitalize first letter
    const targetRelicName = `${baseRelicName} ${refinementLevel}`;
    console.log(`>>> [Relic Lookup] Target relic name: "${targetRelicName}" <<<`);

    // Try to find exact match with refinement level first
    let relic = allRelics.find((r: any) => r.name === targetRelicName);
    console.log(`>>> [Relic Lookup] Exact match for "${targetRelicName}": ${relic ? 'FOUND' : 'NOT FOUND'} <<<`);

    // If not found, try the original input name as fallback
    if (!relic) {
      relic = allRelics.find((r: any) => r.name === relicName);
      console.log(`>>> [Relic Lookup] Fallback match for "${relicName}": ${relic ? 'FOUND' : 'NOT FOUND'} <<<`);
    }

    // If still not found, look for any relics that start with the base name and default to Intact
    if (!relic) {
      const matchingRelics = allRelics.filter((r: any) => r.name.startsWith(baseRelicName + ' '));
      console.log(`>>> [Relic Lookup] Found ${matchingRelics.length} relics matching base name "${baseRelicName}" <<<`);
      console.log(`>>> [Relic Lookup] Matching relics:`, matchingRelics.map((r: any) => r.name));

      // Prefer Intact version as final fallback
      relic = matchingRelics.find((r: any) => r.name === baseRelicName + ' Intact') || matchingRelics[0];
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

    // Convert to our internal RelicRewardItem format
    const converted = relic.rewards.map((reward: any) => ({
      itemName: reward.item.name,
      rarity: reward.rarity.charAt(0).toUpperCase() + reward.rarity.slice(1) as 'Common' | 'Uncommon' | 'Rare',
      dropChance: reward.chance,
      warframeMarketUrlName: reward.item.warframeMarket?.urlName || '',
    }));

    console.log(`>>> [Relic Lookup] Converted rewards:`, converted.map((r: any) => `${r.itemName} (${r.dropChance}%) -> ${r.warframeMarketUrlName}`));
    return converted;
  } catch (error) {
    console.error('>>> [Relic Lookup] Error getting relic drops:', error);
    return undefined;
  }
};