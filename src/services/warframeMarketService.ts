import { PrimePart, WarframeMarketOrder, WarframeMarketItem } from '../types';

// Cache for market data to avoid rate limits
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const API_BASE_URL = '/api/v1';

/**
 * Normalizes item names to match Warframe Market URL format
 */
const normalizeItemName = (name: string): string => {
  // Remove "Prime" from the name temporarily to handle special cases
  let normalized = name.replace(/\s+Prime\s+/i, '_prime_');
  
  // Special case handling for Blueprint suffix
  const hasBlueprint = /blueprint$/i.test(name);
  normalized = normalized.replace(/\s*blueprint$/i, '');

  // Normalize the remaining string
  normalized = normalized
    .toLowerCase()
    .replace(/\s*&\s*/g, '_and_') // Replace & with 'and'
    .replace(/[^a-z0-9_]/g, '') // Remove special characters except underscores
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

  // Add blueprint suffix back if it existed
  return hasBlueprint ? `${normalized}_blueprint` : normalized;
};

/**
 * Checks if data is in cache and still valid
 */
const getCachedData = (key: string) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
};

/**
 * Sets data in cache
 */
const setCachedData = (key: string, data: any) => {
  cache.set(key, { data, timestamp: Date.now() });
};

/**
 * Gets the highest buy order price and average price from recent orders
 */
const calculatePrices = (orders: WarframeMarketOrder[]): { current: number; average: number | null } => {
  if (orders.length === 0) return { current: 0, average: null };
  
  // Get highest current buy order
  const buyOrders = orders.filter(order => 
    order.order_type === 'buy' && 
    ['online', 'ingame'].includes(order.user.status) &&
    !order.user.banned &&
    order.visible
  );

  if (buyOrders.length === 0) {
    return { current: 0, average: null };
  }

  // Sort by platinum amount, highest first
  const sortedOrders = [...buyOrders].sort((a, b) => b.platinum - a.platinum);
  const currentPrice = sortedOrders[0].platinum;
  
  // Calculate 24h average from all orders
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  
  const recentOrders = buyOrders.filter(order => 
    new Date(order.creation_date) > oneDayAgo
  );
  
  let averagePrice = null;
  if (recentOrders.length > 0) {
    const sum = recentOrders.reduce((acc, order) => acc + order.platinum, 0);
    averagePrice = Math.round(sum / recentOrders.length);
  }
  
  return { current: currentPrice, average: averagePrice };
};

/**
 * Makes an API request with proper headers and error handling
 */
const makeRequest = async (endpoint: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`API request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

/**
 * Fetches current prices for a prime part from Warframe Market
 */
const fetchItemPrice = async (itemName: string): Promise<{ price: number; volume: number; average?: number; error?: string; imgUrl?: string }> => {
  try {
    const normalizedName = normalizeItemName(itemName);
    
    // Check cache first
    const cachedData = getCachedData(normalizedName);
    if (cachedData) {
      return cachedData;
    }

    // First, try to get item details
    const itemResponse = await makeRequest(`/items/${normalizedName}`);
    if (!itemResponse) {
      return {
        price: 0,
        volume: 0,
        error: 'Item not found in market'
      };
    }

    // Fetch orders for the item
    const ordersResponse = await makeRequest(`/items/${normalizedName}/orders`);
    if (!ordersResponse) {
      return {
        price: 0,
        volume: 0,
        error: 'No orders available'
      };
    }
    
    // Calculate prices from orders
    const { current, average } = calculatePrices(ordersResponse.payload.orders);

    const result = {
      price: current,
      volume: ordersResponse.payload.orders.length,
      average,
      imgUrl: itemResponse.payload.item.thumb,
      error: current === 0 ? 'No active buy orders' : undefined
    };

    // Cache the result
    setCachedData(normalizedName, result);
    return result;
  } catch (error) {
    console.error(`Error fetching price for ${itemName}:`, error);
    return {
      price: 0,
      volume: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch market data'
    };
  }
};

/**
 * Fetches market data for multiple prime parts with rate limiting
 */
export const fetchPriceData = async (primeParts: PrimePart[]): Promise<PrimePart[]> => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const RATE_LIMIT_DELAY = 334; // ~3 requests per second

  const updatedParts = [];
  let hadError = false;

  for (const part of primeParts) {
    // Skip remaining parts if we've encountered a critical error
    if (hadError) {
      updatedParts.push({
        ...part,
        status: 'error',
        error: 'Previous request failed'
      });
      continue;
    }

    try {
      const { price, volume, average, error, imgUrl } = await fetchItemPrice(part.name);
      
      // Stop processing on critical errors (not including "not found" or "no orders")
      if (error && !error.includes('not found') && !error.includes('no orders')) {
        hadError = true;
      }

      updatedParts.push({
        ...part,
        price,
        volume,
        average,
        imgUrl,
        error,
        status: 'loaded'
      });
      
      // Add delay between requests to respect rate limits
      await delay(RATE_LIMIT_DELAY);
    } catch (error) {
      console.error(`Failed to fetch item details for ${part.name}:`, error);
      hadError = true;
      updatedParts.push({
        ...part,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to fetch market data'
      });
    }
  }

  return updatedParts;
};