import { DetectedItem, VoidRelic } from '../types';
import { getImageUrl } from './unifiedImageService';

// Helper function to check if a prime part is tradeable (only blueprints are tradeable)
const isPrimePartTradeable = (item: DetectedItem): boolean => {
  return item.category !== 'prime_parts' || item.name.toLowerCase().endsWith(' blueprint');
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
 * - Supabase Edge Function for API proxying (when available)
 * - Netlify proxy as fallback for direct API calls
 * - Environment variables for API configuration
 *
 * IMPORTANT: The 90-day median (average) price functionality requires
 * the Supabase Edge Function to be deployed. Without it, only current
 * prices will be available, not historical averages.
 *
 * Rate Limiting:
 * - Enforces 334ms delay between requests (~3 requests/second)
 * - Uses sequential processing to prevent API overload
 *
 * Error Handling:
 * - Returns formatted error objects for failed requests
 * - Continues processing remaining items if one fails
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
 * This is essential because leveled mods have different market entries and we never want to sell leveled mods
 */
const normalizeModName = (name: string, rank?: number): string => {
  // Always normalize to unranked mod name, regardless of the mod's actual rank
  // This ensures we only get prices for level 0 mods
  let modName = name;
  
  // Remove any rank information from the name (e.g., "Serration (R8)" -> "Serration")
  modName = modName.replace(/\s*\(R\d+\)$/i, '');
  modName = modName.replace(/\s*Rank\s+\d+$/i, '');
  
  // Normalize the base name
  return normalizeItemName(modName);
};

/**
 * Smart relic market lookup: Try refined relic first, fallback to base relic
 * Some relics have separate market entries for refinement levels (e.g., Axi Y1 Radiant vs Intact)
 */
const getRelicMarketNames = (relicName: string): string[] => {
  const names = [];

  // Try the refined relic first (e.g., "axi_y1_relic_radiant")
  names.push(normalizeItemName(relicName));

  // Fallback to base relic (e.g., "axi_y1_relic")
  if (relicName.includes('Relic')) {
    let baseRelicName = relicName;
    baseRelicName = baseRelicName.replace(/\s+\[(Intact|Exceptional|Flawless|Radiant)\]$/, ''); // Remove [Radiant]
    baseRelicName = baseRelicName.replace(/\s+\((Intact|Exceptional|Flawless|Radiant)\)$/, ''); // Remove (Radiant)

    const baseNormalized = normalizeItemName(baseRelicName);
    if (baseNormalized !== names[0]) {
      names.push(baseNormalized);
    }
  }

  return names;
};

/**
 * Fetches market data using Supabase Edge Function
 */
const fetchViaSupabase = async (normalizedName: string) => {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/warframe-market?item=${normalizedName}`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch market data');
  }

  return await response.json();
};

/**
 * Smart relic market fetch: Try refined first, fallback to base relic
 */
const fetchRelicViaSupabase = async (relicName: string) => {
  const marketNames = getRelicMarketNames(relicName);

  for (const marketName of marketNames) {
    try {
      const data = await fetchViaSupabase(marketName);

      // Check if the result has an error (but not a 500 server error)
      if (data.error) {
        if (data.error === 'not_found') {
          continue; // Try the next name in the fallback list
        } else {
          // Other errors (api_error, fetch_failed) should still throw
          throw new Error(`API error for ${marketName}: ${data.message || data.error}`);
        }
      }

      return data;
    } catch (error) {
      continue;
    }
  }

  // If all attempts failed, throw the last error
  throw new Error(`No market data found for relic: ${relicName}`);
};

/**
 * Fetches market data for multiple items in batch using Supabase Edge Function
 */
const fetchBatchViaSupabase = async (normalizedNames: string[]) => {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/warframe-market?batch=${encodeURIComponent(JSON.stringify(normalizedNames))}`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch batch market data');
  }

  const result = await response.json();
  return result.batch; // Returns array of item data
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
    // Fetch item details first
    const itemResponse = await fetch(`/api/warframe-market/items/${normalizedName}`, { headers });

    if (!itemResponse.ok) {
      throw new Error(`Item API error: ${itemResponse.status}`);
    }

    let itemData;
    try {
      const text = await itemResponse.text();
      console.log('Raw item response:', text);
      itemData = JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse item response:', e);
      throw new Error('Invalid item data format');
    }

    if (!itemData?.payload?.item?.items_in_set) {
      console.error('Unexpected item data structure:', itemData);
      throw new Error('Invalid item data structure');
    }

    // Fetch orders
    const ordersResponse = await fetch(`/api/warframe-market/items/${normalizedName}/orders`, { headers });

    if (!ordersResponse.ok) {
      throw new Error(`Orders API error: ${ordersResponse.status}`);
    }

    let ordersData;
    try {
      const text = await ordersResponse.text();
      console.log('Raw orders response:', text);
      ordersData = JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse orders response:', e);
      throw new Error('Invalid orders data format');
    }

    // Process the data
    const itemDetails = itemData.payload.item.items_in_set.find((item: any) =>
      item.url_name === normalizedName
    ) || itemData.payload.item.items_in_set[0];

    if (!itemDetails?.en?.item_name) {
      console.error('Item details missing required fields:', itemDetails);
      throw new Error('Item details not found');
    }

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

    // Find highest bidder
    const highestBidder = buyOrders.length > 0
      ? buyOrders.reduce((highest: any, current: any) =>
          current.platinum > highest.platinum ? current : highest
        )
      : null;

    // Calculate true market average from all orders
    const allValidOrders = ordersData.payload.orders.filter((order: any) =>
      ['online', 'ingame'].includes(order.user.status) &&
      !order.user.banned &&
      order.visible
    );

    return {
      name: itemDetails.en.item_name,
      thumb: itemDetails.thumb,
      ducats: itemDetails.ducats || 0,
      price: buyOrders.length > 0 ? Math.max(...buyOrders.map((o: any) => o.platinum)) : 0,
      volume: ordersData.payload.orders.length,
      average: allValidOrders.length > 0
        ? Math.round(allValidOrders.reduce((acc: number, o: any) => acc + o.platinum, 0) / allValidOrders.length)
        : 0,
      buyerUsername: highestBidder?.user?.ingame_name || null,
      buyerQuantity: highestBidder?.quantity || 0
    };
  } catch (error) {
    console.error('Error in fetchViaDirect:', error);
    throw error;
  }
};

/**
 * CRITICAL: Fetches market data for multiple prime parts with rate limiting
 *
 * @param primeParts - Array of PrimePart objects to fetch data for
 * @returns Updated array with market data
 *
 * IMPORTANT:
 * - Maintains rate limiting of 3 requests per second
 * - Returns partial results if some items fail
 * - Includes error handling for each item
 * - Uses Supabase Edge Function when available, fallback to direct API calls
 */
export const fetchPriceData = async (primeParts: DetectedItem[]): Promise<DetectedItem[]> => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const RATE_LIMIT_DELAY = 334; // ~3 requests per second

  const updatedParts = [];
  const useSupabase = SUPABASE_URL && SUPABASE_ANON_KEY;

  console.log(`Using ${useSupabase ? 'Supabase Edge Function' : 'Direct API calls'} for market data`);

  for (const part of primeParts) {
    // Skip non-tradeable items (non-blueprint prime parts)
    if (!isPrimePartTradeable(part)) {
      console.log(`Skipping non-tradeable item: ${part.name}`);
      updatedParts.push({
        ...part,
        price: 0,
        volume: 0,
        average: 0,
        status: 'loaded' as const
      });
      continue;
    }

    try {
      const normalizedName = normalizeItemName(part.name);
      console.log(`Fetching data for: ${part.name} (${normalizedName})`);

      let data;
      if (useSupabase) {
        data = await fetchViaSupabase(normalizedName);
      } else {
        data = await fetchViaDirect(normalizedName);
      }

      console.log(`Raw data for ${part.name}:`, data);

      // Use local images based on item name instead of external CDN
      const localImageUrl = await getImageUrl(part.name);

      updatedParts.push({
        ...part,
        price: data.price,
        ducats: data.ducats,
        volume: data.volume,
        average: data.average,
        imgUrl: localImageUrl,
        status: 'loaded' as const,
        error: data.price === 0 ? 'No active buy orders' : undefined,
        buyerUsername: data.buyerUsername,
        buyerQuantity: data.buyerQuantity
      });

      // Add delay between requests
      await delay(RATE_LIMIT_DELAY);
    } catch (error) {
      console.error(`Failed to fetch item details for ${part.name}:`, error);
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
 *
 * @param itemNames - Array of Warframe Market URL names to fetch
 * @returns Array of price data objects
 */
export const fetchBatchPriceData = async (itemNames: string[]): Promise<any[]> => {
  const useSupabase = SUPABASE_URL && SUPABASE_ANON_KEY;
  const isDevMode = __DEV_MODE__ === 'true';

  console.log(`>>> [Batch Request] ${itemNames.length} items - Supabase: ${useSupabase ? 'available' : 'not configured'} - Dev Mode: ${isDevMode} <<<`);

  // In development mode, force direct API calls for easier debugging
  if (!useSupabase || isDevMode) {
    console.log(`>>> [Batch Request] Using direct API calls (${isDevMode ? 'dev mode override' : 'no Supabase config'}) <<<`);
    const results = [];
    for (let i = 0; i < itemNames.length; i++) {
      const itemName = itemNames[i];
      try {
        console.log(`>>> [Batch Direct] Fetching ${i + 1}/${itemNames.length}: ${itemName} <<<`);
        const data = await fetchViaDirect(itemName);
        results.push(data);
        console.log(`>>> [Batch Direct] Success: ${itemName} = ${data.price}p <<<`);
      } catch (error) {
        console.error(`>>> [Batch Direct] Failed: ${itemName}:`, error);
        results.push({
          name: itemName,
          price: 0,
          error: error instanceof Error ? error.message : 'Failed to fetch'
        });
      }
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 334));
    }
    console.log(`>>> [Batch Direct] Completed: ${results.length} items processed <<<`);
    return results;
  }

  try {
    console.log(`>>> [Batch Supabase] Fetching ${itemNames.length} items via Edge Function <<<`);
    const results = await fetchBatchViaSupabase(itemNames);
    console.log(`>>> [Batch Supabase] Completed:`, results);
    return results;
  } catch (error) {
    console.error('>>> [Batch Supabase] Failed:', error);
    throw error;
  }
};

/**
 * OPTIMIZED: Fetches only price data for a single prime part (preserves images)
 *
 * Use this for: Price refreshes, inventory updates
 * Performance: Faster - only updates price fields, preserves existing imgUrl
 *
 * @param primePart - Single PrimePart object to fetch prices for
 * @returns Updated PrimePart with new price data but preserved image
 */
export const fetchSinglePriceOnly = async (primePart: DetectedItem): Promise<DetectedItem> => {
  const useSupabase = SUPABASE_URL && SUPABASE_ANON_KEY;

  try {
    console.log(`Fetching price data for: ${primePart.name}`);

    let data;
    let normalizedName: string;
    
    if (useSupabase) {
      // Use smart relic lookup for relics, mod-specific normalization for mods
      if (primePart.name.includes('Relic')) {
        data = await fetchRelicViaSupabase(primePart.name);
      } else if (primePart.category === 'mods') {
        // For mods, always fetch unranked (level 0) prices
        const modItem = primePart as any;
        normalizedName = normalizeModName(primePart.name, modItem.rank);
        console.log(`>>> [Mod Price Fetch] Normalized mod name: "${primePart.name}" -> "${normalizedName}" (ensuring unranked prices) <<<`);
        data = await fetchViaSupabase(normalizedName);
      } else {
        normalizedName = normalizeItemName(primePart.name);
        data = await fetchViaSupabase(normalizedName);
      }
    } else {
      if (primePart.category === 'mods') {
        // For mods, always fetch unranked (level 0) prices
        const modItem = primePart as any;
        normalizedName = normalizeModName(primePart.name, modItem.rank);
        console.log(`>>> [Mod Price Fetch] Normalized mod name: "${primePart.name}" -> "${normalizedName}" (ensuring unranked prices) <<<`);
      } else {
        normalizedName = normalizeItemName(primePart.name);
      }
      data = await fetchViaDirect(normalizedName);
    }

    console.log(`Raw price data for ${primePart.name}:`, data);

    return {
      ...primePart,
      // Only update price-related fields, preserve existing imgUrl
      price: data.price,
      ducats: data.ducats,
      volume: data.volume,
      average: data.average,
      status: 'loaded' as const,
      error: data.price === 0 ? 'No active buy orders' : undefined,
      buyerUsername: data.buyerUsername,
      buyerQuantity: data.buyerQuantity
      // imgUrl is preserved from existing primePart
    };

  } catch (error) {
    console.error(`Failed to fetch price data for ${primePart.name}:`, error);
    return {
      ...primePart,
      status: 'error' as const,
      error: error instanceof Error ? error.message : 'Failed to fetch market data'
      // imgUrl is preserved from existing primePart
    };
  }
};

/**
 * Determine item type based on item name
 */
const determineItemType = (itemName: string): 'weapon' | 'mod' | 'cosmetic' | 'resource' | 'other' => {
  const name = itemName.toLowerCase();

  // Weapon prefixes
  if (name.includes('telos ') || name.includes('secura ') || name.includes('synoid ') ||
      name.includes('rakta ') || name.includes('sancti ') || name.includes('vaykor ') ||
      name.includes('prime ') || name.includes(' vandal') || name.includes(' wraith') ||
      name.includes(' prisma ') || name.includes(' mara ') || name.includes(' dex ')) {
    return 'weapon';
  }

  // Mod indicators
  if (name.includes(' augment') || name.includes(' mod') || name.includes(' stance') ||
      name.includes(' aura') || name.includes(' exilus') || name.includes(' nightmare')) {
    return 'mod';
  }

  // Cosmetic indicators
  if (name.includes(' syandana') || name.includes(' sugatra') || name.includes(' armor') ||
      name.includes(' skin') || name.includes(' ephemera') || name.includes(' noggle') ||
      name.includes(' decoration') || name.includes(' emote')) {
    return 'cosmetic';
  }

  // Resource indicators
  if (name.includes(' alloy') || name.includes(' polymer') || name.includes(' ferrite') ||
      name.includes(' plastids') || name.includes(' neurodes') || name.includes(' orokin cell') ||
      name.includes(' argon') || name.includes(' oxium') || name.includes(' tellurium')) {
    return 'resource';
  }

  return 'other';
};

/**
 * Fetches market data for a single item (Prime Part, Relic, or Syndicate Reward)
 *
 * @param primePart - Single DetectedItem object to fetch data for
 * @returns Updated DetectedItem with market data
 */
export const fetchSinglePriceData = async (primePart: DetectedItem): Promise<DetectedItem> => {
  // Skip non-tradeable items (non-blueprint prime parts)
  if (!isPrimePartTradeable(primePart)) {
    console.log(`Skipping non-tradeable item: ${primePart.name}`);
    return {
      ...primePart,
      price: 0,
      volume: 0,
      average: 0,
      status: 'loaded' as const
    };
  }

  const useSupabase = SUPABASE_URL && SUPABASE_ANON_KEY;

  try {
    console.log(`Fetching data for: ${primePart.name}`);

    let data;
    let normalizedName: string;
    
    if (useSupabase) {
      // Use smart relic lookup for relics, mod-specific normalization for mods
      if (primePart.name.includes('Relic')) {
        data = await fetchRelicViaSupabase(primePart.name);
      } else if (primePart.category === 'mods') {
        // For mods, always fetch unranked (level 0) prices
        const modItem = primePart as any;
        normalizedName = normalizeModName(primePart.name, modItem.rank);
        console.log(`>>> [Mod Price Fetch] Normalized mod name: "${primePart.name}" -> "${normalizedName}" (ensuring unranked prices) <<<`);
        data = await fetchViaSupabase(normalizedName);
      } else {
        normalizedName = normalizeItemName(primePart.name);
        data = await fetchViaSupabase(normalizedName);
      }
    } else {
      if (primePart.category === 'mods') {
        // For mods, always fetch unranked (level 0) prices
        const modItem = primePart as any;
        normalizedName = normalizeModName(primePart.name, modItem.rank);
        console.log(`>>> [Mod Price Fetch] Normalized mod name: "${primePart.name}" -> "${normalizedName}" (ensuring unranked prices) <<<`);
      } else {
        normalizedName = normalizeItemName(primePart.name);
      }
      data = await fetchViaDirect(normalizedName);
    }

    console.log(`Raw data for ${primePart.name}:`, data);

    // Use local images based on item name instead of external CDN
    const localImageUrl = await getImageUrl(primePart.name);

    // Determine item type for syndicate rewards
    let itemType = primePart.itemType;
    if (primePart.category === 'syndicate_rewards' && itemType === 'other') {
      itemType = determineItemType(primePart.name);
    }

    return {
      ...primePart,
      price: data.price,
      ducats: data.ducats,
      volume: data.volume,
      average: data.average,
      imgUrl: localImageUrl,
      itemType: itemType,
      status: 'loaded' as const,
      error: data.price === 0 ? 'No active buy orders' : undefined,
      buyerUsername: data.buyerUsername,
      buyerQuantity: data.buyerQuantity,
      // Add missing fields for mods
      rarity: data.rarity,
      tags: data.tags,
      thumb: data.thumb
    };

  } catch (error) {
    console.error(`Failed to fetch item details for ${primePart.name}:`, error);
    return {
      ...primePart,
      status: 'error' as const,
      error: error instanceof Error ? error.message : 'Failed to fetch market data'
    };
  }
};

/**
 * NEW: Fetches market data for complete Prime Sets
 *
 * @param setName - Prime Set name (e.g., "Ash Prime", "Mesa Prime")
 * @returns Market data for the complete set
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
  const useSupabase = SUPABASE_URL && SUPABASE_ANON_KEY;

  try {
    // Normalize set name to match Warframe Market format (e.g., "ash_prime_set")
    const normalizedSetName = normalizeItemName(`${setName} Set`);
    console.log(`🎯 [Prime Set] Fetching market data for: ${setName} Set (${normalizedSetName})`);

    let data;
    if (useSupabase) {
      data = await fetchViaSupabase(normalizedSetName);
    } else {
      data = await fetchViaDirect(normalizedSetName);
    }

    console.log(`🎯 [Prime Set] Raw data for ${setName} Set:`, data);

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
    console.error(`🎯 [Prime Set] Failed to fetch market data for ${setName} Set:`, error);
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
 *
 * @param setNames - Array of Prime Set names
 * @returns Array of market data for complete sets
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
  const RATE_LIMIT_DELAY = 334; // ~3 requests per second

  console.log(`🎯 [Prime Sets Batch] Fetching market data for ${setNames.length} complete sets`);

  const results = [];
  for (const setName of setNames) {
    try {
      const data = await fetchPrimeSetMarketData(setName);
      results.push(data);

      // Add delay between requests to respect rate limits
      if (setNames.indexOf(setName) < setNames.length - 1) {
        await delay(RATE_LIMIT_DELAY);
      }
    } catch (error) {
      console.error(`🎯 [Prime Sets Batch] Failed to fetch ${setName}:`, error);
      results.push({
        name: `${setName} Set`,
        price: 0,
        volume: 0,
        average: 0,
        buyerUsername: null,
        buyerQuantity: 0,
        error: error instanceof Error ? error.message : 'Failed to fetch market data'
      });
    }
  }

  console.log(`🎯 [Prime Sets Batch] Completed: ${results.length} sets processed`);
  return results;
};