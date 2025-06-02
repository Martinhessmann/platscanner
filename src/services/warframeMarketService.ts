import { PrimePart } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * CRITICAL COMPONENT - DO NOT MODIFY WITHOUT REVIEW
 * 
 * This service handles all interactions with the Warframe Market API via our Edge Function.
 * It is responsible for:
 * 1. Normalizing item names
 * 2. Fetching market data with rate limiting
 * 3. Processing and formatting price data
 * 
 * Key Dependencies:
 * - Supabase Edge Function for API proxying
 * - Environment variables for API configuration
 * 
 * Rate Limiting:
 * - Enforces 334ms delay between requests (~3 requests/second)
 * - Uses sequential processing to prevent API overload
 * 
 * Error Handling:
 * - Returns formatted error objects for failed requests
 * - Continues processing remaining items if one fails
 */

/**
 * CRITICAL: Normalizes item names to match Warframe Market URL format
 * DO NOT modify without testing against the full item database
 */
const normalizeItemName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/\s*&\s*/g, '_and_') // Replace & with 'and'
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
};

/**
 * CRITICAL: Fetches market data for multiple prime parts with rate limiting
 * 
 * @param primeParts - Array of PrimePart objects to fetch data for
 * @returns Updated array with market data
 * 
 * IMPORTANT: 
 * - Maintains rate limiting of 3 requests per second
 * - Returns partial results if some items fail
 * - Includes error handling for each item
 */
export const fetchPriceData = async (primeParts: PrimePart[]): Promise<PrimePart[]> => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const RATE_LIMIT_DELAY = 334; // ~3 requests per second

  const updatedParts = [];

  for (const part of primeParts) {
    try {
      const normalizedName = normalizeItemName(part.name);
      console.log(`Fetching data for: ${part.name} (${normalizedName})`);

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
        console.error(`Error fetching ${part.name}:`, error);
        updatedParts.push({
          ...part,
          status: 'loaded',
          error: error.message || 'Failed to fetch market data'
        });
        continue;
      }

      const data = await response.json();
      console.log(`Raw data for ${part.name}:`, data);
      
      updatedParts.push({
        ...part,
        price: data.price,
        ducats: data.ducats,
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