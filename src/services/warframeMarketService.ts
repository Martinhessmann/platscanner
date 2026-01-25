import { DetectedItem, VoidRelic, Mod } from '../types';
import { getImageUrl } from './unifiedImageService';
import { marketLogger } from './marketLogger';

// Helper: Treat all detected prime parts as tradeable on Warframe Market
export const isPrimePartTradeable = (itemName: string): boolean => {
  const name = itemName.toLowerCase();
  // Built Warframe parts are NOT tradeable
  if (name.includes('prime') &&
    (name.includes('chassis') || name.includes('neuroptics') || name.includes('systems')) &&
    !name.includes('blueprint')) {
    return false;
  }
  return true;
};

// Netlify Function URL - automatically available in production
const NETLIFY_FUNCTION_URL = '/.netlify/functions/warframe-market';

/**
 * Helper to get the correct base URL for market API requests
 * Ensures relative paths are used in local development to utilize Vite proxy
 */
const getMarketApiUrl = (normalizedName: string, isPrimeSet: boolean = false): string => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Use relative path locally for Vite proxy, absolute URL for production
  const baseUrl = isLocal ? '' : (import.meta.env.VITE_PROD_FUNCTIONS_URL || window.location.origin);
  const url = new URL(NETLIFY_FUNCTION_URL, baseUrl || window.location.origin);

  url.searchParams.set('item', normalizedName);
  if (isPrimeSet) {
    url.searchParams.set('prime_set', 'true');
  }

  return url.toString();
};

/**
 * CRITICAL COMPONENT - DO NOT MODIFY WITHOUT REVIEW
 *
 * This service handles all interactions with the Warframe Market API.
 * It is responsible for:
 * 1. Normalizing item names
 * 2. Fetching market data with rate limiting
 * 3. Processing and formatting price data
 *
 * Key Dependencies:
 * - Netlify Function for API proxying (primary method)
 * - Direct API calls as fallback for local development
 *
 * IMPORTANT: The 90-day median (average) price functionality requires
 * the Netlify Function to be deployed. Without it, only current
 * prices will be available, not historical averages.
 */

/**
 * CRITICAL: Normalizes item names to match Warframe Market URL format
 * DO NOT modify without testing against the full item database
 */
const normalizeItemName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/\s*&\s*/g, '_and_') // Replace & with 'and'
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
};

/**
 * CRITICAL: Normalizes mod names to ensure we only fetch unranked (level 0) prices
 */
const normalizeModName = (name: string, _rank?: number): string => {
  let modName = name;
  modName = modName.replace(/\s*\(R\d+\)$/i, '');
  modName = modName.replace(/\s*Rank\s+\d+$/i, '');
  return normalizeItemName(modName);
};

/**
 * Smart relic market lookup: Try refined relic first, fallback to base relic
 */
const getRelicMarketNames = (relicName: string): string[] => {
  const names = [];
  names.push(normalizeItemName(relicName));

  if (relicName.includes('Relic')) {
    let baseRelicName = relicName;
    baseRelicName = baseRelicName.replace(/\s+\[(Intact|Exceptional|Flawless|Radiant)\]$/, '');
    baseRelicName = baseRelicName.replace(/\s+\((Intact|Exceptional|Flawless|Radiant)\)$/, '');

    const baseNormalized = normalizeItemName(baseRelicName);
    if (baseNormalized !== names[0]) {
      names.push(baseNormalized);
    }
  }

  return names;
};

/**
 * Fetches market data using Netlify Function
 */
const fetchViaNetlify = async (normalizedName: string, isPrimeSet: boolean = false) => {
  const url = getMarketApiUrl(normalizedName, isPrimeSet);
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch market data' }));
    throw new Error(error.message || 'Failed to fetch market data');
  }

  return await response.json();
};

/**
 * Smart relic market fetch: Try refined first, fallback to base relic
 */
const fetchRelicViaNetlify = async (relicName: string) => {
  const marketNames = getRelicMarketNames(relicName);

  for (const marketName of marketNames) {
    try {
      const data = await fetchViaNetlify(marketName);
      if (data.error) {
        if (data.error === 'not_found') {
          continue;
        } else {
          throw new Error(`API error for ${marketName}: ${data.message || data.error}`);
        }
      }
      return data;
    } catch {
      continue;
    }
  }

  throw new Error(`No market data found for relic: ${relicName}`);
};

/**
 * Fetches market data for multiple items in batch using Netlify Function
 */
const fetchBatchViaNetlify = async (normalizedNames: string[]) => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const baseUrl = isLocal ? '' : (import.meta.env.VITE_PROD_FUNCTIONS_URL || window.location.origin);
  const url = new URL(NETLIFY_FUNCTION_URL, baseUrl || window.location.origin);
  url.searchParams.set('batch', JSON.stringify(normalizedNames));

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch batch market data' }));
    throw new Error(error.message || 'Failed to fetch batch market data');
  }

  const result = await response.json();
  return result.batch;
};

/**
 * Fetches market data using direct API calls via Netlify proxy
 */
const fetchViaDirect = async (normalizedName: string) => {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Language': 'en',
    'Platform': 'pc',
    'User-Agent': 'PlatScanner/1.2.1'
  };

  try {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocal ? '' : (import.meta.env.VITE_PROD_FUNCTIONS_URL || '');

    const itemResponse = await fetch(`${baseUrl}/api/warframe-market/items/${normalizedName}`, { headers });

    if (!itemResponse.ok) {
      throw new Error(`Item API error: ${itemResponse.status}`);
    }

    const itemData = await itemResponse.json();
    if (!itemData?.payload?.item?.items_in_set) {
      throw new Error('Invalid item data structure');
    }

    const ordersResponse = await fetch(`${baseUrl}/api/warframe-market/items/${normalizedName}/orders`, { headers });

    if (!ordersResponse.ok) {
      throw new Error(`Orders API error: ${ordersResponse.status}`);
    }

    const ordersData = await ordersResponse.json();

    const itemDetails = itemData.payload.item.items_in_set.find((item: any) =>
      item.url_name === normalizedName
    ) || itemData.payload.item.items_in_set[0];

    const buyOrders = ordersData.payload.orders.filter((order: any) =>
      order.order_type === 'buy' &&
      ['online', 'ingame'].includes(order.user.status) &&
      !order.user.banned &&
      order.visible
    );

    const sellOrders = ordersData.payload.orders.filter((order: any) =>
      order.order_type === 'sell' &&
      ['online', 'ingame'].includes(order.user.status) &&
      !order.user.banned &&
      order.visible
    );

    const highestBidder = buyOrders.length > 0
      ? buyOrders.reduce((highest: any, current: any) =>
          current.platinum > highest.platinum ? current : highest
        )
      : null;

    const lowestSeller = sellOrders.length > 0
      ? sellOrders.reduce((lowest: any, current: any) =>
          current.platinum < lowest.platinum ? current : lowest
        )
      : null;

    const allValidOrders = ordersData.payload.orders.filter((order: any) =>
      ['online', 'ingame'].includes(order.user.status) &&
      !order.user.banned &&
      order.visible
    );

    const price = buyOrders.length > 0 ? Math.max(...buyOrders.map((o: any) => o.platinum)) : 0;

    return {
      name: itemDetails.en.item_name,
      thumb: itemDetails.thumb,
      ducats: itemDetails.ducats || 0,
      price: price,
      volume: ordersData.payload.orders.length,
      average: allValidOrders.length > 0
        ? Math.round(allValidOrders.reduce((acc: number, o: any) => acc + o.platinum, 0) / allValidOrders.length)
        : 0,
      buyerUsername: highestBidder?.user?.ingame_name || null,
      buyerQuantity: highestBidder?.quantity || 0,
      hasBuyers: price > 0 || buyOrders.length > 0,
      buyerCount: buyOrders.length,
      sellerCount: sellOrders.length,
      sellerPrice: sellOrders.length > 0 ? Math.min(...sellOrders.map((o: any) => o.platinum)) : 0,
      sellerUsername: lowestSeller?.user?.ingame_name || null,
      sellerQuantity: lowestSeller?.quantity || 0
    };
  } catch (error) {
    marketLogger.error('fetchViaDirect', `Error fetching ${normalizedName}`, { error });
    throw error;
  }
};

/**
 * CRITICAL: Fetches market data for multiple prime parts with rate limiting
 */
export const fetchPriceData = async (primeParts: DetectedItem[]): Promise<DetectedItem[]> => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const RATE_LIMIT_DELAY = 334;

  const updatedParts = [];
  const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');

  for (const part of primeParts) {
    try {
      const normalizedName = normalizeItemName(part.name);
      marketLogger.info('PriceFetch', `Fetching data for: ${part.name}`);

      let data;
      if (isProduction) {
        try {
          data = await fetchViaNetlify(normalizedName);
        } catch {
          data = await fetchViaDirect(normalizedName);
        }
      } else {
        data = await fetchViaDirect(normalizedName);
      }

      const localImageUrl = await getImageUrl(part.name);

      updatedParts.push({
        ...part,
        price: data.price,
        ducats: data.ducats,
        volume: data.volume,
        average: data.average,
        recentAverage48h: data.recentAverage48h,
        imgUrl: localImageUrl,
        status: 'loaded' as const,
        error: data.price === 0 ? 'No active buy orders' : undefined,
        buyerUsername: data.buyerUsername,
        buyerQuantity: data.buyerQuantity,
        hasBuyers: data.hasBuyers,
        buyerCount: data.buyerCount,
        sellerCount: data.sellerCount,
        sellerPrice: data.sellerPrice,
        sellerUsername: data.sellerUsername,
        sellerQuantity: data.sellerQuantity
      } as DetectedItem);

      await delay(RATE_LIMIT_DELAY);
    } catch (error) {
      marketLogger.error('PriceFetch', `Failed for ${part.name}`, { error });
      updatedParts.push({
        ...part,
        status: 'error' as const,
        error: error instanceof Error ? error.message : 'Failed to fetch market data'
      });
    }
  }

  return updatedParts;
};

/**
 * CRITICAL: Fetches market data for multiple items in batch for relic value analysis
 */
export const fetchBatchPriceData = async (itemNames: string[]): Promise<any[]> => {
  const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');

  if (!isProduction) {
    const results = [];
    for (const itemName of itemNames) {
      try {
        const data = await fetchViaDirect(itemName);
        results.push(data);
      } catch {
        results.push({ name: itemName, price: 0 });
      }
      await new Promise(resolve => setTimeout(resolve, 334));
    }
    return results;
  }

  try {
    return await fetchBatchViaNetlify(itemNames);
  } catch {
    const results = [];
    for (const itemName of itemNames) {
      try {
        results.push(await fetchViaDirect(itemName));
      } catch {
        results.push({ name: itemName, price: 0 });
      }
      await new Promise(resolve => setTimeout(resolve, 334));
    }
    return results;
  }
};

/**
 * OPTIMIZED: Fetches only price data for a single prime part
 */
export const fetchSinglePriceOnly = async (primePart: DetectedItem): Promise<DetectedItem> => {
  const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');

  try {
    let data;
    let normalizedName: string;

    if (isProduction) {
      try {
        if (primePart.name.includes('Relic')) {
          data = await fetchRelicViaNetlify(primePart.name);
        } else if (primePart.category === 'mods') {
          normalizedName = normalizeModName(primePart.name, (primePart as any).rank);
          data = await fetchViaNetlify(normalizedName);
        } else {
          normalizedName = normalizeItemName(primePart.name);
          data = await fetchViaNetlify(normalizedName);
        }
      } catch {
        normalizedName = normalizeItemName(primePart.name);
        data = await fetchViaDirect(normalizedName);
      }
    } else {
      normalizedName = normalizeItemName(primePart.name);
      data = await fetchViaDirect(normalizedName);
    }

    return {
      ...primePart,
      price: data.price,
      ducats: data.ducats,
      volume: data.volume,
      average: data.average,
      status: 'loaded' as const,
      error: data.price === 0 ? 'No active buy orders' : undefined,
      buyerUsername: data.buyerUsername,
      buyerQuantity: data.buyerQuantity,
      sellerPrice: data.sellerPrice,
      sellerUsername: data.sellerUsername,
      sellerQuantity: data.sellerQuantity
    };
  } catch (error) {
    return {
      ...primePart,
      status: 'error' as const,
      error: error instanceof Error ? error.message : 'Failed to fetch market data'
    };
  }
};

/**
 * Determine item type based on item name
 */
const determineItemType = (itemName: string): 'weapon' | 'mod' | 'cosmetic' | 'resource' | 'other' => {
  const name = itemName.toLowerCase();
  if (name.includes('prime ') || name.includes(' vandal') || name.includes(' wraith')) return 'weapon';
  if (name.includes(' mod') || name.includes(' stance') || name.includes(' aura')) return 'mod';
  if (name.includes(' syandana') || name.includes(' skin')) return 'cosmetic';
  if (name.includes(' orokin cell') || name.includes(' neurodes')) return 'resource';
  return 'other';
};

/**
 * Fetches market data for a single item (Prime Part, Relic, or Syndicate Reward)
 */
export const fetchSinglePriceData = async (primePart: DetectedItem): Promise<DetectedItem> => {
  const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');

  try {
    let data;
    let normalizedName: string;

    if (isProduction) {
      try {
        if (primePart.name.includes('Relic')) {
          data = await fetchRelicViaNetlify(primePart.name);
        } else if (primePart.category === 'mods') {
          normalizedName = normalizeModName(primePart.name, (primePart as any).rank);
          data = await fetchViaNetlify(normalizedName);
        } else {
          normalizedName = normalizeItemName(primePart.name);
          data = await fetchViaNetlify(normalizedName);
        }
      } catch {
        normalizedName = normalizeItemName(primePart.name);
        data = await fetchViaDirect(normalizedName);
      }
    } else {
      normalizedName = normalizeItemName(primePart.name);
      data = await fetchViaDirect(normalizedName);
    }

    const localImageUrl = await getImageUrl(primePart.name);
    let itemType = (primePart as any).itemType;
    if (primePart.category === 'syndicate_rewards' && itemType === 'other') {
      itemType = determineItemType(primePart.name);
    }

    return {
      ...primePart,
      price: data.price,
      ducats: data.ducats,
      volume: data.volume,
      average: data.average,
      recentAverage48h: data.recentAverage48h,
      imgUrl: localImageUrl,
      itemType: itemType,
      status: 'loaded' as const,
      error: data.price === 0 ? 'No active buy orders' : undefined,
      buyerUsername: data.buyerUsername,
      buyerQuantity: data.buyerQuantity,
      hasBuyers: data.hasBuyers,
      buyerCount: data.buyerCount,
      sellerCount: data.sellerCount,
      sellerPrice: data.sellerPrice,
      sellerUsername: data.sellerUsername,
      sellerQuantity: data.sellerQuantity,
      rarity: data.rarity,
      tags: data.tags,
      thumb: data.thumb
    } as any;
  } catch (error) {
    return {
      ...primePart,
      status: 'error' as const,
      error: error instanceof Error ? error.message : 'Failed to fetch market data'
    };
  }
};

/**
 * NEW: Fetches market data for complete Prime Sets
 */
export const fetchPrimeSetMarketData = async (setName: string): Promise<{
  name: string;
  price: number;
  volume: number;
  average: number;
  buyerUsername: string | null;
  buyerQuantity: number;
  error?: string;
}> => {
  const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');

  try {
    const normalizedSetName = normalizeItemName(`${setName} Set`);
    let data;
    if (isProduction) {
      try {
        data = await fetchViaNetlify(setName, true);
      } catch {
        data = await fetchViaDirect(normalizedSetName);
      }
    } else {
      data = await fetchViaDirect(normalizedSetName);
    }

    return {
      name: `${setName} Set`,
      price: data.price || 0,
      volume: data.volume || 0,
      average: data.average || 0,
      buyerUsername: data.buyerUsername || null,
      buyerQuantity: data.buyerQuantity || 0,
      error: data.price === 0 ? 'No active buy orders for complete set' : undefined
    };
  } catch (error) {
    return {
      name: `${setName} Set`,
      price: 0,
      volume: 0,
      average: 0,
      buyerUsername: null,
      buyerQuantity: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch complete set market data'
    };
  }
};

/**
 * NEW: Fetches market data for multiple Prime Sets in batch
 */
export const fetchBatchPrimeSetMarketData = async (setNames: string[]): Promise<Array<{
  name: string;
  price: number;
  volume: number;
  average: number;
  buyerUsername: string | null;
  buyerQuantity: number;
  error?: string;
}>> => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const RATE_LIMIT_DELAY = 334;

  const results = [];
  for (const setName of setNames) {
    try {
      results.push(await fetchPrimeSetMarketData(setName));
      if (setNames.indexOf(setName) < setNames.length - 1) {
        await delay(RATE_LIMIT_DELAY);
      }
    } catch {
      results.push({
        name: `${setName} Set`,
        price: 0,
        volume: 0,
        average: 0,
        buyerUsername: null,
        buyerQuantity: 0,
        error: 'Failed to fetch market data'
      });
    }
  }

  return results;
};