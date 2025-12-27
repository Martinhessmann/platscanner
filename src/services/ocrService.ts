import { createWorker } from 'tesseract.js';
import { DetectedItem, PrimePart, VoidRelic, SyndicateReward, Mod } from '../types';
import { getCategorizedInventory } from './inventoryService';
import { determineModRarity, determineModType } from './modService';

const IMAGE_CACHE_KEY = 'platscanner_image_cache';
const CACHE_EXPIRY_HOURS = 24; // Cache results for 24 hours

// Cache structure for storing analysis results
interface ImageCacheEntry {
  hash: string;
  timestamp: number;
  screenType: 'prime_parts' | 'relics' | 'syndicate' | 'mods' | 'unknown';
  detectedItems: DetectedItem[];
}

// Generate a simple hash from image data for caching
export const generateImageHash = async (imageBase64: string): Promise<string> => {
  const sample = imageBase64.substring(0, 1000);
  const encoder = new TextEncoder();
  const data = encoder.encode(sample);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
};

// Get cached analysis result
const getCachedAnalysis = (imageHash: string): DetectedItem[] | null => {
  try {
    const cacheData = localStorage.getItem(IMAGE_CACHE_KEY);
    if (!cacheData) return null;

    const cache: ImageCacheEntry[] = JSON.parse(cacheData);
    const now = Date.now();
    const expiryTime = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;

    const entry = cache.find(e =>
      e.hash === imageHash &&
      (now - e.timestamp) < expiryTime
    );

    if (entry) {
      console.log(`>>> [OCR Cache] Found cached result for image hash ${imageHash} <<<`);
      return entry.detectedItems;
    }

    return null;
  } catch (error) {
    console.error('Failed to read image cache:', error);
    return null;
  }
};

/**
 * Clear cached result for a specific image hash (for retry functionality)
 */
export const clearCachedAnalysis = (imageHash: string): void => {
  try {
    const stored = localStorage.getItem(IMAGE_CACHE_KEY);
    if (!stored) return;

    const cache = JSON.parse(stored);
    const filteredCache = cache.filter((entry: any) => entry.hash !== imageHash);

    localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(filteredCache));
    console.log(`>>> [OCR Cache] Cleared cached result for image hash ${imageHash} <<<`);
  } catch (error) {
    console.error('Failed to clear image cache:', error);
  }
};

// Store analysis result in cache
const setCachedAnalysis = (imageHash: string, screenType: string, detectedItems: DetectedItem[]): void => {
  try {
    const cacheData = localStorage.getItem(IMAGE_CACHE_KEY);
    let cache: ImageCacheEntry[] = cacheData ? JSON.parse(cacheData) : [];

    const now = Date.now();
    const expiryTime = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
    cache = cache.filter(e => (now - e.timestamp) < expiryTime);

    const newEntry: ImageCacheEntry = {
      hash: imageHash,
      timestamp: now,
      screenType: screenType as any,
      detectedItems
    };

    cache.push(newEntry);

    if (cache.length > 50) {
      cache = cache.slice(-50);
    }

    localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(cache));
    console.log(`>>> [OCR Cache] Stored result for image hash ${imageHash} <<<`);
  } catch (error) {
    console.error('Failed to store image cache:', error);
  }
};

// Filter out items that are already in inventory to avoid duplicates
const filterNewItems = (detectedItems: DetectedItem[]): DetectedItem[] => {
  const inventory = getCategorizedInventory();
  const existingItems = new Set();

  inventory.prime_parts.forEach(item => existingItems.add(`${item.category}:${item.name}`));
  inventory.relics.forEach(item => existingItems.add(`${item.category}:${item.name}`));
  inventory.syndicate_rewards.forEach(item => existingItems.add(`${item.category}:${item.name}`));
  inventory.mods.forEach(item => {
    const r = (item as any).rank ?? 0;
    const d = (item as any).drain ?? '';
    existingItems.add(`${item.category}:${item.name}:r${r}:d${d}`);
  });

  const newItems = detectedItems.filter(item => {
    let itemKey = `${item.category}:${item.name}`;
    if (item.category === 'mods') {
      const m = item as any;
      const r = m.rank ?? 0;
      const d = m.drain ?? '';
      itemKey = `${item.category}:${item.name}:r${r}:d${d}`;
    }
    return !existingItems.has(itemKey);
  });

  if (newItems.length < detectedItems.length) {
    console.log(`>>> [OCR Filter] Filtered ${detectedItems.length - newItems.length} duplicate items, ${newItems.length} are new <<<`);
  }

  return newItems;
};

// Clear image cache (useful if user wants to force re-analysis)
export const clearImageCache = (): void => {
  try {
    localStorage.removeItem(IMAGE_CACHE_KEY);
    console.log('>>> [OCR Cache] Cleared image cache <<<');
  } catch (error) {
    console.error('Failed to clear image cache:', error);
  }
};

// Get cache statistics for debugging
export const getCacheStats = (): { entries: number; oldestEntry?: Date; newestEntry?: Date } => {
  try {
    const cacheData = localStorage.getItem(IMAGE_CACHE_KEY);
    if (!cacheData) return { entries: 0 };

    const cache: ImageCacheEntry[] = JSON.parse(cacheData);
    if (cache.length === 0) return { entries: 0 };

    const timestamps = cache.map(e => e.timestamp).sort();
    return {
      entries: cache.length,
      oldestEntry: new Date(timestamps[0]),
      newestEntry: new Date(timestamps[timestamps.length - 1])
    };
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return { entries: 0 };
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

// Convert base64 to image data URL for Tesseract
const base64ToImageData = (base64: string): Promise<ImageData> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve(imageData);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = `data:image/png;base64,${base64}`;
  });
};

// Extract text from image using OCR
const extractTextFromImage = async (imageFile: File): Promise<string> => {
  const worker = await createWorker('eng');
  try {
    const { data: { text } } = await worker.recognize(imageFile);
    return text;
  } finally {
    await worker.terminate();
  }
};

// Determine screen type based on extracted text
const determineScreenType = (text: string): 'prime_parts' | 'relics' | 'syndicate' | 'mods' | 'unknown' => {
  const lowerText = text.toLowerCase();

  // Check for syndicate indicators
  if (
    lowerText.includes('syndicate offerings') ||
    lowerText.includes('arbiters of hexis') ||
    lowerText.includes('steel meridian') ||
    lowerText.includes('cephalon suda') ||
    lowerText.includes('perrin sequence') ||
    lowerText.includes('red veil') ||
    lowerText.includes('new loka') ||
    lowerText.includes('arbitration honors')
  ) {
    return 'syndicate';
  }

  // Check for relic indicators
  if (
    lowerText.includes('void relics') ||
    lowerText.includes('relic') ||
    /\b(lith|meso|neo|axi)\s+[a-z]\d+/i.test(text)
  ) {
    return 'relics';
  }

  // Check for mod indicators (polarity symbols, drain costs)
  if (
    lowerText.includes('mod') ||
    /\b(drain|capacity)\s*:?\s*\d+/i.test(text) ||
    /[vd\-]\s*\d+/i.test(text) || // Polarity symbols
    /\d+\s*\/\s*\d+\s*\(drain/i.test(text) // Rank format with drain
  ) {
    return 'mods';
  }

  // Check for prime parts
  if (lowerText.includes('prime') || lowerText.includes('blueprint')) {
    return 'prime_parts';
  }

  return 'unknown';
};

// Parse detected items from OCR text
const parseDetectedItems = (text: string, screenType?: string): DetectedItem[] => {
  const detectedItems: DetectedItem[] = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  let detectedSyndicate = 'Unknown';

  lines.forEach((line, index) => {
    // Check for syndicate name
    const syndicateMatch = line.match(/^SYNDICATE:\s*(.+)$/i);
    if (syndicateMatch) {
      detectedSyndicate = syndicateMatch[1].trim();
      console.log(`>>> [OCR Parsing] Detected syndicate: "${detectedSyndicate}" <<<`);
      return;
    }

    // Syndicate reward format: "ITEM_NAME | 25,000"
    const syndicateRewardMatch = line.match(/^(.*?)\s*\|\s*([\d,]+)/);
    if (syndicateRewardMatch && screenType !== 'mods') {
      const name = syndicateRewardMatch[1].trim();
      const standingStr = syndicateRewardMatch[2].replace(/,/g, '');
      const standingCost = parseInt(standingStr, 10);

      if (screenType === 'syndicate' || screenType === 'unknown') {
        const reward: SyndicateReward = {
          id: `syndicate-${Date.now()}-${index}`,
          name,
          category: 'syndicate_rewards',
          syndicate: detectedSyndicate,
          standingCost: isNaN(standingCost) ? 0 : standingCost,
          itemType: 'mod',
          currency: detectedSyndicate.toLowerCase().includes('arbitration') ? 'vitus_essence' : 'standing',
          status: 'loading'
        };
        detectedItems.push(reward);
        return;
      }
    }

    // Parse quantity from formats like "5 x Item Name", "x5 Item Name", "2x Item Name"
    let quantity = 1;
    let cleanLine = line;

    const quantityMatch = line.match(/^(\d+)\s*x\s*(.+)$/i) || line.match(/^x(\d+)\s*(.+)$/i);
    if (quantityMatch) {
      quantity = parseInt(quantityMatch[1]);
      cleanLine = quantityMatch[2].trim();
    }

    // Skip if syndicate screen without proper format
    if (screenType === 'syndicate' && !line.includes('|')) {
      return;
    }

    // Check if it's a Prime part
    if (cleanLine.includes('Prime') || cleanLine.includes('Blueprint')) {
      const primeItem: PrimePart = {
        id: `prime-${Date.now()}-${index}`,
        name: cleanLine,
        category: 'prime_parts',
        quantity,
        status: 'loading'
      };
      detectedItems.push(primeItem);
      return;
    }

    // Check if it's a Void Relic
    if (cleanLine.includes('Relic') || /\b(Lith|Meso|Neo|Axi)\s+[A-Z]\d+/i.test(cleanLine)) {
      let relicName = cleanLine;
      let rarity: VoidRelic['rarity'] = 'intact';

      const relicRegex = /(.*?)\s+[([](Intact|Exceptional|Flawless|Radiant)[)\]]/i;
      const match = cleanLine.match(relicRegex);

      if (match) {
        relicName = match[1].trim();
        const detectedRarity = match[2].toLowerCase();
        if (detectedRarity === 'intact' || detectedRarity === 'exceptional' || detectedRarity === 'flawless' || detectedRarity === 'radiant') {
          rarity = detectedRarity;
        }
      } else {
        const alternativeRegex = /(.*?)\s+(Intact|Exceptional|Flawless|Radiant)\s+Relic/i;
        const altMatch = cleanLine.match(alternativeRegex);
        if (altMatch) {
          relicName = `${altMatch[1]} Relic`;
          const detectedRarity = altMatch[2].toLowerCase();
          if (detectedRarity === 'intact' || detectedRarity === 'exceptional' || detectedRarity === 'flawless' || detectedRarity === 'radiant') {
            rarity = detectedRarity;
          }
        }
      }

      const relicItem: VoidRelic = {
        id: `relic-${Date.now()}-${index}`,
        name: relicName,
        category: 'relics',
        rarity,
        quantity,
        status: 'loading'
      };
      detectedItems.push(relicItem);
      return;
    }

    // Check if it's a mod
    if (
      screenType !== 'syndicate' &&
      cleanLine &&
      !cleanLine.includes('Prime') &&
      !cleanLine.includes('Relic') &&
      cleanLine.length < 100 &&
      cleanLine.length > 1
    ) {
      // Try to parse mod format: "NAME rCURRENT/TOTAL (drain D)"
      const rFormatMatch = cleanLine.match(/^(.*?)\s+r\s*(\d{1,2})\/(\d{1,2})(?:\s*\(drain\s*(\d{1,3})\))?\s*$/i);
      if (rFormatMatch) {
        const modName = rFormatMatch[1].trim();
        const detectedLevel = parseInt(rFormatMatch[2]);
        const detectedTotal = parseInt(rFormatMatch[3]);
        const detectedDrain = rFormatMatch[4] ? parseInt(rFormatMatch[4]) : undefined;

        const rarity = determineModRarity(modName);
        const type = determineModType(modName);

        const modItem: Mod = {
          id: `mod-${Date.now()}-${index}`,
          name: modName,
          category: 'mods',
          rank: !isNaN(detectedLevel) ? detectedLevel : undefined,
          quantity,
          drain: detectedDrain,
          rarity,
          type,
          status: 'loading'
        };
        detectedItems.push(modItem);
        return;
      }

      // Try format: "MOD_NAME | QUANTITY | LEVEL | DRAIN"
      const newFormatMatch = cleanLine.match(/^(.*?)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)$/);
      if (newFormatMatch) {
        const modName = newFormatMatch[1].trim();
        const detectedQuantity = parseInt(newFormatMatch[2]);
        const detectedLevel = parseInt(newFormatMatch[3]);
        const detectedDrain = parseInt(newFormatMatch[4]);

        const rarity = determineModRarity(modName);
        const type = determineModType(modName);

        const modItem: Mod = {
          id: `mod-${Date.now()}-${index}`,
          name: modName,
          category: 'mods',
          rank: detectedLevel > 0 ? detectedLevel : undefined,
          quantity: detectedQuantity,
          drain: detectedDrain,
          rarity,
          type,
          status: 'loading'
        };
        detectedItems.push(modItem);
        return;
      }

      // Fallback: simple mod name
      const rarity = determineModRarity(cleanLine);
      const type = determineModType(cleanLine);

      const modItem: Mod = {
        id: `mod-${Date.now()}-${index}`,
        name: cleanLine,
        category: 'mods',
        quantity,
        rarity,
        type,
        status: 'loading'
      };
      detectedItems.push(modItem);
    }
  });

  return detectedItems;
};

// Main analysis function
export const analyzeImage = async (imageFile: File, forceRetry: boolean = false): Promise<{ items: DetectedItem[]; screenType: string }> => {
  try {
    let imageBase64 = await fileToBase64(imageFile);
    const imageHash = await generateImageHash(imageBase64);

    // Check cache first
    if (!forceRetry) {
      const cachedResult = getCachedAnalysis(imageHash);
      if (cachedResult) {
        const items = filterNewItems(cachedResult);
        if (items.length === 0) {
          console.log(`>>> [OCR] Cached result had 0 items — bypassing cache and re-analyzing <<<`);
        } else {
          console.log(`>>> [OCR] Using cached analysis result - avoiding OCR processing <<<`);
          return { items, screenType: 'unknown' };
        }
      }
    } else {
      console.log(`>>> [OCR] Force retry requested - bypassing cache for image hash ${imageHash} <<<`);
      clearCachedAnalysis(imageHash);
    }

    // Step 1: Extract text using OCR
    console.log(`>>> [OCR] Step 1: Extracting text from image <<<`);
    const extractedText = await extractTextFromImage(imageFile);
    console.log(`>>> [OCR] Extracted text preview:`, extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : ''), ` <<<`);

    // Step 2: Determine screen type
    console.log(`>>> [OCR] Step 2: Determining screen type <<<`);
    const screenType = determineScreenType(extractedText);
    console.log(`>>> [OCR] Detected screen type: ${screenType} <<<`);

    // Step 3: Parse detected items
    const detectedItems = parseDetectedItems(extractedText, screenType);
    console.log(`>>> [OCR] Screen type: ${screenType} <<<`);
    console.log(`>>> [OCR] Parsed ${detectedItems.length} items:`, detectedItems.map(item => `${item.name} (${item.category})`), ` <<<`);

    const categoryCounts = detectedItems.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`>>> [OCR] Category distribution:`, categoryCounts, ` <<<`);

    // Cache the results
    setCachedAnalysis(imageHash, screenType, detectedItems);

    // Filter out items that already exist in inventory
    const newItems = filterNewItems(detectedItems);
    console.log(`>>> [OCR] ${newItems.length} new items after deduplication <<<`);

    return { items: newItems, screenType };
  } catch (error) {
    console.error('Error analyzing image with OCR:', error);
    throw new Error('Failed to analyze image. Please try again.');
  }
};

// Compatibility functions for existing code
export const isGeminiConfigured = (): boolean => {
  // OCR doesn't need API key, always available
  return true;
};

export const setApiKey = (apiKey: string): boolean => {
  // OCR doesn't need API key, but we'll store it for compatibility
  try {
    localStorage.setItem('platscanner_gemini_api_key', apiKey);
    return true;
  } catch (error) {
    console.error('Failed to store API key:', error);
    return false;
  }
};

export const getApiKey = (): string | null => {
  try {
    return localStorage.getItem('platscanner_gemini_api_key');
  } catch (error) {
    console.error('Failed to retrieve API key:', error);
    return null;
  }
};

export const initializeGemini = (apiKey: string): boolean => {
  // OCR doesn't need initialization, always return true
  return true;
};

// Helper functions are already defined above, no need to re-export
