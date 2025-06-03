import { PrimePart } from '../types';

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
 * Fetches market data using direct API calls via Netlify proxy
 */
const fetchViaDirect = async (normalizedName: string) => {
  const [itemResponse, ordersResponse] = await Promise.all([
    fetch(`/api/warframe-market/items/${normalizedName}`, {
      headers: {
        'Accept': 'application/json',
        'Language': 'en',
        'Platform': 'pc'
      }
    }),
    fetch(`/api/warframe-market/items/${normalizedName}/orders`, {
      headers: {
        'Accept': 'application/json',
        'Language': 'en',
        'Platform': 'pc'
      }
    })
  ]);

  if (!itemResponse.ok || !ordersResponse.ok) {
    throw new Error('Item not found or API error');
  }

  const [itemData, ordersData] = await Promise.all([
    itemResponse.json(),
    ordersResponse.json()
  ]);

  // Process the data similar to the edge function
  const itemDetails = itemData.payload.item.items_in_set.find((item: any) =>
    item.url_name === normalizedName
  ) || itemData.payload.item.items_in_set[0];

  const buyOrders = ordersData.payload.orders.filter((order: any) =>
    order.order_type === 'buy' &&
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
    average: buyOrders.length > 0
      ? Math.round(buyOrders.reduce((acc: number, o: any) => acc + o.platinum, 0) / buyOrders.length)
      : 0
  };
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
export const fetchPriceData = async (primeParts: PrimePart[]): Promise<PrimePart[]> => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const RATE_LIMIT_DELAY = 334; // ~3 requests per second

  const updatedParts = [];
  const useSupabase = SUPABASE_URL && SUPABASE_ANON_KEY;

  console.log(`Using ${useSupabase ? 'Supabase Edge Function' : 'Direct API calls'} for market data`);

  for (const part of primeParts) {
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

      updatedParts.push({
        ...part,
        price: data.price,
        ducats: data.ducats,
        volume: data.volume,
        average: data.average,
        imgUrl: data.thumb && `https://warframe.market/static/assets/${data.thumb}`,
        status: 'loaded' as const,
        error: data.price === 0 ? 'No active buy orders' : undefined
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