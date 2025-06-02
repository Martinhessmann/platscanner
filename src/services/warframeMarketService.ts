import { PrimePart } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Normalizes item names to match Warframe Market URL format
 */
const normalizeItemName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
};

/**
 * Fetches market data for multiple prime parts with rate limiting
 */
export const fetchPriceData = async (primeParts: PrimePart[]): Promise<PrimePart[]> => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const RATE_LIMIT_DELAY = 334; // ~3 requests per second

  const updatedParts = [];

  for (const part of primeParts) {
    try {
      const normalizedName = normalizeItemName(part.name);
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/warframe-market?item=${normalizedName}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        updatedParts.push({
          ...part,
          status: 'loaded',
          error: error.message || 'Failed to fetch market data'
        });
        continue;
      }

      const data = await response.json();
      
      updatedParts.push({
        ...part,
        price: data.price,
        volume: data.volume,
        average: data.average,
        imgUrl: data.thumb && `https://warframe.market/static/assets/${data.thumb}`,
        status: 'loaded',
        error: data.price === 0 ? 'No active buy orders' : undefined
      });

      // Add delay between requests
      await delay(RATE_LIMIT_DELAY);
    } catch (error) {
      console.error(`Failed to fetch item details for ${part.name}:`, error);
      updatedParts.push({
        ...part,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to fetch market data'
      });
    }
  }

  return updatedParts;
};