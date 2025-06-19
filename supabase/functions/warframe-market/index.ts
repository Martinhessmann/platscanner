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
 * Normalizes item names to match Warframe Market URL format
 */
const normalizeItemName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/\s*&\s*/g, '_and_') // Replace & with 'and'
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
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
    'User-Agent': 'PlatScanner/1.7.1'
  };

  try {
    const [itemResponse, ordersResponse] = await Promise.all([
      fetch(`${WARFRAME_MARKET_API}/items/${itemName}`, { headers: apiHeaders }),
      fetch(`${WARFRAME_MARKET_API}/items/${itemName}/orders`, { headers: apiHeaders })
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
        status: itemResponse.status || ordersResponse.status
      };
    }

    const [itemData, ordersData] = await Promise.all([
      itemResponse.json(),
      ordersResponse.json()
    ]);

    // Get the item details from the set
    const itemDetails = itemData.payload.item.items_in_set.find((item: any) =>
      item.url_name === itemName
    ) || itemData.payload.item.items_in_set[0];

    // Process orders
    const buyOrders = ordersData.payload.orders.filter((order: any) =>
      order.order_type === 'buy' &&
      ['online', 'ingame'].includes(order.user.status) &&
      !order.user.banned &&
      order.visible
    );

    const result = {
      name: itemDetails.en.item_name,
      thumb: itemDetails.thumb,
      ducats: itemDetails.ducats || 0,
      price: buyOrders.length > 0 ? Math.max(...buyOrders.map((o: any) => o.platinum)) : 0,
      volume: ordersData.payload.orders.length,
      average: buyOrders.length > 0
        ? Math.round(buyOrders.reduce((acc: number, o: any) => acc + o.platinum, 0) / buyOrders.length)
        : 0
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
      message: error.message
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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const itemName = url.searchParams.get('item');
    const batchItems = url.searchParams.get('batch');

    // Handle batch requests for relic value analysis
    if (batchItems) {
      return await handleBatchRequest(batchItems);
    }

    if (!itemName) {
      return handleError(new Error('Item name is required'), 400);
    }

    // Use the refactored single item fetcher
    const result = await fetchSingleItemData(itemName);

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