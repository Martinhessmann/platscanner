import { DetectedItem, VoidRelic } from '../types';
import { getCategorizedInventory } from './inventoryService';
import { determineModRarity } from './modService';
import { ocrLogger } from './ocrLogger';
import { getPrimeSetsCache } from './staticDataService';
import {
  isLLMWhispererConfigured,
  extractTextWithLLMWhisperer,
  WhisperResult
} from './llmWhispererService';



// LLMWhisperer-only OCR pipeline

// UI text patterns to filter out (noise from Warframe UI)
const UI_NOISE_PATTERNS = [
  /^(inventory|sell|search|exit|total|tap|hold|select|info|price|items?|sort by|duplicates|fragments?|credits|endo)$/i,
  /inventory\/sell/i,
  /sell\s*(price|items)/i,
  /tap\s*(on|and)/i,
  /more\s*info/i,
  /only\s*sellable/i,
  /search\.\.\./i,
  /modding/i,
  /fusion/i,
  /transmute/i,
  /dissolve/i,
  /quick select/i,
  /filter/i,
  /riven capacity/i,
  /ayatan treasures/i,
  /no mod selected/i,
  /hold to preview/i,
  /tap to select/i,
  /^\s*[@#$%^&*|\\[\]{}:~\-]+\s*$/,  // Lines with only special chars
  /^\s*[ivxlcdm]+\s*$/i,  // Roman numerals only
];

// Check if a line is UI noise
const isUINoiseText = (line: string): boolean => {
  const trimmed = line.trim();

  // NEVER skip potential quantities or unowned markers
  const isQuantityOrMarker =
    /^([x×])?(\d+)$/i.test(trimmed) ||
    /^[\(\[]?[Oo0ØVv@©®\-\s][\)\]]?$/.test(trimmed) ||
    trimmed === '()' || trimmed === '[]' || trimmed === 'x' || trimmed === '×';

  if (isQuantityOrMarker) return false;

  // Too short (likely OCR noise if NOT a quantity/marker)
  if (trimmed.length < 2) return true;

  // Too many special characters relative to alphanumeric (increased tolerance for markers)
  const alphaNum = trimmed.replace(/[^a-zA-Z0-9]/g, '').length;
  if (trimmed.length > 3 && alphaNum < trimmed.length * 0.3) return true;

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


// Helper to parse quantity from a line
const parseQuantity = (line: string): { quantity: number, cleanLine: string } => {
  let quantity = 1;
  let cleanLine = line.trim();

  // 1. Try "5 x Item" or "5 × Item" or "5X Item"
  let match = cleanLine.match(/^(\d+)\s*[x×]\s+(.+)$/i);
  if (match) {
    quantity = parseInt(match[1]);
    cleanLine = match[2].trim();
    return { quantity, cleanLine };
  }

  // 2. Try "Item x5" or "Item ×5" (explicitly with x/×)
  match = cleanLine.match(/^(.+?)\s+[x×](\d+)$/i);
  if (match) {
    cleanLine = match[1].trim();
    quantity = parseInt(match[2]);
    return { quantity, cleanLine };
  }

  // 3. Try "x5 Item" or "×5 Item" (no space)
  match = cleanLine.match(/^[x×](\d+)\s*(.+)$/i);
  if (match) {
    quantity = parseInt(match[1]);
    cleanLine = match[2].trim();
    return { quantity, cleanLine };
  }

  // 4. Try "Itemx5" or "Item×5" (no space)
  match = cleanLine.match(/^(.+?)[x×](\d+)$/i);
  if (match) {
    cleanLine = match[1].trim();
    quantity = parseInt(match[2]);
    return { quantity, cleanLine };
  }

  // 5. Check if the line is JUST a quantity (e.g., "x5" or "5")
  const isPureQuantity = /^([x×])?(\d+)$/i.test(cleanLine);
  if (isPureQuantity) {
    const qtyMatch = cleanLine.match(/^([x×])?(\d+)$/i);
    if (qtyMatch) {
      return { quantity: parseInt(qtyMatch[2]), cleanLine: '' };
    }
  }

  // 6. Explicitly handle the common "Item 5" case only if it's NOT a relic name pattern
  // Relic pattern example: "Lith A1" -> should NOT be Lith A quantity 1
  const isRelicPattern = /\b(Lith|Meso|Neo|Axi)\s+[A-Z]\d+$/i.test(cleanLine);
  if (!isRelicPattern) {
    match = cleanLine.match(/^(.+?)\s+(\d+)$/i);
    if (match) {
      const potentialName = match[1].trim();
      const potentialQty = parseInt(match[2]);
      // Only treat as quantity if it's a small number or if there's a large gap
      if (potentialQty < 100) {
        cleanLine = potentialName;
        quantity = potentialQty;
      }
    }
  }

  return { quantity, cleanLine };
};

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
// Higher threshold (0.85) to prevent false positives like "Gedo" → "Bronco"
const findBestPrimeMatch = (ocrText: string, threshold: number = 0.85): string | null => {
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

// Parse detected items from OCR text
const parseDetectedItems = (text: string, screenType?: string, whisperResult?: WhisperResult): DetectedItem[] => {
  ocrLogger.debug('Parsing', 'Starting item parsing', {
    screenType,
    textLength: text.length,
    textPreview: text.substring(0, 300)
  });

  const detectedItems: DetectedItem[] = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  ocrLogger.debug('Parsing', `Split text into ${lines.length} lines`);

  // State machine for sequential badge/item pairing
  const pendingBadges: number[] = [];
  let detectedSyndicate = 'Unknown';

  lines.forEach((line, index) => {
    // Skip UI noise
    if (isUINoiseText(line)) {
      ocrLogger.debug('Parsing', `Skipping noise: "${line}"`);
      return;
    }

    // Check for syndicate name
    if (line.includes('Arbiters of Hexis') || line.includes('Cephalon Suda') ||
      line.includes('Steel Meridian') || line.includes('New Loka') ||
      line.includes('Red Veil') || line.includes('Perrin Sequence') ||
      line.includes('Arbitration Honors') || line.match(/^SYNDICATE:\s*(.+)$/i)) {

      const match = line.match(/^SYNDICATE:\s*(.+)$/i);
      detectedSyndicate = match ? match[1].trim() : line.trim();
      console.log(`>>> [OCR Parsing] Detected syndicate: "${detectedSyndicate}" <<<`);
      return;
    }

    // Parse quantity
    const { quantity, cleanLine } = parseQuantity(line);

    // 1. If the line is JUST a badge (no text left), add it to pending
    if (cleanLine === '' || cleanLine === 'x' || cleanLine === '×') {
      if (quantity > 1) {
        pendingBadges.push(quantity);
        console.log(`>>> [OCR Parsing] Found standalone badge: x${quantity} <<<`);
      } else {
        // Known unowned glyph artifact?
        if (line.match(/^[\(\[]?[Oo0ØVv@©®\-\s][\)\]]?$/) || line === '()' || line === '[]') {
          console.log(`>>> [OCR Parsing] Found unowned marker glyph: "${line}" <<<`);
          pendingBadges.push(0);
        }
      }
      return;
    }

    // 2. Extract item details
    let matchedName: string | null = null;
    let itemCategory: DetectedItem['category'] = 'relics'; // Default, will change
    let extraData: any = {};

    // Relic Check
    if (cleanLine.includes('Relic') || /\b(Lith|Meso|Neo|Axi)\s+[A-Z]\d+/i.test(cleanLine)) {
      itemCategory = 'relics';
      let relicName = cleanLine;
      let rarity: VoidRelic['rarity'] = 'intact';

      const rarityMatch = cleanLine.match(/[\(\[](Intact|Exceptional|Flawless|Radiant)[\)\]]/i) ||
        cleanLine.match(/\b(Intact|Exceptional|Flawless|Radiant)\b/i);

      if (rarityMatch) {
        rarity = rarityMatch[1].toLowerCase() as VoidRelic['rarity'];
        relicName = cleanLine.replace(/[\(\[](Intact|Exceptional|Flawless|Radiant)[\)\]]/gi, '')
          .replace(/\b(Intact|Exceptional|Flawless|Radiant)\b/gi, '')
          .trim()
          .replace(/\s+/g, ' ');
      }

      if (!relicName.toLowerCase().includes('relic')) relicName += ' Relic';
      matchedName = relicName;
      extraData = { rarity };
    }
    // Prime Check
    else if (cleanLine.match(/([A-Z][a-zA-Z&\s]*?)\s*Prime\s+([A-Za-z]+(?:\s+Blueprint)?)/i) || cleanLine.includes('Prime')) {
      const match = cleanLine.match(/([A-Z][a-zA-Z&\s]*?)\s*Prime\s+([A-Za-z]+(?:\s+Blueprint)?)/i);
      const fullName = match ? `${match[1].trim()} Prime ${match[2].trim()}` : cleanLine;
      const matched = findBestPrimeMatch(fullName, 0.7);
      if (matched) {
        matchedName = matched;
        itemCategory = 'prime_parts';
      }
    }
    // Mod Check
    else if (screenType === 'mods') {
      const rarity = determineModRarity(cleanLine);
      const isKnown = rarity !== 'uncommon';
      const looksLikeName = cleanLine.length > 5 && !/^\d+$/.test(cleanLine) && !cleanLine.includes('|');

      if (isKnown || looksLikeName) {
        itemCategory = 'mods';

        // Mod parsing using internal regex for Rank/Drain
        const pipeMatch = cleanLine.match(/^(.+?)\s*\|\s*(\d+)\s*\|\s*(\d+)/);
        const rankMatch = cleanLine.match(/^(.+?)\s+(?:Rank|r)\s*(\d+)\/\d+\s*(?:\(Drain\s*(\d+)\))?/i);
        const standaloneDrainMatch = cleanLine.match(/^(.+?)\s+(\d+)$/);

        if (pipeMatch) {
          matchedName = pipeMatch[1].trim();
          extraData = { rank: parseInt(pipeMatch[2]), drain: parseInt(pipeMatch[3]) };
        } else if (rankMatch) {
          matchedName = rankMatch[1].trim();
          extraData = {
            rank: parseInt(rankMatch[2]),
            drain: rankMatch[3] ? parseInt(rankMatch[3]) : undefined
          };
        } else if (standaloneDrainMatch) {
          matchedName = standaloneDrainMatch[1].trim();
          const potentialDrain = parseInt(standaloneDrainMatch[2]);
          if (potentialDrain > 1 && potentialDrain < 20) {
            extraData = { drain: potentialDrain };
          }
        } else {
          matchedName = cleanLine;
        }

        matchedName = matchedName!.replace(/[.·*•-]$/, '').trim();
      }
    }

    if (matchedName) {
      // APPLY ADJACENCY INFERENCE
      let finalQuantity = quantity;

      // If we have pending badges, consume one
      if (pendingBadges.length > 0) {
        finalQuantity = pendingBadges.shift()!;
        console.log(`>>> [OCR Parsing] Pairing ${matchedName} with pending badge: x${finalQuantity} <<<`);
      }

      // Skip unowned items
      if (finalQuantity === 0) {
        ocrLogger.info('Parsing', `Skipping unowned item: ${matchedName}`);
        return;
      }

      const item: DetectedItem = {
        id: `${itemCategory}-${Date.now()}-${index}`,
        name: matchedName,
        category: itemCategory,
        quantity: finalQuantity,
        status: 'loading',
        ...extraData
      };

      detectedItems.push(item);
    }
  });

  ocrLogger.info('Parsing', `Parsed ${detectedItems.length} items from ${lines.length} lines`);
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
    const imageBase64 = await fileToBase64(imageFile);
    const imageHash = await generateImageHash(imageBase64);

    // Check cache
    if (!forceRetry) {
      const cachedResult = getCachedAnalysis(imageHash);
      if (cachedResult) {
        const items = filterNewItems(cachedResult);
        if (items.length > 0) return { items, screenType: 'unknown' };
      }
    } else {
      clearCachedAnalysis(imageHash);
    }

    if (!isLLMWhispererConfigured()) {
      throw new Error('LLMWhisperer API key not configured.');
    }

    const whisperResult = await extractTextWithLLMWhisperer(imageFile);
    const extractedText = whisperResult.extracted_text || whisperResult.text || '';

    if (!extractedText.trim()) throw new Error('OCR extracted no text.');

    const screenType = determineScreenType(extractedText);
    const detectedItems = parseDetectedItems(extractedText, screenType, whisperResult);

    setCachedAnalysis(imageHash, screenType, detectedItems);
    const newItems = filterNewItems(detectedItems);

    const duration = Date.now() - analysisStartTime;
    ocrLogger.info('Analysis', `Completed in ${duration}ms`, { totalItems: detectedItems.length, newItems: newItems.length });

    return { items: newItems, screenType };
  } catch (error) {
    const duration = Date.now() - analysisStartTime;
    ocrLogger.error('Analysis', 'Failed', { error: error instanceof Error ? error.message : String(error), duration });
    throw error;
  }
};

export const isOcrConfigured = (): boolean => {
  return isLLMWhispererConfigured();
};

export const setOcrApiKey = (apiKey: string): boolean => {
  try {
    setLLMWhispererApiKey(apiKey);
    return true;
  } catch (error) {
    console.error('Failed to store OCR API key:', error);
    return false;
  }
};

export const getOcrApiKey = (): string | null => {
  try {
    return localStorage.getItem('platscanner_llmwhisperer_api_key');
  } catch (error) {
    console.error('Failed to retrieve OCR API key:', error);
    return null;
  }
};

export { isLLMWhispererConfigured, setLLMWhispererApiKey } from './llmWhispererService';

// Helper functions are already defined above, no need to re-export
