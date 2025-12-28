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
    // Query item data from v2 API, but use v1 API for orders/statistics (v2 doesn't have these endpoints yet)
    let itemResponse, ordersResponse, statsResponse;
    try {
      [itemResponse, ordersResponse, statsResponse] = await Promise.all([
        fetch(`${WARFRAME_MARKET_API_V2}/items/${itemName}`, { headers: apiHeaders }),
        fetch(`${WARFRAME_MARKET_API_V1}/items/${itemName}/orders`, { headers: apiHeaders }).catch((err) => {
          console.log(`>>> [Netlify] ${itemName}: V1 Orders endpoint failed <<<`);
          return { ok: false, status: 404, json: () => Promise.resolve({ payload: { orders: [] }, error: null }) };
        }),
        fetch(`${WARFRAME_MARKET_API_V1}/items/${itemName}/statistics`, { headers: apiHeaders }).catch((err) => {
          console.log(`>>> [Netlify] ${itemName}: V1 Statistics endpoint failed <<<`);
          return { ok: false, status: 404, json: () => Promise.resolve({ payload: { statistics_closed: { '90days': [] } }, error: null }) };
        })
      ]);
    } catch (error) {
      console.log(`>>> [Netlify] ${itemName}: Fetch error: ${error} <<<`);
      throw error;
    }

    // Log API responses for debugging
    console.log(`>>> [Netlify] ${itemName}: Item=${itemResponse.status}, Orders=${ordersResponse.status}, Stats=${statsResponse.status} <<<`);

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

    const [itemData, ordersData, statsData] = await Promise.all([
      itemResponse.json(),
      ordersResponse.ok ? ordersResponse.json() : Promise.resolve({ payload: { orders: [] }, error: null }),
      statsResponse.ok ? statsResponse.json() : Promise.resolve({ payload: { statistics_closed: { '90days': [] } }, error: null })
    ]);

    // V2 API structure: { apiVersion, data: { ... }, error }
    // Items are queried directly by slug, no items_in_set lookup needed
    if (itemData.error) {
      throw new Error(`API error: ${itemData.error}`);
    }
    
    const itemDetails = itemData.data;
    
    // Log if orders endpoint failed
    if (!ordersResponse.ok) {
      console.log(`>>> [Netlify] ${itemName}: V1 Orders endpoint returned ${ordersResponse.status}, using empty orders array <<<`);
    }

    // Extract averages from statistics (V1 API structure: payload.statistics_closed)
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
      console.log(`>>> [Netlify] ${itemName}: avg90=${historicalAverage}p, avg48h=${recentAverage48h}p <<<`);
    }

    // Process orders (V1 API structure: payload.orders)
    let orders = [];
    if (ordersData.payload && Array.isArray(ordersData.payload.orders)) {
      orders = ordersData.payload.orders;
    } else if (Array.isArray(ordersData.data)) {
      // Fallback to v2 structure if it ever gets implemented
      orders = ordersData.data;
    }
    
    console.log(`>>> [Netlify] ${itemName}: Found ${orders.length} orders from V1 API <<<`);
    
    // Debug: Log all sell orders and their statuses
    const allSellOrders = orders.filter((order: any) => order.order_type === 'sell');
    console.log(`>>> [Netlify] ${itemName}: Total sell orders: ${allSellOrders.length} <<<`);
    if (allSellOrders.length > 0) {
      const statusCounts: Record<string, number> = {};
      allSellOrders.forEach((order: any) => {
        const status = order.user?.status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      console.log(`>>> [Netlify] ${itemName}: Sell order statuses: ${JSON.stringify(statusCounts)} <<<`);
      
      // Log first few sell orders for debugging
      allSellOrders.slice(0, 5).forEach((order: any, idx: number) => {
        console.log(`>>> [Netlify] ${itemName}: Sell order ${idx + 1}: platinum=${order.platinum}, status=${order.user?.status}, banned=${order.user?.banned}, visible=${order.visible} <<<`);
      });
    }
    
    const buyOrders = orders.filter((order: any) => {
      if (order.order_type !== 'buy') return false;
      const userStatus = order.user?.status?.toLowerCase?.() || order.user?.status || '';
      return ['online', 'ingame', 'in_game'].includes(userStatus) &&
             !order.user.banned &&
             order.visible !== false &&
             (itemDetails.mod_max_rank === undefined || order.mod_rank === 0 || order.mod_rank === undefined);
    });

    const highestBidder = buyOrders.length > 0
      ? buyOrders.reduce((highest: any, current: any) =>
          current.platinum > highest.platinum ? current : highest
        )
      : null;

    const allValidBuyOrders = orders.filter((order: any) => {
      if (order.order_type !== 'buy') return false;
      const userStatus = order.user?.status?.toLowerCase?.() || order.user?.status || '';
      return ['online', 'ingame', 'in_game'].includes(userStatus) &&
             !order.user.banned &&
             order.visible !== false &&
             (itemDetails.mod_max_rank === undefined || order.mod_rank === 0 || order.mod_rank === undefined);
    });

    if (itemDetails.mod_max_rank !== undefined) {
      const totalOrders = orders.length;
      const unrankedBuyOrders = allValidBuyOrders.length;
      const rankedOrders = totalOrders - unrankedBuyOrders;
      console.log(`>>> [Netlify] ${itemName}: Mod rank filtering - Total: ${totalOrders}, Unranked Buy Orders: ${unrankedBuyOrders}, Ranked: ${rankedOrders} <<<`);
    }

    // Filter seller orders with detailed logging
    // CRITICAL: Check status case-insensitively and handle variations
    const sellerOrders = orders.filter((order: any) => {
      const isSell = order.order_type === 'sell';
      if (!isSell) return false;
      
      const userStatus = order.user?.status?.toLowerCase?.() || order.user?.status || '';
      const hasValidStatus = ['online', 'ingame', 'in_game'].includes(userStatus);
      const notBanned = !order.user?.banned;
      const isVisible = order.visible !== false; // Default to true if undefined
      
      if (!hasValidStatus && isSell) {
        console.log(`>>> [Netlify] ${itemName}: Rejected sell order - invalid status: "${order.user?.status}" (normalized: "${userStatus}") <<<`);
      }
      if (!notBanned && isSell) {
        console.log(`>>> [Netlify] ${itemName}: Rejected sell order - banned user <<<`);
      }
      if (!isVisible && isSell) {
        console.log(`>>> [Netlify] ${itemName}: Rejected sell order - not visible (value: ${order.visible}) <<<`);
      }
      
      return hasValidStatus && notBanned && isVisible;
    });

    console.log(`>>> [Netlify] ${itemName}: Filtered seller orders: ${sellerOrders.length} (from ${allSellOrders.length} total) <<<`);

    const lowestSeller = sellerOrders.length > 0
      ? sellerOrders.reduce((lowest: any, current: any) =>
          current.platinum < lowest.platinum ? current : lowest
        )
      : null;
    
    if (lowestSeller) {
      console.log(`>>> [Netlify] ${itemName}: Lowest seller: ${lowestSeller.platinum}p (${lowestSeller.user?.ingame_name}) <<<`);
    }

    // Use statistics average as fallback if no orders available
    const priceFromOrders = buyOrders.length > 0 ? Math.max(...buyOrders.map((o: any) => o.platinum)) : 0;
    const priceFromStats = recentAverage48h > 0 ? recentAverage48h : (historicalAverage > 0 ? historicalAverage : 0);
    const finalPrice = priceFromOrders > 0 ? priceFromOrders : priceFromStats;
    
    console.log(`>>> [Netlify] ${itemName}: Price calculation - Orders: ${priceFromOrders}p, Stats: ${priceFromStats}p, Final: ${finalPrice}p <<<`);

    const result = {
      name: itemDetails.i18n?.en?.name || itemName,
      thumb: itemDetails.i18n?.en?.thumb || '',
      ducats: itemDetails.ducats || 0,
      price: finalPrice,
      volume: allValidBuyOrders.length,
      average: historicalAverage,
      recentAverage48h: recentAverage48h,
      buyerUsername: highestBidder?.user?.ingame_name || null,
      buyerQuantity: highestBidder?.quantity || 0,
      hasBuyers: buyOrders.length > 0,
      buyerCount: buyOrders.length,
      sellerCount: sellerOrders.length,
      sellerPrice: sellerOrders.length > 0 ? Math.min(...sellerOrders.map((o: any) => o.platinum)) : 0,
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
