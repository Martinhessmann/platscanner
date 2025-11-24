import { SyndicateReward } from '../types';
import { fetchSinglePriceData } from './warframeMarketService';
import { getCategorizedInventory } from './inventoryService';

// Default standing costs by item type
const DEFAULT_STANDING_COSTS: Record<string, number> = {
  'weapon': 125000,
  'mod': 25000,
  'cosmetic': 5000,
  'resource': 5000,
  'other': 5000
};

/**
 * Determine item type based on name patterns
 */
export const determineItemType = (itemName: string): 'weapon' | 'mod' | 'cosmetic' | 'resource' | 'other' => {
  const name = itemName.toLowerCase();

  // Syndicate weapons (high-tier rewards)
  if (name.includes('telos') || name.includes('synoid') || name.includes('secura') ||
      name.includes('sancti') || name.includes('rakta') || name.includes('vaykor')) {
    if (name.includes('syandana')) return 'cosmetic';
    return 'weapon';
  }

  // Syndicate augment mods (Warframe ability mods)
  const augmentPatterns = [
    'seeking', 'shuriken', 'decoy', 'trickster', 'burst', 'flight', 'javelin',
    'truth', 'malevolence', 'invisibility', 'stand', 'disarm', 'judgment',
    'covenant', 'crash', 'splinters', 'freak', 'armor', 'fortune', 'bolts',
    'provocation', 'rage', 'finish', 'storm', 'dispensary', 'haven', 'torrent',
    'switch', 'assimilate', 'avenging', 'blade', 'calm', 'frenzy', 'hushed',
    'intrepid', 'irradiating', 'jade', 'lasting', 'mach', 'mending', 'mind',
    'negation', 'omikui', 'pacifying', 'peaceful', 'primal', 'radiant',
    'reactive', 'repair', 'rift', 'rising', 'safeguard'
  ];

  if (augmentPatterns.some(pattern => name.includes(pattern))) {
    return 'mod';
  }

  // Syndicate mod patterns (weapon augments)
  if (name.includes('entropy') || name.includes('sequence') || name.includes('purity') ||
      name.includes('justice') || name.includes('blight')) {
    return 'mod';
  }

  // Scenes and decorations
  if (name.includes('scene') || name.includes('sculpture') || name.includes('decoration')) {
    return 'cosmetic';
  }

  // Cosmetics
  if (name.includes('sigil') || name.includes('syandana') || name.includes('armor') ||
      name.includes('skin') || name.includes('ephemera')) {
    return 'cosmetic';
  }

  // Resources and blueprints
  if (name.includes('blueprint') || name.includes('part') || name.includes('relic')) {
    return 'resource';
  }

  // Default to mod for most syndicate items (most are augment mods)
  return 'mod';
};

/**
 * Get estimated standing cost for an item that shows a checkmark (owned)
 */
export const getEstimatedStandingCost = (itemName: string): number => {
  const itemType = determineItemType(itemName);
  return DEFAULT_STANDING_COSTS[itemType] || 5000;
};

/**
 * Get all syndicate rewards from user inventory
 */
export const getAllSyndicateRewards = (): SyndicateReward[] => {
  const inventory = getCategorizedInventory();
  const syndicateItems = inventory.syndicate_rewards;

  // Convert InventoryItem to SyndicateReward format for compatibility
  return syndicateItems.map(item => ({
    id: item.id,
    name: item.name,
    category: 'syndicate_rewards' as const,
    syndicate: item.syndicate || 'Unknown',
    standingCost: item.standingCost || getEstimatedStandingCost(item.name),
    masteryRank: item.masteryRank,
    itemType: item.itemType || determineItemType(item.name),
    platPerStanding: item.platPerStanding,
    marketVolume: item.marketVolume,
    availability: item.availability,
    price: item.price,
    volume: item.volume,
    average: item.average,
    status: item.status,
    error: item.error,
    quantity: item.quantity,
    imgUrl: item.imgUrl,
    ducats: item.ducats,
    // Preserve buyer data to ensure we only show real buyer prices
    hasBuyers: item.hasBuyers,
    buyerUsername: item.buyerUsername,
    buyerQuantity: item.buyerQuantity,
    buyerCount: item.buyerCount
  }));
};

/**
 * Get syndicate rewards by syndicate name from inventory
 */
export const getSyndicateRewards = (syndicateName: string): SyndicateReward[] => {
  const allRewards = getAllSyndicateRewards();
  return allRewards.filter(reward => reward.syndicate === syndicateName);
};

/**
 * Get all unique syndicates that user has scanned
 */
export const getAvailableSyndicates = (): string[] => {
  const allRewards = getAllSyndicateRewards();
  const syndicates = new Set(allRewards.map(r => r.syndicate));
  return Array.from(syndicates).sort();
};

/**
 * Fetch market prices for syndicate rewards
 */
export const fetchSyndicateRewardPrices = async (
  rewards: SyndicateReward[],
  shouldCancel?: () => boolean
): Promise<SyndicateReward[]> => {
  console.log(`>>> [SyndicateService] Fetching prices for ${rewards.length} rewards <<<`);
  const updatedRewards: SyndicateReward[] = [];

  for (const reward of rewards) {
    // Check for cancellation
    if (shouldCancel && shouldCancel()) {
      console.log(`>>> [SyndicateService] Cancellation requested, stopping at item ${updatedRewards.length + 1}/${rewards.length} <<<`);
      // Return what we have so far
      return updatedRewards;
    }

    // Skip if no name
    if (!reward.name) {
      console.warn(`>>> [SyndicateService] Skipping reward with undefined name:`, reward);
      continue;
    }

    console.log(`>>> [SyndicateService] Fetching price for: ${reward.name} <<<`);
    try {
      const priceData = await fetchSinglePriceData(reward);

      // Check for cancellation after API call
      if (shouldCancel && shouldCancel()) {
        console.log(`>>> [SyndicateService] Cancellation detected after fetching ${reward.name}, stopping <<<`);
        return updatedRewards;
      }

      if (priceData && priceData.price) {
        // Calculate plat per 1000 standing (more readable than per-standing)
        const effectiveStandingCost = reward.standingCost || getEstimatedStandingCost(reward.name);
        const platPer1000Standing = (priceData.price * 1000) / effectiveStandingCost;

        updatedRewards.push({
          ...reward,
          price: priceData.price,
          volume: priceData.volume,
          average: priceData.average,
          platPerStanding: platPer1000Standing, // Now represents plat per 1000 standing
          marketVolume: priceData.volume,
          status: 'loaded' as const,
          standingCost: effectiveStandingCost, // Ensure we have a standing cost
          // Preserve buyer data to ensure we only show real buyer prices
          hasBuyers: priceData.hasBuyers,
          buyerUsername: priceData.buyerUsername,
          buyerQuantity: priceData.buyerQuantity,
          buyerCount: priceData.buyerCount
        });
      } else {
        updatedRewards.push({
          ...reward,
          status: 'error' as const,
          error: 'No price data available',
          standingCost: reward.standingCost || getEstimatedStandingCost(reward.name)
        });
      }
    } catch (error) {
      console.error(`>>> [SyndicateService] Error fetching price for ${reward.name}:`, error);
      updatedRewards.push({
        ...reward,
        status: 'error' as const,
        error: error instanceof Error ? error.message : 'Failed to fetch price',
        standingCost: reward.standingCost || getEstimatedStandingCost(reward.name)
      });
    }
  }

  return updatedRewards;
};

/**
 * Sort syndicate rewards by various criteria
 */
export const sortSyndicateRewards = (
  rewards: SyndicateReward[],
  sortBy: 'platPerStanding' | 'price' | 'standingCost' | 'name' | 'syndicate',
  sortOrder: 'asc' | 'desc' = 'desc'
): SyndicateReward[] => {
  return [...rewards].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'platPerStanding': {
        const aRatio = a.platPerStanding || 0;
        const bRatio = b.platPerStanding || 0;
        comparison = aRatio - bRatio;
        break;
      }
      case 'price':
        comparison = (a.price || 0) - (b.price || 0);
        break;
      case 'standingCost':
        comparison = a.standingCost - b.standingCost;
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'syndicate':
        comparison = a.syndicate.localeCompare(b.syndicate);
        break;
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });
};

/**
 * Filter syndicate rewards
 */
export const filterSyndicateRewards = (
  rewards: SyndicateReward[],
  filters: {
    syndicate?: string;
    itemType?: string;
    minPrice?: number;
    maxPrice?: number;
    minPlatPerStanding?: number;
    maxStandingCost?: number;
  }
): SyndicateReward[] => {
  return rewards.filter(reward => {
    if (filters.syndicate && reward.syndicate !== filters.syndicate) return false;
    if (filters.itemType && reward.itemType !== filters.itemType) return false;
    if (filters.minPrice && (reward.price || 0) < filters.minPrice) return false;
    if (filters.maxPrice && (reward.price || 0) > filters.maxPrice) return false;
    if (filters.minPlatPerStanding && (reward.platPerStanding || 0) < filters.minPlatPerStanding) return false;
    if (filters.maxStandingCost && reward.standingCost > filters.maxStandingCost) return false;
    return true;
  });
};