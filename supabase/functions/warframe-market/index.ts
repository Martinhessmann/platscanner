import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Cache for market data to avoid rate limits
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const WARFRAME_MARKET_API = 'https://api.warframe.market/v1';

/**
 * Warframe Market API Proxy
 *
 * This Edge Function provides:
 * - Current market prices (highest buy orders)
 * - 90-day median/average prices (seller statistics)
 * - 48-hour recent average price (seller statistics)
 * - Buyer presence and counts (hasBuyers, buyerCount)
 * - Market volume data
 * - Rate limiting and caching
 *
 * IMPORTANT: This function must be deployed to Supabase for the
 * 90-day median price functionality to work in the frontend.
 *
 * MOD RANK FILTERING:
 * - For mods, only unranked (rank 0) orders are included in price calculations
 * - This ensures we never show prices for leveled mods that shouldn't be sold
 * - Ranked mod orders are filtered out from both current prices and averages
 */

/**
 * Normalizes item names to match Warframe Market URL format
 * Handles special cases for mods and other items
 */
const normalizeItemName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/\s*&\s*/g, '_and_') // Replace & with '_and_'
    .replace(/'/g, '') // Remove apostrophes (e.g., "Hunter's Munitions" -> "hunters_munitions")
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[^a-z0-9_]/g, '') // Remove any remaining special characters
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
};

/**
 * Handles errors and returns a consistent error response
 */
const handleError = (error: Error, status = 500) => {
  console.error('Error:', error);
  return new Response(
    JSON.stringify({
      error: error.message || 'Internal server error',
      status
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    }
  );
};

/**
 * Fetches price data for a single item
 */
const fetchSingleItemData = async (itemName: string) => {
  // Check cache
  const cached = cache.get(itemName);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  // API request headers
  const apiHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Language': 'en',
    'Platform': 'pc',
    'User-Agent': 'PlatScanner/1.8.0'
  };

  try {
    const [itemResponse, ordersResponse, statsResponse] = await Promise.all([
      fetch(`${WARFRAME_MARKET_API}/items/${itemName}`, { headers: apiHeaders }),
      fetch(`${WARFRAME_MARKET_API}/items/${itemName}/orders`, { headers: apiHeaders }),
      fetch(`${WARFRAME_MARKET_API}/items/${itemName}/statistics`, { headers: apiHeaders })
    ]);

    // Handle "item not found" cases gracefully for client-side fallbacks
    if (!itemResponse.ok || !ordersResponse.ok) {
      const errorType = itemResponse.status === 404 || ordersResponse.status === 404 ? 'not_found' : 'api_error';
      console.log(`>>> [Supabase] ${itemName}: ${errorType} (status: ${itemResponse.status}/${ordersResponse.status}) <<<`);

      return {
        name: itemName,
        thumb: '',
        ducats: 0,
        price: 0,
        volume: 0,
        average: 0,
        error: errorType,
        status: itemResponse.status || ordersResponse.status,
        // Add mod-specific fields for consistency
        tags: [],
        rarity: 'common',
        mod_max_rank: 0,
        trading_tax: 0
      };
    }

    const [itemData, ordersData, statsData] = await Promise.all([
      itemResponse.json(),
      ordersResponse.json(),
      statsResponse.ok ? statsResponse.json() : Promise.resolve({ payload: { statistics_closed: { '90days': [] } } })
    ]);

    // Get the item details from the set
    const itemDetails = itemData.payload.item.items_in_set.find((item: any) =>
      item.url_name === itemName
    ) || itemData.payload.item.items_in_set[0];

    // Extract averages from statistics (seller data)
    let historicalAverage = 0;
    let recentAverage48h = 0;
    if (statsData.payload && statsData.payload.statistics_closed) {
      const closedStats = statsData.payload.statistics_closed;
      if (closedStats['90days'] && closedStats['90days'].length > 0) {
        const latest90 = closedStats['90days'][closedStats['90days'].length - 1];
        historicalAverage = latest90.avg_price || 0;
      }
      if (closedStats['48hours'] && closedStats['48hours'].length > 0) {
        const latest48 = closedStats['48hours'][closedStats['48hours'].length - 1];
        recentAverage48h = latest48.avg_price || 0;
      }
      console.log(`>>> [Supabase] ${itemName}: avg90=${historicalAverage}p, avg48h=${recentAverage48h}p <<<`);
    }

    // Process orders
    const buyOrders = ordersData.payload.orders.filter((order: any) =>
      order.order_type === 'buy' &&
      ['online', 'ingame'].includes(order.user.status) &&
      !order.user.banned &&
      order.visible &&
      // For mods, only include unranked (rank 0) orders
      (itemDetails.mod_max_rank === undefined || order.mod_rank === 0 || order.mod_rank === undefined)
    );

    // Find highest bidder
    const highestBidder = buyOrders.length > 0
      ? buyOrders.reduce((highest: any, current: any) =>
          current.platinum > highest.platinum ? current : highest
        )
      : null;

    // Count unranked buy orders for volume (current buyers)
    const allValidBuyOrders = ordersData.payload.orders.filter((order: any) =>
      order.order_type === 'buy' &&
      ['online', 'ingame'].includes(order.user.status) &&
      !order.user.banned &&
      order.visible &&
      // For mods, only include unranked (rank 0) orders
      (itemDetails.mod_max_rank === undefined || order.mod_rank === 0 || order.mod_rank === undefined)
    );

    // Log rank filtering for mods
    if (itemDetails.mod_max_rank !== undefined) {
      const totalOrders = ordersData.payload.orders.length;
      const unrankedBuyOrders = allValidBuyOrders.length;
      const rankedOrders = totalOrders - unrankedBuyOrders;
      console.log(`>>> [Supabase] ${itemName}: Mod rank filtering - Total: ${totalOrders}, Unranked Buy Orders: ${unrankedBuyOrders}, Ranked: ${rankedOrders} <<<`);
    }

    const sellerOrders = ordersData.payload.orders.filter((order: any) =>
      order.order_type === 'sell' &&
      ['online', 'ingame'].includes(order.user.status) &&
      !order.user.banned &&
      order.visible
    );

    // Find lowest seller for investment cost calculations
    const lowestSeller = sellerOrders.length > 0
      ? sellerOrders.reduce((lowest: any, current: any) =>
          current.platinum < lowest.platinum ? current : lowest
        )
      : null;

    const result = {
      name: itemDetails.en.item_name,
      thumb: itemDetails.thumb ? itemDetails.thumb.replace('https://warframe.market/static/assets/', '') : '',
      ducats: itemDetails.ducats || 0,
      price: buyOrders.length > 0 ? Math.max(...buyOrders.map((o: any) => o.platinum)) : 0,
      volume: allValidBuyOrders.length, // Only count unranked buy orders for mods
      average: historicalAverage, // Use 90-day historical average from seller data
      recentAverage48h: recentAverage48h,
      buyerUsername: highestBidder?.user?.ingame_name || null,
      buyerQuantity: highestBidder?.quantity || 0,
      hasBuyers: buyOrders.length > 0,
      buyerCount: buyOrders.length,
      sellerCount: sellerOrders.length,
      // Seller data for investment cost calculations
      sellerPrice: sellerOrders.length > 0 ? Math.min(...sellerOrders.map((o: any) => o.platinum)) : 0,
      sellerUsername: lowestSeller?.user?.ingame_name || null,
      sellerQuantity: lowestSeller?.quantity || 0,
      // Add mod-specific fields
      tags: itemDetails.tags || [],
      rarity: itemDetails.rarity || 'common',
      mod_max_rank: itemDetails.mod_max_rank || 0,
      trading_tax: itemDetails.trading_tax || 0
    };

    // Cache the result
    cache.set(itemName, { data: result, timestamp: Date.now() });
    console.log(`>>> [Supabase] ${itemName}: Success (${result.price}p) <<<`);
    return result;
  } catch (error) {
    console.error(`>>> [Supabase] ${itemName}: Exception -`, error);
    return {
      name: itemName,
      thumb: '',
      ducats: 0,
      price: 0,
      volume: 0,
      average: 0,
      error: 'fetch_failed',
      message: error.message,
      // Add mod-specific fields for consistency
      tags: [],
      rarity: 'common',
      mod_max_rank: 0,
      trading_tax: 0
    };
  }
};


/**
 * Handles batch requests for relic value analysis
 */
const handleBatchRequest = async (batchItems: string) => {
  try {
    const itemNames = JSON.parse(batchItems);

    if (!Array.isArray(itemNames) || itemNames.length === 0) {
      return handleError(new Error('Invalid batch items format'), 400);
    }

    // Limit batch size to prevent overload
    if (itemNames.length > 10) {
      return handleError(new Error('Batch size too large (max 10 items)'), 400);
    }

    // Fetch all items in parallel
    const results = await Promise.all(
      itemNames.map(itemName => fetchSingleItemData(itemName))
    );

    return new Response(
      JSON.stringify({ batch: results }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    return handleError(error);
  }
};

/**
 * Proxies Warframe Market images to avoid CORS issues
 */
const proxyImage = async (imagePath: string) => {
  try {
    const imageUrl = `https://warframe.market/static/assets/${imagePath}`;
    console.log(`>>> [Supabase] Proxying image: ${imageUrl}`);

    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`Image fetch failed: ${response.status}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error(`>>> [Supabase] Image proxy error:`, error);
    return handleError(error, 404);
  }
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Parse URL first to check for image requests
  const url = new URL(req.url);
  const imagePath = url.searchParams.get('image');

  // Handle image proxy requests (no auth required for images)
  if (imagePath) {
    console.log(`>>> [Supabase] Image request detected: ${imagePath}`);
    return await proxyImage(imagePath);
  }

  try {
    const url = new URL(req.url);
    const itemName = url.searchParams.get('item');
    const batchItems = url.searchParams.get('batch');
    const isPrimeSet = url.searchParams.get('prime_set') === 'true';

    // Handle batch requests for relic value analysis
    if (batchItems) {
      return await handleBatchRequest(batchItems);
    }

    if (!itemName) {
      return handleError(new Error('Item name is required'), 400);
    }

    // Handle Prime Set requests with proper URL formatting
    let normalizedItemName = itemName;
    if (isPrimeSet) {
      // For Prime Sets, ensure we have the '_set' suffix
      if (!itemName.toLowerCase().endsWith('_set')) {
        normalizedItemName = normalizeItemName(itemName) + '_set';
      } else {
        normalizedItemName = normalizeItemName(itemName);
      }
      console.log(`>>> [Supabase] Prime Set request: ${itemName} -> ${normalizedItemName} <<<`);
    }

    // Use the refactored single item fetcher with normalized name
    const result = await fetchSingleItemData(normalizedItemName);

    // Only return 500 errors for actual server issues, not "item not found"
    if (result.error && result.error !== 'not_found') {
      console.error(`>>> [Supabase] Server error for ${itemName}:`, result.error, result.message);
      return handleError(new Error(result.message || result.error));
    }

    // Return successful response (including "not found" items for client-side fallback)
    return new Response(
      JSON.stringify(result),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    console.error(`>>> [Supabase] Unexpected error:`, error);
    return handleError(error);
  }
});
