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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const itemName = url.searchParams.get('item');

    if (!itemName) {
      return new Response(
        JSON.stringify({ error: 'Item name is required' }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
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

    // Fetch item details and orders
    const [itemResponse, ordersResponse] = await Promise.all([
      fetch(`${WARFRAME_MARKET_API}/items/${itemName}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Language': 'en',
          'Platform': 'pc',
        }
      }),
      fetch(`${WARFRAME_MARKET_API}/items/${itemName}/orders`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Language': 'en',
          'Platform': 'pc',
        }
      })
    ]);

    if (!itemResponse.ok || !ordersResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Item not found' }),
        { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
});