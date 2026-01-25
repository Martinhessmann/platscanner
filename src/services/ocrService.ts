import { DetectedItem, VoidRelic, SyndicateReward, Mod } from '../types';
import { getCategorizedInventory } from './inventoryService';
import { determineModRarity, determineModType } from './modService';
import { ocrLogger } from './ocrLogger';
import { getPrimeSetsCache } from './staticDataService';
import {
  isLLMWhispererConfigured,
  extractTextWithLLMWhisperer,
  setLLMWhispererApiKey
} from './llmWhispererService';



// [Deleted Tesseract functions and unused image processing]

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


// Helper to parse quantity from a line
const parseQuantity = (line: string): { quantity: number, cleanLine: string } => {
  let quantity = 1;
  let cleanLine = line;

  // Try "5 x Item" or "5 × Item"
  let match = line.match(/^(\d+)\s*[x×]\s*(.+)$/i);
  if (match) {
    quantity = parseInt(match[1]);
    cleanLine = match[2].trim();
    return { quantity, cleanLine };
  }

  // Try "Item x5" or "Item ×5"
  match = line.match(/^(.+)\s*[x×](\d+)$/i);
  if (match) {
    cleanLine = match[1].trim();
    quantity = parseInt(match[2]);
    return { quantity, cleanLine };
  }

  // Try "x5 Item" or "×5 Item"
  match = line.match(/^[x×](\d+)\s*(.+)$/i);
  if (match) {
    quantity = parseInt(match[1]);
    cleanLine = match[2].trim();
    return { quantity, cleanLine };
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

// Extract prime items using pattern matching across the entire text
const extractPrimeItemsFromText = (text: string): DetectedItem[] => {
  const validItems = buildValidPrimeItems();
  const foundItems: DetectedItem[] = [];
  const seenItems = new Set<string>();

  // Split into lines for quantity detection
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  lines.forEach((line, index) => {
    // Skip UI noise
    if (isUINoiseText(line)) return;

    const { quantity, cleanLine } = parseQuantity(line);

  // Pattern 1: "X Prime Component" (e.g., "Corvas Prime Receiver")
  // This regex finds "Word Prime Word" patterns
    const primePattern = /([A-Z][a-zA-Z&\s]*?)\s*Prime\s+([A-Za-z]+(?:\s+Blueprint)?)/i;
    let match = primePattern.exec(cleanLine);

    if (match) {
      const setName = match[1].trim();
      const component = match[2].trim();
      const fullName = `${setName} Prime ${component}`;

      // Validate against known items
      const matchedItem = findBestPrimeMatch(fullName, 0.85);
      if (matchedItem) {
        // Create a unique key for deduplication within this scan
        const key = matchedItem.toLowerCase();
        if (!seenItems.has(key)) {
          foundItems.push({
            id: `prime-${Date.now()}-${index}`,
            name: matchedItem,
            category: 'prime_parts',
            quantity,
            status: 'loading'
          });
          seenItems.add(key);
          ocrLogger.debug('Parsing', `Pattern matched: "${fullName}" → "${matchedItem}" (x${quantity})`);
        }
        return; // Found a match on this line
      }
    }

    // Pattern 2: Just "X Prime" without component (for set-level matches)
    const primeOnlyPattern = /([A-Z][a-zA-Z&\s]*?)\s*Prime(?!\s+[A-Z])/i;
    match = primeOnlyPattern.exec(cleanLine);
    if (match) {
      const fullName = `${match[1].trim()} Prime`;
      const matchedItem = findBestPrimeMatch(fullName, 0.7);
      if (matchedItem) {
        const key = matchedItem.toLowerCase();
        // Only add set names if they're valid and we haven't found components
        const hasComponents = foundItems.some(item =>
          item.name.toLowerCase().startsWith(key)
        );
        if (!hasComponents && !seenItems.has(key)) {
          foundItems.push({
            id: `prime-${Date.now()}-${index}`,
            name: matchedItem,
            category: 'prime_parts',
            quantity,
            status: 'loading'
          });
          seenItems.add(key);
        }
      }
    }
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

  // For prime_parts, use the smarter pattern-based extraction
  if (screenType === 'prime_parts') {
    const primeItems = extractPrimeItemsFromText(text);
    ocrLogger.info('Parsing', `Pattern extraction found ${primeItems.length} prime items`);
    return primeItems;
  }

  const detectedItems: DetectedItem[] = [];
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

    // Syndicate reward format: "ITEM_NAME | 25,000"
    const syndicateRewardMatch = cleanLine.match(/^(.*?)\s*\|\s*([\d,]+)/);
    if (syndicateRewardMatch && (screenType === 'syndicate' || screenType === 'unknown')) {
      const name = syndicateRewardMatch[1].trim();
      const standingStr = syndicateRewardMatch[2].replace(/,/g, '');
      const standingCost = parseInt(standingStr, 10);

      // Skip if it looks like a mod line (e.g. "Mod Name | Rank | Drain")
      // Syndicate rewards usually just have Name | Cost
      const isModLine = cleanLine.match(/^.+?\|\s*\d+\s*\|\s*\d+/);

      if (!isModLine) {
        const reward: SyndicateReward = {
          id: `syndicate-${Date.now()}-${index}`,
          name,
          category: 'syndicate_rewards',
          syndicate: detectedSyndicate,
          standingCost: isNaN(standingCost) ? 0 : standingCost,
          itemType: 'mod', // Default, will be refined by service
          currency: detectedSyndicate.toLowerCase().includes('arbitration') ? 'vitus_essence' : 'standing',
          status: 'loading',
          quantity
        };
        detectedItems.push(reward);
        return;
      }
    }

    // Check if it's a Void Relic
    if (cleanLine.includes('Relic') || /\b(Lith|Meso|Neo|Axi)\s+[A-Z]\d+/i.test(cleanLine)) {
      let relicName = cleanLine;
      let rarity: VoidRelic['rarity'] = 'intact';

      // Extract rarity: "Lith A1 Relic (Radiant)" or "Radiant Lith A1 Relic"
      const rarityMatch = cleanLine.match(/[\(\[](Intact|Exceptional|Flawless|Radiant)[\)\]]/i) ||
        cleanLine.match(/\b(Intact|Exceptional|Flawless|Radiant)\b/i);

      if (rarityMatch) {
        rarity = rarityMatch[1].toLowerCase() as VoidRelic['rarity'];
        // Clean rarity from name
        relicName = cleanLine.replace(/[\(\[](Intact|Exceptional|Flawless|Radiant)[\)\]]/gi, '')
          .replace(/\b(Intact|Exceptional|Flawless|Radiant)\b/gi, '')
          .trim()
          .replace(/\s+/g, ' '); // Fix double spaces
      }

      // Ensure "Relic" is in the name if missing
      if (!relicName.toLowerCase().includes('relic')) {
        relicName += ' Relic';
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
      // Mod Pattern 1: "Name | Rank X | Drain Y"
      // Example: "Blind Rage | 8 | 14"
      const pipeMatch = cleanLine.match(/^(.+?)\s*\|\s*(\d+)\s*\|\s*(\d+)/);
      if (pipeMatch) {
        const modName = pipeMatch[1].trim();
        const detectedLevel = parseInt(pipeMatch[2]);
        const detectedDrain = parseInt(pipeMatch[3]);

        const rarity = determineModRarity(modName);
        const type = determineModType(modName);

        const modItem: Mod = {
          id: `mod-${Date.now()}-${index}`,
          name: modName,
          category: 'mods',
          rank: detectedLevel,
          quantity,
          drain: detectedDrain,
          rarity,
          type,
          status: 'loading'
        };
        detectedItems.push(modItem);
        return;
      }

      // Mod Pattern 2: "Name Rank X/Y (Drain Z)"
      // Example: "Blind Rage Rank 8/10 (Drain 14)"
      const rankMatch = cleanLine.match(/^(.+?)\s+(?:Rank|r)\s*(\d+)\/\d+\s*(?:\(Drain\s*(\d+)\))?/i);
      if (rankMatch) {
        const modName = rankMatch[1].trim();
        const detectedLevel = parseInt(rankMatch[2]);
        const detectedDrain = rankMatch[3] ? parseInt(rankMatch[3]) : undefined;

        const rarity = determineModRarity(modName);
        const type = determineModType(modName);

        const modItem: Mod = {
          id: `mod-${Date.now()}-${index}`,
          name: modName,
          category: 'mods',
          rank: detectedLevel,
          quantity,
          drain: detectedDrain,
          rarity,
          type,
          status: 'loading'
        };
        detectedItems.push(modItem);
        return;
      }

      // Fallback: simple mod name (only if we are reasonably sure it's a mod screen or it looks like a mod)
      // For now, we'll be conservative and only match if we have strong indicators or if screenType is 'mods'
      if (screenType === 'mods' || determineModRarity(cleanLine) !== 'uncommon') {
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
    // Only use LLMWhisperer
    let extractedText = '';


    const llmWhispererConfigured = isLLMWhispererConfigured();

    if (!llmWhispererConfigured) {
      ocrLogger.error('Analysis', 'LLMWhisperer not configured');
      throw new Error('LLMWhisperer API key not configured. Please go to Settings → API and enter your key to use the scanner.');
    }

    ocrLogger.info('Analysis', '✅ LLMWhisperer configured - using AI OCR');
    ocrLogger.info('Analysis', 'Step 1: Extracting text using LLMWhisperer');

    try {
      extractedText = await extractTextWithLLMWhisperer(imageFile);
      ocrLogger.info('Analysis', `LLMWhisperer extracted ${extractedText.length} characters`);
    } catch (llmError) {
      ocrLogger.error('Analysis', 'LLMWhisperer failed', {
        error: llmError instanceof Error ? llmError.message : String(llmError)
      });
      // Propagate the specific error message to the UI
      throw new Error(`LLMWhisperer OCR failed: ${llmError instanceof Error ? llmError.message : 'Unknown error'}`);
    }

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

    // Step 2b: Grid extraction logic removed (was Tesseract fallback)

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

// LLMWhisperer exports for UI configuration
export {
  isLLMWhispererConfigured,
  setLLMWhispererApiKey
} from './llmWhispererService';

// Helper functions are already defined above, no need to re-export
