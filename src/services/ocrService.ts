import { createWorker, PSM } from 'tesseract.js';
import { DetectedItem, PrimePart, VoidRelic, SyndicateReward, Mod } from '../types';
import { getCategorizedInventory } from './inventoryService';
import { determineModRarity, determineModType } from './modService';
import { ocrLogger } from './ocrLogger';
import { getPrimeSetsCache } from './staticDataService';

// Cache for valid prime item names (built from primesets.json)
let validPrimeItemsCache: Set<string> | null = null;

// Build list of valid prime item names for validation
const buildValidPrimeItems = (): Set<string> => {
  if (validPrimeItemsCache) return validPrimeItemsCache;
  
  const primeSets = getPrimeSetsCache();
  const validItems = new Set<string>();
  
  if (primeSets && primeSets.length > 0) {
    primeSets.forEach((set: any) => {
      const setName = set.name; // e.g., "Acceltra Prime"
      validItems.add(setName.toLowerCase());
      
      // Add all component variations
      if (set.components) {
        set.components.forEach((comp: any) => {
          const compName = comp.name; // e.g., "Barrel", "Blueprint"
          // Full item name: "Acceltra Prime Barrel"
          validItems.add(`${setName} ${compName}`.toLowerCase());
          // With Blueprint suffix for warframe parts
          if (['Chassis', 'Neuroptics', 'Systems'].includes(compName)) {
            validItems.add(`${setName} ${compName} Blueprint`.toLowerCase());
          }
        });
      }
    });
  }
  
  validPrimeItemsCache = validItems;
  ocrLogger.debug('Validation', `Built valid prime items cache with ${validItems.size} items`);
  return validItems;
};

// Simple string similarity (Levenshtein-based)
const stringSimilarity = (s1: string, s2: string): number => {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

const levenshteinDistance = (s1: string, s2: string): number => {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
};

// Find best matching valid prime item
const findBestPrimeMatch = (ocrText: string, threshold: number = 0.7): string | null => {
  const validItems = buildValidPrimeItems();
  const normalizedOcr = ocrText.toLowerCase().trim();
  
  // Direct match first
  if (validItems.has(normalizedOcr)) {
    return ocrText;
  }
  
  // Try to find fuzzy match
  let bestMatch: string | null = null;
  let bestScore = 0;
  
  validItems.forEach(validItem => {
    const score = stringSimilarity(normalizedOcr, validItem);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      // Capitalize properly
      bestMatch = validItem.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  });
  
  if (bestMatch) {
    ocrLogger.debug('Validation', `Fuzzy matched "${ocrText}" → "${bestMatch}" (score: ${bestScore.toFixed(2)})`);
  }
  
  return bestMatch;
};

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
  try {
    ocrLogger.debug('Hash', 'Generating image hash');
    const sample = imageBase64.substring(0, 1000);
    const encoder = new TextEncoder();
    const data = encoder.encode(sample);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    ocrLogger.debug('Hash', `Generated hash: ${hash}`);
    return hash;
  } catch (error) {
    ocrLogger.error('Hash', 'Failed to generate image hash', { error });
    throw error;
  }
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
// Export logger for use in UI
export { ocrLogger } from './ocrLogger';

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
    ocrLogger.debug('FileConversion', `Converting file to base64: ${file.name}`);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      try {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        ocrLogger.debug('FileConversion', `File converted successfully, base64 length: ${base64.length}`);
        resolve(base64);
      } catch (error) {
        ocrLogger.error('FileConversion', 'Failed to extract base64 from data URL', { error });
        reject(error);
      }
    };
    reader.onerror = (error) => {
      ocrLogger.error('FileConversion', 'FileReader error', { error: error.toString() });
      reject(error);
    };
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
// Uses client-side Tesseract.js for OCR processing
// Note: Supabase Edge Function for OCR was deprecated - using client-side only
const extractTextFromImage = async (imageFile: File): Promise<string> => {
  ocrLogger.info('OCR', `Starting text extraction for file: ${imageFile.name} (${imageFile.size} bytes, type: ${imageFile.type})`);
  
  // Client-side OCR using Tesseract.js
  ocrLogger.info('OCR', 'Using client-side OCR processing');
  let worker: any = null;
  
  try {
    // Create worker with local files to avoid cross-origin issues
    // All Tesseract files are hosted locally at /tesseract/ (same origin)
    const workerPath = `${window.location.origin}/tesseract/worker.min.js`;
    const corePath = `${window.location.origin}/tesseract`;
    
    ocrLogger.debug('OCR', 'Creating Tesseract worker with configuration', {
      workerPath,
      corePath,
      workerBlobURL: false,
      origin: window.location.origin
    });
    
    const workerOptions: any = {
      workerPath,
      corePath,
      workerBlobURL: false,
      logger: (m: any) => {
        if (m.status === 'recognizing text' && m.progress !== undefined) {
          ocrLogger.debug('OCR', `OCR progress: ${Math.round(m.progress * 100)}%`);
        } else if (m.status) {
          ocrLogger.debug('OCR', `Worker status: ${m.status}`, m);
        }
      }
    };
    
    worker = await createWorker('eng', 1, workerOptions);
    
    // Set page segmentation mode for grid-based inventory layouts
    // PSM.SPARSE_TEXT (11) finds text without assuming reading order
    // This helps with Warframe's multi-column grid layout
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    });
    
    ocrLogger.info('OCR', 'Tesseract worker created and configured successfully');
    
    ocrLogger.debug('OCR', 'Starting OCR recognition...');
    const startTime = Date.now();
    
    const { data: { text, words, lines, paragraphs } } = await worker.recognize(imageFile);
    const duration = Date.now() - startTime;
    
    ocrLogger.info('OCR', `OCR recognition completed in ${duration}ms`, {
      textLength: text.length,
      wordCount: words?.length || 0,
      lineCount: lines?.length || 0,
      paragraphCount: paragraphs?.length || 0
    });
    
    ocrLogger.debug('OCR', 'Extracted text preview', {
      preview: text.substring(0, 500),
      fullLength: text.length
    });
    
    ocrLogger.debug('OCR', 'Terminating Tesseract worker');
    await worker.terminate();
    worker = null;
    
    return text;
  } catch (error) {
    ocrLogger.error('OCR', 'Failed to extract text from image', {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : typeof error,
      fileName: imageFile.name,
      fileSize: imageFile.size,
      fileType: imageFile.type,
      stack: error instanceof Error ? error.stack : undefined,
      isSecurityError: error instanceof Error && (error.name === 'SecurityError' || error.message.includes('insecure'))
    });
    
    // Clean up worker if it was created
    if (worker) {
      try {
        await worker.terminate();
      } catch (terminateError) {
        ocrLogger.warn('OCR', 'Failed to terminate worker during error cleanup', {
          error: terminateError instanceof Error ? terminateError.message : String(terminateError)
        });
      }
    }
    
    throw error;
  }
};

// UI text patterns to filter out (noise from Warframe UI)
const UI_NOISE_PATTERNS = [
  /^(inventory|sell|search|exit|total|tap|hold|select|info|price|items?)$/i,
  /inventory\/sell/i,
  /sell\s*(price|items)/i,
  /tap\s*(on|and)/i,
  /more\s*info/i,
  /only\s*sellable/i,
  /search\.\.\./i,
  /^\s*[@#$%^&*|\\[\]{}]+\s*$/,  // Lines with only special characters
  /^\s*\d+\s*$/,  // Lines with only numbers
  /^\s*[ivxlcdm]+\s*$/i,  // Roman numerals only
];

// Check if a line is UI noise
const isUINoiseText = (line: string): boolean => {
  const trimmed = line.trim();
  // Too short (likely OCR noise)
  if (trimmed.length < 3) return true;
  // Too many special characters relative to alphanumeric
  const alphaNum = trimmed.replace(/[^a-zA-Z0-9]/g, '').length;
  if (alphaNum < trimmed.length * 0.4) return true;
  // Matches known UI patterns
  return UI_NOISE_PATTERNS.some(pattern => pattern.test(trimmed));
};

// Determine screen type based on extracted text
const determineScreenType = (text: string): 'prime_parts' | 'relics' | 'syndicate' | 'mods' | 'unknown' => {
  ocrLogger.debug('ScreenType', 'Determining screen type from extracted text', {
    textLength: text.length,
    textPreview: text.substring(0, 200)
  });
  
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
    ocrLogger.info('ScreenType', 'Detected screen type: syndicate');
    return 'syndicate';
  }

  // Check for relic indicators
  if (
    lowerText.includes('void relics') ||
    lowerText.includes('relic') ||
    /\b(lith|meso|neo|axi)\s+[a-z]\d+/i.test(text)
  ) {
    ocrLogger.info('ScreenType', 'Detected screen type: relics');
    return 'relics';
  }

  // Check for prime parts BEFORE mods (more specific patterns first)
  // "PRIME PARTS" header or multiple Prime item names
  if (
    lowerText.includes('prime parts') ||
    (lowerText.includes('prime') && (
      lowerText.includes('blueprint') ||
      lowerText.includes('chassis') ||
      lowerText.includes('neuroptics') ||
      lowerText.includes('systems') ||
      lowerText.includes('barrel') ||
      lowerText.includes('receiver') ||
      lowerText.includes('stock') ||
      lowerText.includes('blade') ||
      lowerText.includes('handle') ||
      lowerText.includes('link') ||
      lowerText.includes('boot') ||
      lowerText.includes('gauntlet')
    ))
  ) {
    ocrLogger.info('ScreenType', 'Detected screen type: prime_parts');
    return 'prime_parts';
  }

  // Check for mod indicators (polarity symbols, drain costs)
  // Be more specific to avoid false positives from OCR noise
  if (
    /\bmods?\b/i.test(text) ||
    /\b(drain|capacity)\s*:?\s*\d+/i.test(text) ||
    /\d+\s*\/\s*\d+\s*\(drain/i.test(text) // Rank format with drain
  ) {
    ocrLogger.info('ScreenType', 'Detected screen type: mods');
    return 'mods';
  }

  // Fallback check for prime parts (less specific)
  if (lowerText.includes('prime') || lowerText.includes('blueprint')) {
    ocrLogger.info('ScreenType', 'Detected screen type: prime_parts');
    return 'prime_parts';
  }

  ocrLogger.warn('ScreenType', 'Could not determine screen type, defaulting to unknown', {
    textPreview: text.substring(0, 500)
  });
  return 'unknown';
};

// Known component types for Prime items
const PRIME_COMPONENT_TYPES = [
  'Blueprint', 'Chassis', 'Neuroptics', 'Systems',
  'Barrel', 'Receiver', 'Stock', 'Blade', 'Handle', 'Link',
  'Grip', 'String', 'Lower Limb', 'Upper Limb',
  'Gauntlet', 'Boot', 'Ornament', 'Head', 'Pouch',
  'Carapace', 'Cerebrum', 'Guard', 'Hilt', 'Blades'
];

// Extract prime items using pattern matching across the entire text
const extractPrimeItemsFromText = (text: string): string[] => {
  const validItems = buildValidPrimeItems();
  const foundItems: string[] = [];
  const seenItems = new Set<string>();
  
  // Normalize text - replace newlines with spaces for cross-line matching
  const normalizedText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  
  // Pattern 1: "X Prime Component" (e.g., "Corvas Prime Receiver")
  // This regex finds "Word Prime Word" patterns
  const primePattern = /([A-Z][a-zA-Z&\s]*?)\s*Prime\s+([A-Za-z]+(?:\s+Blueprint)?)/gi;
  let match;
  
  while ((match = primePattern.exec(normalizedText)) !== null) {
    const setName = match[1].trim();
    const component = match[2].trim();
    const fullName = `${setName} Prime ${component}`;
    
    // Validate against known items
    const matchedItem = findBestPrimeMatch(fullName, 0.65);
    if (matchedItem && !seenItems.has(matchedItem.toLowerCase())) {
      foundItems.push(matchedItem);
      seenItems.add(matchedItem.toLowerCase());
      ocrLogger.debug('Parsing', `Pattern matched: "${fullName}" → "${matchedItem}"`);
    }
  }
  
  // Pattern 2: Just "X Prime" without component (for set-level matches)
  const primeOnlyPattern = /([A-Z][a-zA-Z&\s]*?)\s*Prime(?!\s+[A-Z])/gi;
  while ((match = primeOnlyPattern.exec(normalizedText)) !== null) {
    const fullName = `${match[1].trim()} Prime`;
    const matchedItem = findBestPrimeMatch(fullName, 0.7);
    if (matchedItem && !seenItems.has(matchedItem.toLowerCase())) {
      // Only add set names if they're valid and we haven't found components
      const hasComponents = foundItems.some(item => 
        item.toLowerCase().startsWith(matchedItem.toLowerCase())
      );
      if (!hasComponents) {
        foundItems.push(matchedItem);
        seenItems.add(matchedItem.toLowerCase());
      }
    }
  }
  
  // Pattern 3: Try to find components that were on separate lines
  // Look for orphaned component names and try to match with recent Prime names
  PRIME_COMPONENT_TYPES.forEach(compType => {
    const compRegex = new RegExp(`\\b${compType}\\b`, 'gi');
    const compMatches = normalizedText.match(compRegex) || [];
    
    compMatches.forEach(() => {
      // For each component, look for nearby Prime names
      const searchPattern = new RegExp(
        `([A-Z][a-zA-Z&\\s]*?)\\s*Prime[\\s\\S]{0,50}?${compType}|${compType}[\\s\\S]{0,50}?([A-Z][a-zA-Z&\\s]*?)\\s*Prime`,
        'gi'
      );
      const nearbyMatch = searchPattern.exec(normalizedText);
      if (nearbyMatch) {
        const setName = (nearbyMatch[1] || nearbyMatch[2] || '').trim();
        if (setName) {
          const fullName = `${setName} Prime ${compType}`;
          const matchedItem = findBestPrimeMatch(fullName, 0.65);
          if (matchedItem && !seenItems.has(matchedItem.toLowerCase())) {
            foundItems.push(matchedItem);
            seenItems.add(matchedItem.toLowerCase());
            ocrLogger.debug('Parsing', `Nearby match: "${fullName}" → "${matchedItem}"`);
          }
        }
      }
    });
  });
  
  return foundItems;
};

// Parse detected items from OCR text
const parseDetectedItems = (text: string, screenType?: string): DetectedItem[] => {
  ocrLogger.debug('Parsing', 'Starting item parsing', {
    screenType,
    textLength: text.length,
    textPreview: text.substring(0, 300)
  });
  
  const detectedItems: DetectedItem[] = [];
  
  // For prime_parts, use the smarter pattern-based extraction
  if (screenType === 'prime_parts') {
    const primeItems = extractPrimeItemsFromText(text);
    ocrLogger.info('Parsing', `Pattern extraction found ${primeItems.length} prime items`);
    
    primeItems.forEach((itemName, index) => {
      const primeItem: PrimePart = {
        id: `prime-${Date.now()}-${index}`,
        name: itemName,
        category: 'prime_parts',
        quantity: 1,
        status: 'loading'
      };
      detectedItems.push(primeItem);
    });
    
    ocrLogger.info('Parsing', `Parsed ${detectedItems.length} prime parts`, {
      itemNames: detectedItems.map(item => item.name)
    });
    
    return detectedItems;
  }
  
  // Fallback to line-by-line parsing for other screen types
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  ocrLogger.debug('Parsing', `Split text into ${lines.length} lines`);
  let detectedSyndicate = 'Unknown';

  lines.forEach((line, index) => {
    // Skip UI noise and garbage text
    if (isUINoiseText(line)) {
      ocrLogger.debug('Parsing', `Skipping noise: "${line}"`);
      return;
    }

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

    // For prime_parts screen type, use fuzzy matching against known items
    if (screenType === 'prime_parts') {
      // Try to find a valid prime item match
      const matchedItem = findBestPrimeMatch(cleanLine, 0.65);
      if (matchedItem) {
        const primeItem: PrimePart = {
          id: `prime-${Date.now()}-${index}`,
          name: matchedItem,
          category: 'prime_parts',
          quantity,
          status: 'loading'
        };
        detectedItems.push(primeItem);
        return;
      }
      // No match found - skip this line for prime parts
      return;
    }

    // Legacy check for Prime part (for non-prime_parts screen types)
    if (cleanLine.includes('Prime') || cleanLine.includes('Blueprint')) {
      // Still try fuzzy match first
      const matchedItem = findBestPrimeMatch(cleanLine, 0.65);
      const primeItem: PrimePart = {
        id: `prime-${Date.now()}-${index}`,
        name: matchedItem || cleanLine,
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

  ocrLogger.info('Parsing', `Parsed ${detectedItems.length} items from ${lines.length} lines`, {
    itemsByCategory: detectedItems.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    itemNames: detectedItems.map(item => item.name)
  });
  
  return detectedItems;
};

// Main analysis function
export const analyzeImage = async (imageFile: File, forceRetry: boolean = false): Promise<{ items: DetectedItem[]; screenType: string }> => {
  const analysisStartTime = Date.now();
  ocrLogger.info('Analysis', `Starting image analysis`, {
    fileName: imageFile.name,
    fileSize: imageFile.size,
    fileType: imageFile.type,
    forceRetry
  });

  try {
    ocrLogger.debug('Analysis', 'Converting file to base64');
    let imageBase64 = await fileToBase64(imageFile);
    ocrLogger.debug('Analysis', 'Generating image hash');
    const imageHash = await generateImageHash(imageBase64);
    ocrLogger.info('Analysis', `Image hash: ${imageHash}`);

    // Check cache first
    if (!forceRetry) {
      ocrLogger.debug('Analysis', 'Checking cache for existing results');
      const cachedResult = getCachedAnalysis(imageHash);
      if (cachedResult) {
        ocrLogger.info('Analysis', `Found cached result with ${cachedResult.length} items`);
        const items = filterNewItems(cachedResult);
        if (items.length === 0) {
          ocrLogger.warn('Analysis', 'Cached result had 0 items after filtering — bypassing cache and re-analyzing');
        } else {
          ocrLogger.info('Analysis', `Using cached analysis result - ${items.length} new items`);
          return { items, screenType: 'unknown' };
        }
      } else {
        ocrLogger.debug('Analysis', 'No cached result found');
      }
    } else {
      ocrLogger.info('Analysis', 'Force retry requested - bypassing cache');
      clearCachedAnalysis(imageHash);
    }

    // Step 1: Extract text using OCR
    ocrLogger.info('Analysis', 'Step 1: Extracting text from image using OCR');
    const extractedText = await extractTextFromImage(imageFile);
    ocrLogger.info('Analysis', `Extracted ${extractedText.length} characters of text`, {
      preview: extractedText.substring(0, 500)
    });

    if (!extractedText || extractedText.trim().length === 0) {
      ocrLogger.error('Analysis', 'OCR extracted no text from image', {
        fileName: imageFile.name,
        fileSize: imageFile.size
      });
      throw new Error('OCR extracted no text from image. Please ensure the image contains readable text.');
    }

    // Step 2: Determine screen type
    ocrLogger.info('Analysis', 'Step 2: Determining screen type');
    const screenType = determineScreenType(extractedText);
    ocrLogger.info('Analysis', `Detected screen type: ${screenType}`);

    // Step 3: Parse detected items
    ocrLogger.info('Analysis', 'Step 3: Parsing detected items');
    const detectedItems = parseDetectedItems(extractedText, screenType);
    
    const categoryCounts = detectedItems.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    ocrLogger.info('Analysis', `Parsed ${detectedItems.length} items`, {
      categoryDistribution: categoryCounts,
      items: detectedItems.map(item => ({ name: item.name, category: item.category }))
    });

    // Cache the results
    ocrLogger.debug('Analysis', 'Caching analysis results');
    setCachedAnalysis(imageHash, screenType, detectedItems);

    // Filter out items that already exist in inventory
    ocrLogger.debug('Analysis', 'Filtering out duplicate items');
    const newItems = filterNewItems(detectedItems);
    ocrLogger.info('Analysis', `Filtered to ${newItems.length} new items (${detectedItems.length - newItems.length} duplicates removed)`);

    const duration = Date.now() - analysisStartTime;
    ocrLogger.info('Analysis', `Analysis completed successfully in ${duration}ms`, {
      screenType,
      totalItems: detectedItems.length,
      newItems: newItems.length,
      duplicates: detectedItems.length - newItems.length
    });

    return { items: newItems, screenType };
  } catch (error) {
    const duration = Date.now() - analysisStartTime;
    ocrLogger.error('Analysis', 'Image analysis failed', {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
      fileName: imageFile.name,
      fileSize: imageFile.size,
      fileType: imageFile.type,
      duration
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to analyze image. Please try again.';
    throw new Error(errorMessage);
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
