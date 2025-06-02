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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const itemName = url.searchParams.get('item');

    if (!itemName) {
      return handleError(new Error('Item name is required'), 400);
    }

    // Check cache
    const cached = cache.get(itemName);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return new Response(
        JSON.stringify(cached.data),
        { 
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    // API request headers
    const apiHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Language': 'en',
      'Platform': 'pc',
      'User-Agent': 'PlatScanner/1.1.0'
    };

    // Fetch item details and orders with retries
    let itemResponse, ordersResponse;
    try {
      [itemResponse, ordersResponse] = await Promise.all([
        fetch(`${WARFRAME_MARKET_API}/items/${itemName}`, { headers: apiHeaders }),
        fetch(`${WARFRAME_MARKET_API}/items/${itemName}/orders`, { headers: apiHeaders })
      ]);
    } catch (error) {
      console.error('Network error:', error);
      return handleError(new Error('Failed to fetch market data. Please try again.'));
    }

    // Handle API errors
    if (!itemResponse.ok || !ordersResponse.ok) {
      const status = itemResponse.status || ordersResponse.status;
      return handleError(new Error('Item not found or API error'), status);
    }

    // Parse responses
    let itemData, ordersData;
    try {
      [itemData, ordersData] = await Promise.all([
        itemResponse.json(),
        ordersResponse.json()
      ]);
    } catch (error) {
      console.error('JSON parse error:', error);
      return handleError(new Error('Invalid response from market API'));
    }

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
    return handleError(error);
  }
});