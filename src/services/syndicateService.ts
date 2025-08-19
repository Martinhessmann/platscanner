import { SyndicateReward } from '../types';
import { fetchSinglePriceData } from './warframeMarketService';

// Syndicate data structure
export interface SyndicateData {
  name: string;
  rewards: SyndicateReward[];
}

// Load syndicate rewards data from JSON file
let SYNDICATE_REWARDS_DATA: SyndicateData[] = [];

/**
 * Load syndicate rewards data from JSON file
 */
const loadSyndicateData = async (): Promise<SyndicateData[]> => {
  try {
    const response = await fetch('/syndicate-rewards.json');
    if (!response.ok) {
      throw new Error(`Failed to load syndicate data: ${response.statusText}`);
    }
    const data = await response.json();

    // Transform the data to include required fields
    return data.syndicates.map((syndicate: any) => ({
      name: syndicate.name,
      rewards: syndicate.rewards.map((reward: any) => ({
        ...reward,
        addedAt: new Date(),
        lastUpdated: new Date()
      }))
    }));
  } catch (error) {
    console.error('Failed to load syndicate data:', error);
    return [];
  }
};

// Initialize data on module load
loadSyndicateData().then(data => {
  SYNDICATE_REWARDS_DATA = data;
}).catch(error => {
  console.error('Failed to initialize syndicate data:', error);
});

/**
 * Get all syndicate rewards
 */
export const getAllSyndicateRewards = (): SyndicateReward[] => {
  console.log(`>>> [SyndicateService] getAllSyndicateRewards called, data length: ${SYNDICATE_REWARDS_DATA.length} <<<`);
  const rewards = SYNDICATE_REWARDS_DATA.flatMap(syndicate => syndicate.rewards);
  console.log(`>>> [SyndicateService] Returning ${rewards.length} total rewards <<<`);
  return rewards;
};

/**
 * Get syndicate rewards by syndicate name
 */
export const getSyndicateRewards = (syndicateName: string): SyndicateReward[] => {
  const syndicate = SYNDICATE_REWARDS_DATA.find(s => s.name === syndicateName);
  return syndicate ? syndicate.rewards : [];
};

/**
 * Get all available syndicates
 */
export const getAvailableSyndicates = (): string[] => {
  return SYNDICATE_REWARDS_DATA.map(s => s.name);
};

/**
 * Fetch market prices for syndicate rewards
 */
export const fetchSyndicateRewardPrices = async (rewards: SyndicateReward[]): Promise<SyndicateReward[]> => {
  const updatedRewards: SyndicateReward[] = [];

  console.log(`>>> [SyndicateService] Fetching prices for ${rewards.length} rewards <<<`);

  for (const reward of rewards) {
    try {
      // Validate reward has required fields
      if (!reward.name) {
        console.warn(`>>> [SyndicateService] Skipping reward with undefined name:`, reward);
        continue;
      }

      console.log(`>>> [SyndicateService] Fetching price for: ${reward.name} <<<`);
      const priceData = await fetchSinglePriceData(reward);

      if (priceData && priceData.price) {
        const platPerStanding = priceData.price / reward.standingCost;

        updatedRewards.push({
          ...reward,
          price: priceData.price,
          volume: priceData.volume,
          average: priceData.average,
          platPerStanding,
          marketVolume: priceData.volume
        });
      } else {
        // Keep the original reward if no price data
        updatedRewards.push(reward);
      }
    } catch (error) {
      console.error(`>>> [SyndicateService] Error fetching price for ${reward.name}:`, error);
      // Keep the original reward if there's an error
      updatedRewards.push(reward);
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
