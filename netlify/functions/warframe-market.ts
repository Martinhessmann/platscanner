// Netlify Function for Warframe Market API Proxy
// Provides rate limiting, caching, and CORS handling

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Cache for market data to avoid rate limits
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const WARFRAME_MARKET_API_V2 = 'https://api.warframe.market/v2';
const WARFRAME_MARKET_API_V1 = 'https://api.warframe.market/v1';

/**
 * Normalizes item names to match Warframe Market URL format
 * 
 * IMPORTANT: Warframe Market API structure:
 * - Querying a prime set (e.g., "garuda_prime") returns items_in_set with all components
 * - For warframe components (blueprint, chassis, neuroptics, systems), query the base name
 * - Example: "Garuda Prime Blueprint" -> query "garuda_prime", then find "garuda_prime_blueprint" in items_in_set
 */
const normalizeItemName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/\s*&\s*/g, '_and_')
    .replace(/'/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
};

/**
 * Extracts the base prime name for prime components
 * For prime components (warframe or weapon), we need to query the base set name, not the component name
 * Example: "garuda_prime_blueprint" -> "garuda_prime"
 * Example: "ninkondi_prime_blueprint" -> "ninkondi_prime"
 */
const getBasePrimeName = (itemName: string): string | null => {
  // Check if this is a warframe component (blueprint, chassis, neuroptics, systems)
  const warframeComponentPattern = /^(.+_prime)_(blueprint|chassis|neuroptics|systems)$/;
  const warframeMatch = itemName.match(warframeComponentPattern);
  if (warframeMatch) {
    return warframeMatch[1]; // Return base name (e.g., "garuda_prime")
  }
  
  // Check if this is a weapon blueprint (weapons only have blueprints, not chassis/neuroptics/systems)
  // Pattern: "weapon_prime_blueprint" -> "weapon_prime"
  const weaponBlueprintPattern = /^(.+_prime)_blueprint$/;
  const weaponMatch = itemName.match(weaponBlueprintPattern);
  if (weaponMatch) {
    // Verify it's not already matched as a warframe component
    // If it ends with _prime_blueprint and doesn't match warframe pattern, it's likely a weapon
    return weaponMatch[1]; // Return base name (e.g., "ninkondi_prime")
  }
  
  return null;
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

  const apiHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Language': 'en',
    'Platform': 'pc',
    'User-Agent': 'PlatScanner/1.8.0'
  };

  // V2 API works directly with item slugs - no need for base name lookup
  try {
    // Query item data and orders from v2 API
    let itemResponse, ordersResponse;
    try {
      [itemResponse, ordersResponse] = await Promise.all([
        fetch(`${WARFRAME_MARKET_API_V2}/items/${itemName}`, { headers: apiHeaders }),
        fetch(`${WARFRAME_MARKET_API_V2}/orders/item/${itemName}/top`, { headers: apiHeaders }).catch((err) => {
          console.log(`>>> [Netlify] ${itemName}: V2 Orders endpoint failed <<<`);
          return { ok: false, status: 404, json: () => Promise.resolve({ data: { buy: [], sell: [] }, error: null }) };
        })
      ]);
    } catch (error) {
      console.log(`>>> [Netlify] ${itemName}: Fetch error: ${error} <<<`);
      throw error;
    }

    // Log API responses for debugging
    console.log(`>>> [Netlify] ${itemName}: Item=${itemResponse.status}, Orders=${ordersResponse.status} <<<`);

    // If item lookup failed, return error
    if (!itemResponse.ok) {
      const errorType = itemResponse.status === 404 ? 'not_found' : 'api_error';
      console.log(`>>> [Netlify] ${itemName}: ${errorType} (item status: ${itemResponse.status}) <<<`);

      return {
        name: itemName,
        thumb: '',
        ducats: 0,
        price: 0,
        volume: 0,
        average: 0,
        error: errorType,
        status: itemResponse.status || ordersResponse.status,
        tags: [],
        rarity: 'common',
        mod_max_rank: 0,
        trading_tax: 0
      };
    }

    const [itemData, ordersData] = await Promise.all([
      itemResponse.json(),
      ordersResponse.ok ? ordersResponse.json() : Promise.resolve({ data: { buy: [], sell: [] }, error: null })
    ]);
    
    // V2 API structure: { apiVersion, data: { buy: [], sell: [] }, error }
    if (ordersData.error) {
      console.log(`>>> [Netlify] ${itemName}: V2 Orders API error: ${JSON.stringify(ordersData.error)} <<<`);
    }
    
    // Debug: Log orders response structure
    if (ordersResponse.ok && ordersData.data) {
      console.log(`>>> [Netlify] ${itemName}: V2 Orders - Buy orders: ${ordersData.data.buy?.length || 0}, Sell orders: ${ordersData.data.sell?.length || 0} <<<`);
      if (ordersData.data.sell && ordersData.data.sell.length > 0) {
        const firstSellOrder = ordersData.data.sell[0];
        console.log(`>>> [Netlify] ${itemName}: First sell order: platinum=${firstSellOrder.platinum}, user=${firstSellOrder.user?.ingame_name || 'unknown'} <<<`);
      }
    }

    // V2 API structure: { apiVersion, data: { ... }, error }
    // Items are queried directly by slug, no items_in_set lookup needed
    if (itemData.error) {
      throw new Error(`API error: ${itemData.error}`);
    }
    
    const itemDetails = itemData.data;
    
    // Process V2 orders structure: { data: { buy: [], sell: [] } }
    // V2 /top endpoint already filters to online users only and sorts by price
    const buyOrders = ordersData.data?.buy || [];
    const sellOrders = ordersData.data?.sell || [];
    
    console.log(`>>> [Netlify] ${itemName}: V2 Orders - Buy: ${buyOrders.length}, Sell: ${sellOrders.length} <<<`);
    
    // V2 already filters to online users, so we can use them directly
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
    
    if (lowestSeller) {
      console.log(`>>> [Netlify] ${itemName}: Lowest seller: ${lowestSeller.platinum}p (${lowestSeller.user?.ingame_name}) <<<`);
    }
    
    // Calculate average from all orders (buy + sell) for display
    const allOrders = [...buyOrders, ...sellOrders];
    let historicalAverage = 0;
    let recentAverage48h = 0;
    
    if (allOrders.length > 0) {
      const totalPlat = allOrders.reduce((sum: number, o: any) => sum + o.platinum, 0);
      historicalAverage = Math.round(totalPlat / allOrders.length);
      recentAverage48h = historicalAverage;
    }

    // Calculate buyer price from orders (highest buy order)
    const priceFromOrders = buyOrders.length > 0 ? Math.max(...buyOrders.map((o: any) => o.platinum)) : 0;
    
    console.log(`>>> [Netlify] ${itemName}: Price calculation - Buyer: ${priceFromOrders}p, Average: ${historicalAverage}p (from ${allOrders.length} orders) <<<`);

    const result = {
      name: itemDetails.i18n?.en?.name || itemName,
      thumb: itemDetails.i18n?.en?.thumb || '',
      ducats: itemDetails.ducats || 0,
      price: priceFromOrders, // Highest buy order (what user can sell for)
      volume: allOrders.length, // Total orders
      average: historicalAverage, // Average from current orders
      recentAverage48h: recentAverage48h, // Same as average (no historical data)
      buyerUsername: highestBidder?.user?.ingame_name || null,
      buyerQuantity: highestBidder?.quantity || 0,
      hasBuyers: buyOrders.length > 0,
      buyerCount: buyOrders.length,
      sellerCount: sellOrders.length,
      sellerPrice: sellOrders.length > 0 ? Math.min(...sellOrders.map((o: any) => o.platinum)) : 0, // Lowest sell order (what it costs to buy)
      sellerUsername: lowestSeller?.user?.ingame_name || null,
      sellerQuantity: lowestSeller?.quantity || 0,
      tags: itemDetails.tags || [],
      rarity: itemDetails.rarity || 'common',
      mod_max_rank: itemDetails.mod_max_rank || 0,
      trading_tax: itemDetails.tradingTax || 0
    };

    // Cache the result
    cache.set(itemName, { data: result, timestamp: Date.now() });
    console.log(`>>> [Netlify] ${itemName}: Success (${result.price}p) <<<`);
    return result;
  } catch (error: any) {
    console.error(`>>> [Netlify] ${itemName}: Exception -`, error);
    return {
      name: itemName,
      thumb: '',
      ducats: 0,
      price: 0,
      volume: 0,
      average: 0,
      error: 'fetch_failed',
      message: error.message,
      tags: [],
      rarity: 'common',
      mod_max_rank: 0,
      trading_tax: 0
    };
  }
};

/**
 * Handles batch requests
 */
const handleBatchRequest = async (batchItems: string) => {
  try {
    const itemNames = JSON.parse(batchItems);

    if (!Array.isArray(itemNames) || itemNames.length === 0) {
      throw new Error('Invalid batch items format');
    }

    if (itemNames.length > 10) {
      throw new Error('Batch size too large (max 10 items)');
    }

    const results = await Promise.all(
      itemNames.map(itemName => fetchSingleItemData(itemName))
    );

    return { batch: results };
  } catch (error: any) {
    throw error;
  }
};

/**
 * Proxies Warframe Market images
 */
const proxyImage = async (imagePath: string) => {
  try {
    const imageUrl = `https://warframe.market/static/assets/${imagePath}`;
    console.log(`>>> [Netlify] Proxying image: ${imageUrl}`);

    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`Image fetch failed: ${response.status}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        ...corsHeaders
      },
      body: Buffer.from(imageBuffer).toString('base64'),
      isBase64Encoded: true
    };
  } catch (error: any) {
    console.error(`>>> [Netlify] Image proxy error:`, error);
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders
    };
  }

  try {
    const { queryStringParameters } = event;
    const imagePath = queryStringParameters?.image;
    const itemName = queryStringParameters?.item;
    const batchItems = queryStringParameters?.batch;
    const isPrimeSet = queryStringParameters?.prime_set === 'true';

    // Handle image proxy requests
    if (imagePath) {
      console.log(`>>> [Netlify] Image request detected: ${imagePath}`);
      return await proxyImage(imagePath);
    }

    // Handle batch requests
    if (batchItems) {
      const result = await handleBatchRequest(batchItems);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        body: JSON.stringify(result)
      };
    }

    if (!itemName) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        body: JSON.stringify({ error: 'Item name is required' })
      };
    }

    // Handle Prime Set requests
    let normalizedItemName = itemName;
    if (isPrimeSet) {
      if (!itemName.toLowerCase().endsWith('_set')) {
        normalizedItemName = normalizeItemName(itemName) + '_set';
      } else {
        normalizedItemName = normalizeItemName(itemName);
      }
      console.log(`>>> [Netlify] Prime Set request: ${itemName} -> ${normalizedItemName} <<<`);
    }

    const result = await fetchSingleItemData(normalizedItemName);

    if (result.error && result.error !== 'not_found') {
      console.error(`>>> [Netlify] Server error for ${itemName}:`, result.error, result.message);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        body: JSON.stringify({ error: result.message || result.error })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: JSON.stringify(result)
    };
  } catch (error: any) {
    console.error(`>>> [Netlify] Unexpected error:`, error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: JSON.stringify({ error: error.message || 'Internal server error' })
    };
  }
};
