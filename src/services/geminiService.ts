import { GoogleGenAI } from '@google/genai';
import { DetectedItem, PrimePart, VoidRelic, SyndicateReward, Mod } from '../types';
import { getCategorizedInventory } from './inventoryService';
import { determineModRarity, determineModType } from './modService';

const API_KEY_STORAGE_KEY = 'platscanner_gemini_api_key';
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
const generateImageHash = async (imageBase64: string): Promise<string> => {
  // Use a sample of the image data for hashing (first 1000 chars to avoid memory issues)
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

    // Find matching cache entry that's not expired
    const entry = cache.find(e =>
      e.hash === imageHash &&
      (now - e.timestamp) < expiryTime
    );

    if (entry) {
      console.log(`>>> [Gemini Cache] Found cached result for image hash ${imageHash} <<<`);
      return entry.detectedItems;
    }

    return null;
  } catch (error) {
    console.error('Failed to read image cache:', error);
    return null;
  }
};

// Store analysis result in cache
const setCachedAnalysis = (imageHash: string, screenType: string, detectedItems: DetectedItem[]): void => {
  try {
    const cacheData = localStorage.getItem(IMAGE_CACHE_KEY);
    let cache: ImageCacheEntry[] = cacheData ? JSON.parse(cacheData) : [];

    // Remove old entries (keep cache size manageable)
    const now = Date.now();
    const expiryTime = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
    cache = cache.filter(e => (now - e.timestamp) < expiryTime);

    // Add new entry
    const newEntry: ImageCacheEntry = {
      hash: imageHash,
      timestamp: now,
      screenType: screenType as any,
      detectedItems
    };

    cache.push(newEntry);

    // Keep only the 50 most recent entries to avoid storage bloat
    if (cache.length > 50) {
      cache = cache.slice(-50);
    }

    localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(cache));
    console.log(`>>> [Gemini Cache] Stored result for image hash ${imageHash} <<<`);
  } catch (error) {
    console.error('Failed to store image cache:', error);
  }
};

// Filter out items that are already in inventory to avoid duplicates
const filterNewItems = (detectedItems: DetectedItem[]): DetectedItem[] => {
  const inventory = getCategorizedInventory();
  const existingItems = new Set();

  // Build set of existing item names by category
  inventory.prime_parts.forEach(item => existingItems.add(`${item.category}:${item.name}`));
  inventory.relics.forEach(item => existingItems.add(`${item.category}:${item.name}`));
  inventory.syndicate_rewards.forEach(item => existingItems.add(`${item.category}:${item.name}`));
  inventory.mods.forEach(item => existingItems.add(`${item.category}:${item.name}`));

  const newItems = detectedItems.filter(item => {
    const itemKey = `${item.category}:${item.name}`;
    return !existingItems.has(itemKey);
  });

  if (newItems.length < detectedItems.length) {
    console.log(`>>> [Gemini Filter] Filtered ${detectedItems.length - newItems.length} duplicate items, ${newItems.length} are new <<<`);
  }

  return newItems;
};

// Clear image cache (useful if user wants to force re-analysis)
export const clearImageCache = (): void => {
  try {
    localStorage.removeItem(IMAGE_CACHE_KEY);
    console.log('>>> [Gemini Cache] Cleared image cache <<<');
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

let genAI: GoogleGenAI | null = null;

export const initializeGemini = (apiKey: string) => {
  try {
    genAI = new GoogleGenAI({apiKey: apiKey});
    return true;
  } catch (error) {
    console.error('Failed to initialize Gemini:', error);
    return false;
  }
};

export const setApiKey = (apiKey: string): boolean => {
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
    return initializeGemini(apiKey);
  } catch (error) {
    console.error('Failed to store API key:', error);
    return false;
  }
};

export const getApiKey = (): string | null => {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to retrieve API key:', error);
    return null;
  }
};

export const isGeminiConfigured = (): boolean => {
  const apiKey = getApiKey();
  if (apiKey && !genAI) {
    initializeGemini(apiKey);
  }
  return genAI !== null;
};

const fileToBase64 = (file: File): Promise<string> => {
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

const isErrorResponse = (text: string): boolean => {
  const errorIndicators = [
    'I cannot',
    'I\'m unable',
    'I can\'t see',
    'not able to see',
    'cannot see',
    'unable to view',
    'cannot view',
    'I don\'t see'
  ];

  const normalizedText = text.toLowerCase();
  return errorIndicators.some(indicator => normalizedText.includes(indicator));
};

/**
 * Parse the AI response to categorize detected items with quantity support
 */
const parseDetectedItems = (responseText: string): DetectedItem[] => {
  // Filter helper to remove generic preamble/heading lines Gemini sometimes adds
  const isPreambleOrNoteLine = (line: string): boolean => {
    const lower = line.trim().toLowerCase();

    // Headings or explanatory sentences
    if (lower.endsWith(':')) return true;
    if (/^here\s+(are|is)\b/.test(lower)) return true;
    if (/^list(ing)?\b/.test(lower)) return true;
    if (/^owned\b/.test(lower)) return true;
    if (/^(void\s+relics|prime\s+parts)\b/.test(lower)) return true;
    if (/quantit(y|ies)/.test(lower)) return true;
    if (/refinement\s+level/.test(lower)) return true;
    if (/the\s+following/.test(lower)) return true;
    if (/summary/.test(lower)) return true;

    // Known exact phrase we've seen in responses
    if (lower.includes('here are the owned void relics')) return true;

    return false;
  };

  const lines = responseText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !isPreambleOrNoteLine(line));

  const detectedItems: DetectedItem[] = [];
  let detectedSyndicate = 'Unknown';

  lines.forEach((line, index) => {
    // Check for syndicate name line: "SYNDICATE: Arbiters of Hexis"
    const syndicateMatch = line.match(/^SYNDICATE:\s*(.+)$/i);
    if (syndicateMatch) {
      detectedSyndicate = syndicateMatch[1].trim();
      console.log(`>>> [AI Parsing] Detected syndicate: "${detectedSyndicate}" <<<`);
      return; // Continue to next line
    }

    // Syndicate reward format: "ITEM_NAME | 25,000"
    const syndicateRewardMatch = line.match(/^(.*?)\s*\|\s*([\d,]+)/);
    if (syndicateRewardMatch) {
      const name = syndicateRewardMatch[1].trim();
      const standingStr = syndicateRewardMatch[2].replace(/,/g, '');
      const standingCost = parseInt(standingStr, 10);

      const reward: SyndicateReward = {
        id: `syndicate-${Date.now()}-${index}`,
        name,
        category: 'syndicate_rewards',
        syndicate: detectedSyndicate,
        standingCost: isNaN(standingCost) ? 0 : standingCost,
        itemType: 'mod' // Most syndicate items are mods; will be refined by syndicateService
      };
      detectedItems.push(reward);
      return; // Continue to next line
    }
    // Parse quantity from formats like "5 x Item Name", "x5 Item Name", "2x Item Name"
    let quantity = 1;
    let cleanLine = line;

    // Match patterns like "5 x", "x5", "2x", etc.
    const quantityMatch = line.match(/^(\d+)\s*x\s*(.+)$/i) || line.match(/^x(\d+)\s*(.+)$/i);
    if (quantityMatch) {
      quantity = parseInt(quantityMatch[1]);
      cleanLine = quantityMatch[2].trim();
      console.log(`>>> [AI Parsing] Found quantity: ${quantity}x for "${cleanLine}" <<<`);
    }

    // Check if it's a Prime part
    if (cleanLine.includes('Prime')) {
      const primeItem: PrimePart = {
        id: `prime-${Date.now()}-${index}`,
        name: cleanLine,
        category: 'prime_parts',
        quantity,
        status: 'loading'
      };
      detectedItems.push(primeItem);
    }
    // Check if it's a Void Relic
    else if (cleanLine.includes('Relic') || /\b(Lith|Meso|Neo|Axi)\s+[A-Z]\d+/.test(cleanLine)) {
      let relicName = cleanLine;
      let rarity: VoidRelic['rarity'] = 'intact'; // default

      console.log(`>>> [AI Parsing] Processing relic line: "${cleanLine}" (quantity: ${quantity}) <<<`);

          // Enhanced regex to capture the relic name and optional refinement level in parentheses OR square brackets
    // This pattern handles both formats: "Neo W2 Relic (Radiant)" and "Neo W2 Relic [Radiant]"
    const relicRegex = /(.*?)\s+[([](Intact|Exceptional|Flawless|Radiant)[)\]]/i;
      const match = cleanLine.match(relicRegex);

      console.log(`>>> [AI Parsing] Regex match result:`, match);

      if (match) {
        relicName = match[1].trim(); // Capture the name before the parentheses/brackets
        const detectedRarity = match[2].toLowerCase(); // Capture the rarity string
        console.log(`>>> [AI Parsing] Extracted name: "${relicName}", rarity: "${detectedRarity}" <<<`);

        // Ensure the captured rarity is a valid type
        if (detectedRarity === 'intact' || detectedRarity === 'exceptional' || detectedRarity === 'flawless' || detectedRarity === 'radiant') {
          rarity = detectedRarity;
        }
      } else {
        // Try alternative formats
        console.log(`>>> [AI Parsing] No regex match found, trying alternative formats <<<`);

        // Check for "Neo W2 Radiant Relic" format (rarity before "Relic")
        const alternativeRegex = /(.*?)\s+(Intact|Exceptional|Flawless|Radiant)\s+Relic/i;
        const altMatch = cleanLine.match(alternativeRegex);

        if (altMatch) {
          relicName = `${altMatch[1]} Relic`;
          const detectedRarity = altMatch[2].toLowerCase();
          console.log(`>>> [AI Parsing] Alternative format match: "${relicName}", rarity: "${detectedRarity}" <<<`);

          if (detectedRarity === 'intact' || detectedRarity === 'exceptional' || detectedRarity === 'flawless' || detectedRarity === 'radiant') {
            rarity = detectedRarity;
          }
        } else {
          console.log(`>>> [AI Parsing] No rarity detected, defaulting to intact <<<`);
        }
      }

      console.log(`>>> [AI Parsing] Final result - name: "${relicName}", rarity: "${rarity}", quantity: ${quantity} <<<`);

      const relicItem: VoidRelic = {
        id: `relic-${Date.now()}-${index}`,
        name: relicName, // Use the extracted name without rarity
        category: 'relics',
        rarity,
        quantity,
        status: 'loading'
      };
      detectedItems.push(relicItem);
    }
    // Check if it's a mod - look for common mod patterns and characteristics
    else if (cleanLine && !cleanLine.includes('Prime') && !cleanLine.includes('Relic')) {
      // Parse mod with optional rank information
      let modName = cleanLine;
      let rank: number | undefined = undefined;
      
      // Extract rank if present in format like "Serration (R8)" or "Primed Flow (R10)"
      const rankMatch = cleanLine.match(/^(.*?)\s*\(R(\d+)\)$/i);
      if (rankMatch) {
        modName = rankMatch[1].trim();
        rank = parseInt(rankMatch[2]);
        console.log(`>>> [AI Parsing] Found mod with rank: "${modName}" R${rank} <<<`);
      }
      
      const rarity = determineModRarity(modName);
      const type = determineModType(modName);
      
      const modItem: Mod = {
        id: `mod-${Date.now()}-${index}`,
        name: modName,
        category: 'mods',
        rank,
        quantity,
        rarity,
        type,
        status: 'loading'
      };
      detectedItems.push(modItem);
      console.log(`>>> [AI Parsing] Added mod: "${modName}" (${rarity} ${type}) qty:${quantity} <<<`);
    }
  });

  return detectedItems;
};

const determineScreenType = async (imageBase64: string, mimeType: string): Promise<'prime_parts' | 'relics' | 'syndicate' | 'mods' | 'unknown'> => {
  const screenTypePrompt = `Look at this Warframe screenshot and determine what type of inventory screen this is.

Respond with EXACTLY ONE of these options:
- PRIME_PARTS (if you see items with "Prime" in their names like "Sevagoth Prime Blueprint", "Mirage Prime Chassis", etc.)
- RELICS (if you see Void Relics like "Lith A1 Relic", "Meso B2 Relic", "Neo C3 Relic", "Axi D4 Relic")
- SYNDICATE (if you see a Syndicate Offerings shop with items that cost Standing values like 5,000 / 25,000 / 100,000, words like "Offerings", "Syndicate", "Sigil", or faction names like Telos, Secura, Synoid, Rakta, Sancti)
- MODS (if you see mod cards/inventory with mod names like "Serration", "Primed Flow", "Vitality", "Steel Fiber", "Condition Overload", etc. Often shows mod ranks, polarity symbols, and capacity costs)
- UNKNOWN (if you cannot clearly determine the screen type)`;

  const result = await genAI!.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: screenTypePrompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64
            }
          }
        ]
      }
    ]
  });

  const text = result.text.trim().toUpperCase();

  console.log(`>>> [Gemini Screen Type] Raw response: "${text}" <<<`);

  if (text.includes('PRIME_PARTS')) return 'prime_parts';
  if (text.includes('RELICS')) return 'relics';
  if (text.includes('SYNDICATE')) return 'syndicate';
  if (text.includes('MODS')) return 'mods';
  return 'unknown';
};

const analyzePrimeParts = async (imageBase64: string, mimeType: string): Promise<string> => {
  const primePartsPrompt = `Look at this Warframe Prime Parts inventory screenshot and read the EXACT TEXT of every Prime item you can see.

CRITICAL: You must analyze the ACTUAL IMAGE, not guess or use your memory of Warframe items.

INSTRUCTIONS:
- Read the text labels under each item icon carefully
- List ONLY items with "Prime" in their name that you can actually see in this specific image
- Include the complete name as written (e.g., "Sevagoth Prime Chassis Blueprint", "Mirage Prime Neuroptics")
- Look for quantity indicators like "x2", "x5", etc. on item icons and include them

FORMAT: List each item name exactly as written, one per line. For items with quantities, use "QUANTITY x ITEM_NAME".

If you cannot clearly see any Prime items, respond with "NONE_DETECTED".`;

  const result = await genAI!.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: primePartsPrompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64
            }
          }
        ]
      }
    ]
  });

  return result.text;
};

const analyzeRelics = async (imageBase64: string, mimeType: string): Promise<string> => {
  const relicsPrompt = `Analyze this Warframe Void Relics inventory screenshot and identify ONLY owned relics WITH THEIR QUANTITIES.

CRITICAL INSTRUCTIONS FOR RELICS - STRICT FILTERING REQUIRED:
- ONLY detect relics that are ACTUALLY OWNED AND AVAILABLE
- COMPLETELY EXCLUDE any relics that have:
  * An eye icon in the top left corner (these are unowned)
  * Semi-transparent or faded appearance
  * Grayed out or darkened icons
  * Lower brightness/contrast than fully owned items
- Focus on the RELIC ICON itself, not just the text label
- Even if the text is clear, if the relic icon looks faded or has an eye icon, EXCLUDE it
- ONLY count relics with bright, solid, fully opaque icons

VISUAL DETECTION GUIDELINES:
- Eye icon in corner = EXCLUDE (unowned relic)
- Faded/ghosted relic icon = EXCLUDE (unowned relic)
- Solid, bright relic icon = INCLUDE (owned relic)
- When in doubt, EXCLUDE the relic rather than include it

QUANTITY DETECTION:
- Look for quantity indicators like "x2", "x5", "x10" etc. overlayed on item icons
- Small numbers in the bottom-right corner of item icons indicate quantity
- Stack indicators or quantity overlays on items show multiple copies

RESPONSE FORMAT:
List each owned relic with its quantity and refinement level. Use format "QUANTITY x RELIC_NAME (REFINEMENT)" for multiple items.
For single items (quantity 1), you can omit the "1 x" prefix.

Example format:
Lith A1 Relic (Intact)
2 x Meso B2 Relic (Radiant)
5 x Neo C3 Relic (Flawless)

If you cannot clearly see any owned relics, respond with "NONE_DETECTED".`;

  const result = await genAI!.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: relicsPrompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64
            }
          }
        ]
      }
    ]
  });

  return result.text;
};

const analyzeSyndicate = async (imageBase64: string, mimeType: string): Promise<string> => {
  const syndicatePrompt = `Analyze this Warframe Syndicate Offerings screen. First identify the syndicate name from the title/header, then extract tradable rewards and their Standing costs.

STRICT RULES:
- Read the ACTUAL image. Do not invent items.
- Identify the syndicate name from the screen title (e.g., "Arbiters of Hexis", "Steel Meridian", "Cephalon Suda")
- Prefer items likely tradable on Warframe Market (e.g., Telos/Secura/Synoid/Rakta/Sancti weapons, augment mods)
- Ignore pure sigils, simulacrum access, caches, or consumable blueprints unless clearly visible and tradable
- Use the standing price numbers shown on each card (e.g., 25,000 or 100,000)

RESPONSE FORMAT:
First line: SYNDICATE: [Syndicate Name]
Then each item on its own line:
ITEM_NAME | STANDING

Example:
SYNDICATE: Arbiters of Hexis
Telos Akbolto | 100,000
Stinging Truth | 25,000

If you cannot clearly see any items or syndicate name, respond with "NONE_DETECTED".`;

  const result = await genAI!.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: syndicatePrompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64
            }
          }
        ]
      }
    ]
  });

  return result.text;
};

const analyzeMods = async (imageBase64: string, mimeType: string): Promise<string> => {
  const modsPrompt = `Analyze this Warframe mod inventory screenshot and identify ALL visible mods WITH THEIR CORRECT QUANTITIES.

CRITICAL DUPLICATE DETECTION RULES:
- DUPLICATE INDICATOR: Look for a small number in the TOP-LEFT corner of mod cards (usually white text)
- DUPLICATE ICON: Look for an icon that looks like two overlapping pieces of paper in the top-left area
- DO NOT confuse the mod drain number (top-right corner) with quantity - drain is NOT quantity!
- IGNORE LEVELED MODS: Mods with blue dots at the bottom are leveled up - do NOT count these as duplicates
- ONLY COUNT UNRANKED DUPLICATES: Focus on mods that appear to be rank 0 (no blue dots) with duplicate indicators

WHAT TO IGNORE:
- The number in the TOP-RIGHT corner (this is mod drain/capacity, NOT quantity)
- Mods with blue dots at the bottom (these are leveled up, not duplicates)
- Mods that appear to be ranked up (they have blue progression dots)

WHAT TO LOOK FOR:
- Small number in TOP-LEFT corner indicating duplicates (2, 3, 4, etc.)
- Two-paper-stack icon in top-left area indicating duplicates
- Only unranked mods (no blue dots) should be considered for duplicates
- Exact mod names as they appear

RESPONSE FORMAT:
List each mod with its correct duplicate quantity from the top-left indicator.
Use format "QUANTITY x MOD_NAME" for duplicates, single name for singles.
Do NOT include rank information unless specifically requested.

Example format:
Serration
3 x Vitality
Primed Flow
2 x Condition Overload

IMPORTANT: If you see a number in the top-right, that is MOD DRAIN, not quantity!
Only count the small number in the TOP-LEFT or the paper-stack icon as duplicate indicators.

If you cannot clearly see any mods, respond with "NONE_DETECTED".`;

  const result = await genAI!.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: modsPrompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64
            }
          }
        ]
      }
    ]
  });

  return result.text;
};

export const analyzeImage = async (imageFile: File): Promise<DetectedItem[]> => {
  if (!isGeminiConfigured()) {
    throw new Error('Gemini API key not configured');
  }

  try {
    const imageBase64 = await fileToBase64(imageFile);

    // Generate hash for caching
    const imageHash = await generateImageHash(imageBase64);

    // Check cache first to avoid redundant Gemini calls
    const cachedResult = getCachedAnalysis(imageHash);
    if (cachedResult) {
      console.log(`>>> [Gemini] Using cached analysis result - avoiding API call <<<`);
      // Still filter out duplicates in case inventory changed
      return filterNewItems(cachedResult);
    }

    // Step 1: Determine screen type
    console.log(`>>> [Gemini] Step 1: Determining screen type <<<`);
    const screenType = await determineScreenType(imageBase64, imageFile.type);
    console.log(`>>> [Gemini] Detected screen type: ${screenType} <<<`);

    // Step 2: Use appropriate analysis based on screen type
    let analysisText: string;

    if (screenType === 'prime_parts') {
      console.log(`>>> [Gemini] Step 2: Analyzing Prime Parts with focused prompt <<<`);
      analysisText = await analyzePrimeParts(imageBase64, imageFile.type);
    } else if (screenType === 'relics') {
      console.log(`>>> [Gemini] Step 2: Analyzing Relics with detailed filtering <<<`);
      analysisText = await analyzeRelics(imageBase64, imageFile.type);
    } else if (screenType === 'syndicate') {
      console.log(`>>> [Gemini] Step 2: Analyzing Syndicate Offerings <<<`);
      analysisText = await analyzeSyndicate(imageBase64, imageFile.type);
    } else if (screenType === 'mods') {
      console.log(`>>> [Gemini] Step 2: Analyzing Mods <<<`);
      analysisText = await analyzeMods(imageBase64, imageFile.type);
    } else {
      console.log(`>>> [Gemini] Unknown screen type, using generic analysis <<<`);
      analysisText = await analyzePrimeParts(imageBase64, imageFile.type); // Default to prime parts
    }

    // Debug: Log the raw AI response
    console.log(`>>> [Gemini Raw Response] <<<`);
    console.log(analysisText);
    console.log(`>>> [End Raw Response] <<<`);

    if (isErrorResponse(analysisText)) {
      console.log(`>>> [Gemini] Error response detected <<<`);
      return [];
    }

    if (analysisText.trim() === "NONE_DETECTED") {
      console.log(`>>> [Gemini] No items detected in image <<<`);
      return [];
    }

    const detectedItems = parseDetectedItems(analysisText);
    console.log(`>>> [Gemini] Parsed ${detectedItems.length} items:`, detectedItems.map(item => `${item.name} (${item.category})`), ` <<<`);

    // Cache the results for future use
    setCachedAnalysis(imageHash, screenType, detectedItems);

    // Filter out items that already exist in inventory
    const newItems = filterNewItems(detectedItems);
    console.log(`>>> [Gemini] ${newItems.length} new items after deduplication <<<`);

    return newItems;
  } catch (error) {
    console.error('Error analyzing image with Gemini:', error);
    throw new Error('Failed to analyze image. Please try again.');
  }
};