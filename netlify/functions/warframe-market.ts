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

const WARFRAME_MARKET_API = 'https://api.warframe.market/v1';

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
 * Extracts the base prime name for warframe components
 * For warframe components, we need to query the base set name, not the component name
 * Example: "garuda_prime_blueprint" -> "garuda_prime"
 */
const getBasePrimeName = (itemName: string): string | null => {
  // Check if this is a warframe component (blueprint, chassis, neuroptics, systems)
  const warframeComponentPattern = /^(.+_prime)_(blueprint|chassis|neuroptics|systems)$/;
  const match = itemName.match(warframeComponentPattern);
  if (match) {
    return match[1]; // Return base name (e.g., "garuda_prime")
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

  // For warframe components, query the base prime name instead
  // The API returns items_in_set with all components when querying the base name
  const basePrimeName = getBasePrimeName(itemName);
  const queryName = basePrimeName || itemName;
  
  let actualItemName = itemName;
  let itemResponse: Response;
  let ordersResponse: Response;
  let statsResponse: Response;

  try {
    // Query using base name for warframe components, or original name for others
    [itemResponse, ordersResponse, statsResponse] = await Promise.all([
      fetch(`${WARFRAME_MARKET_API}/items/${queryName}`, { headers: apiHeaders }),
      fetch(`${WARFRAME_MARKET_API}/items/${queryName}/orders`, { headers: apiHeaders }),
      fetch(`${WARFRAME_MARKET_API}/items/${queryName}/statistics`, { headers: apiHeaders })
    ]);

    // If lookup failed, return error
    if (!itemResponse.ok || !ordersResponse.ok) {
        const errorType = itemResponse.status === 404 || ordersResponse.status === 404 ? 'not_found' : 'api_error';
        console.log(`>>> [Netlify] ${itemName}: ${errorType} (status: ${itemResponse.status}/${ordersResponse.status}) <<<`);

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
    }

    const [itemData, ordersData, statsData] = await Promise.all([
      itemResponse.json(),
      ordersResponse.json(),
      statsResponse.ok ? statsResponse.json() : Promise.resolve({ payload: { statistics_closed: { '90days': [] } } })
    ]);

    // Find the item details - for warframe components, search in items_in_set
    // For other items, prefer exact match, fallback to first item
    let itemDetails;
    if (basePrimeName) {
      // For warframe components, find the specific component in the set
      itemDetails = itemData.payload.item.items_in_set.find((item: any) =>
        item.url_name === itemName // Original component name (e.g., "garuda_prime_blueprint")
      );
      if (!itemDetails) {
        // Fallback: try to find by matching the component type
        const componentType = itemName.replace(basePrimeName + '_', '');
        itemDetails = itemData.payload.item.items_in_set.find((item: any) =>
          item.url_name.includes(componentType)
        );
      }
      if (!itemDetails) {
        // Last resort: use first item
        itemDetails = itemData.payload.item.items_in_set[0];
      }
    } else {
      // For non-warframe components, use original logic
      itemDetails = itemData.payload.item.items_in_set.find((item: any) =>
        item.url_name === actualItemName || item.url_name === itemName
      ) || itemData.payload.item.items_in_set[0];
    }

    // Extract averages from statistics
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

    // Process orders
    const buyOrders = ordersData.payload.orders.filter((order: any) =>
      order.order_type === 'buy' &&
      ['online', 'ingame'].includes(order.user.status) &&
      !order.user.banned &&
      order.visible &&
      (itemDetails.mod_max_rank === undefined || order.mod_rank === 0 || order.mod_rank === undefined)
    );

    const highestBidder = buyOrders.length > 0
      ? buyOrders.reduce((highest: any, current: any) =>
          current.platinum > highest.platinum ? current : highest
        )
      : null;

    const allValidBuyOrders = ordersData.payload.orders.filter((order: any) =>
      order.order_type === 'buy' &&
      ['online', 'ingame'].includes(order.user.status) &&
      !order.user.banned &&
      order.visible &&
      (itemDetails.mod_max_rank === undefined || order.mod_rank === 0 || order.mod_rank === undefined)
    );

    if (itemDetails.mod_max_rank !== undefined) {
      const totalOrders = ordersData.payload.orders.length;
      const unrankedBuyOrders = allValidBuyOrders.length;
      const rankedOrders = totalOrders - unrankedBuyOrders;
      console.log(`>>> [Netlify] ${itemName}: Mod rank filtering - Total: ${totalOrders}, Unranked Buy Orders: ${unrankedBuyOrders}, Ranked: ${rankedOrders} <<<`);
    }

    const sellerOrders = ordersData.payload.orders.filter((order: any) =>
      order.order_type === 'sell' &&
      ['online', 'ingame'].includes(order.user.status) &&
      !order.user.banned &&
      order.visible
    );

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
      trading_tax: itemDetails.trading_tax || 0
    };

    // Cache the result
    cache.set(itemName, { data: result, timestamp: Date.now() });
    if (basePrimeName && basePrimeName !== itemName) {
      // Also cache with base name for faster lookups of other components
      cache.set(basePrimeName, { data: result, timestamp: Date.now() });
    }
    console.log(`>>> [Netlify] ${itemName}${basePrimeName ? ` (queried as ${basePrimeName})` : ''}: Success (${result.price}p) <<<`);
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
