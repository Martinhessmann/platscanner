import { PrimePart } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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
    .replace(/\s*&\s*/g, '_and_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  // Add blueprint suffix back if it existed
  return hasBlueprint ? `${normalized}_blueprint` : normalized;
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
        imgUrl: data.thumb,
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