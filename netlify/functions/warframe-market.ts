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
 * Searches for an item using Warframe Market search API to find the correct URL name
 */
const searchItemUrlName = async (itemName: string, apiHeaders: any): Promise<string | null> => {
  try {
    // Try searching with the normalized name (with underscores replaced by spaces for search)
    const searchTerm = itemName.replace(/_/g, ' ');
    const searchResponse = await fetch(`${WARFRAME_MARKET_API}/items?search=${encodeURIComponent(searchTerm)}`, { headers: apiHeaders });
    
    if (!searchResponse.ok) {
      return null;
    }

    const searchData = await searchResponse.json();
    
    if (searchData?.payload?.items && searchData.payload.items.length > 0) {
      // Find the best match - prefer exact match, then partial match
      const normalizedSearch = itemName.toLowerCase();
      const searchTermLower = searchTerm.toLowerCase();
      
      // Score each item to find the best match
      let bestMatch: { url_name: string; score: number } | null = null;
      
      for (const item of searchData.payload.items) {
        const itemUrlName = item.url_name;
        const itemUrlLower = itemUrlName.toLowerCase();
        let score = 0;
        
        // Exact match gets highest score
        if (itemUrlName === itemName) {
          score = 100;
        }
        // Check if URL name contains our search term or vice versa
        else if (itemUrlLower.includes(normalizedSearch) || normalizedSearch.includes(itemUrlLower)) {
          score = 80;
        }
        // Check if the display name matches
        else if (item.item_name && item.item_name.toLowerCase().includes(searchTermLower)) {
          score = 60;
        }
        // Partial match
        else if (itemUrlLower.replace(/_/g, '').includes(normalizedSearch.replace(/_/g, ''))) {
          score = 40;
        }
        
        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { url_name: itemUrlName, score };
        }
      }
      
      if (bestMatch && bestMatch.score >= 40) {
        console.log(`>>> [Netlify] Search found: ${itemName} -> ${bestMatch.url_name} (score: ${bestMatch.score}) <<<`);
        return bestMatch.url_name;
      }
      
      // If no good match, return the first result as fallback
      const firstItem = searchData.payload.items[0];
      console.log(`>>> [Netlify] Search fallback: ${itemName} -> ${firstItem.url_name} <<<`);
      return firstItem.url_name;
    }
    
    return null;
  } catch (error) {
    console.error(`>>> [Netlify] Search error for ${itemName}:`, error);
    return null;
  }
};

/**
 * Generates alternative name formats to try when direct lookup fails
 */
const generateAlternativeNames = (itemName: string): string[] => {
  const alternatives: string[] = [];
  
  // For warframe blueprints, try without "_blueprint" suffix first
  // Warframe Market API often stores warframe blueprints as just "warframe_prime"
  if (itemName.endsWith('_blueprint')) {
    const withoutBlueprint = itemName.replace(/_blueprint$/, '');
    alternatives.push(withoutBlueprint);
    
    // Also try adding "_set" suffix (some items might be stored as sets)
    alternatives.push(`${withoutBlueprint}_set`);
  }
  
  // For warframe components (chassis, neuroptics, systems), try base name
  // e.g., "garuda_prime_chassis" -> "garuda_prime"
  if (itemName.match(/_prime_(chassis|neuroptics|systems)$/)) {
    const baseName = itemName.replace(/_(chassis|neuroptics|systems)$/, '');
    alternatives.push(baseName);
    // Also try with "_blueprint" suffix
    alternatives.push(`${baseName}_blueprint`);
  }
  
  // For weapon/equipment components, try base name
  // e.g., "acceltra_prime_barrel" -> "acceltra_prime"
  const componentMatch = itemName.match(/^(.+_prime)_(barrel|receiver|stock|blade|handle|link|grip|string|lower_limb|upper_limb|gauntlet|boot|ornament|head|pouch|carapace|cerebrum|guard|hilt|blades)$/);
  if (componentMatch) {
    const baseName = componentMatch[1];
    alternatives.push(baseName);
    // Also try with "_blueprint" suffix
    alternatives.push(`${baseName}_blueprint`);
  }
  
  return alternatives;
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

  // Try direct lookup first
  let actualItemName = itemName;
  let itemResponse: Response;
  let ordersResponse: Response;
  let statsResponse: Response;

  try {
    [itemResponse, ordersResponse, statsResponse] = await Promise.all([
      fetch(`${WARFRAME_MARKET_API}/items/${itemName}`, { headers: apiHeaders }),
      fetch(`${WARFRAME_MARKET_API}/items/${itemName}/orders`, { headers: apiHeaders }),
      fetch(`${WARFRAME_MARKET_API}/items/${itemName}/statistics`, { headers: apiHeaders })
    ]);

    // If direct lookup failed, try alternatives
    if (!itemResponse.ok || !ordersResponse.ok) {
      const alternatives = generateAlternativeNames(itemName);
      let found = false;
      
      // Try each alternative
      for (const altName of alternatives) {
        console.log(`>>> [Netlify] Trying alternative: ${itemName} -> ${altName} <<<`);
        const [altItemRes, altOrdersRes, altStatsRes] = await Promise.all([
          fetch(`${WARFRAME_MARKET_API}/items/${altName}`, { headers: apiHeaders }),
          fetch(`${WARFRAME_MARKET_API}/items/${altName}/orders`, { headers: apiHeaders }),
          fetch(`${WARFRAME_MARKET_API}/items/${altName}/statistics`, { headers: apiHeaders })
        ]);
        
        if (altItemRes.ok && altOrdersRes.ok) {
          actualItemName = altName;
          itemResponse = altItemRes;
          ordersResponse = altOrdersRes;
          statsResponse = altStatsRes;
          found = true;
          console.log(`>>> [Netlify] Alternative worked: ${itemName} -> ${altName} <<<`);
          break;
        }
      }
      
      // If alternatives didn't work, try search API
      if (!found) {
        console.log(`>>> [Netlify] Trying search API for: ${itemName} <<<`);
        const searchedUrlName = await searchItemUrlName(itemName, apiHeaders);
        
        if (searchedUrlName && searchedUrlName !== itemName) {
          actualItemName = searchedUrlName;
          [itemResponse, ordersResponse, statsResponse] = await Promise.all([
            fetch(`${WARFRAME_MARKET_API}/items/${searchedUrlName}`, { headers: apiHeaders }),
            fetch(`${WARFRAME_MARKET_API}/items/${searchedUrlName}/orders`, { headers: apiHeaders }),
            fetch(`${WARFRAME_MARKET_API}/items/${searchedUrlName}/statistics`, { headers: apiHeaders })
          ]);
          
          if (itemResponse.ok && ordersResponse.ok) {
            found = true;
            console.log(`>>> [Netlify] Search API found: ${itemName} -> ${searchedUrlName} <<<`);
          }
        }
      }
      
      // If still not found, return error
      if (!found || !itemResponse.ok || !ordersResponse.ok) {
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

    // Find the item details - prefer exact match, fallback to first item
    const itemDetails = itemData.payload.item.items_in_set.find((item: any) =>
      item.url_name === actualItemName || item.url_name === itemName
    ) || itemData.payload.item.items_in_set[0];

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

    // Cache with both the original name and the actual name for future lookups
    cache.set(itemName, { data: result, timestamp: Date.now() });
    if (actualItemName !== itemName) {
      cache.set(actualItemName, { data: result, timestamp: Date.now() });
    }
    console.log(`>>> [Netlify] ${itemName}${actualItemName !== itemName ? ` (${actualItemName})` : ''}: Success (${result.price}p) <<<`);
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
