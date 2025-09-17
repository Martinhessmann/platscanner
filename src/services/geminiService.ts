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

    // Skip leveled mods (rank > 0) - these should not be saved to inventory
    if (item.category === 'mods') {
      const modItem = item as any;
      if (modItem.rank && modItem.rank > 0) {
        console.log(`>>> [Gemini Filter] Skipping leveled mod: ${item.name} (rank ${modItem.rank}) <<<`);
        return false;
      }
    }

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

// Test function to find optimal contrast levels for mod rank detection
export const testContrastLevelsForModDetection = async (debugImagePath: string) => {
  console.log(`>>> [Contrast Test] Starting progressive contrast test with ${debugImagePath} <<<`);

  if (!genAI) {
    console.error('>>> [Contrast Test] Gemini API not initialized <<<');
    return;
  }

  // Test much higher contrast levels to make R0 dots completely invisible
  const contrastLevels = [5.0, 8.0, 10.0, 15.0, 20.0];
  const blueBoostLevels = [2.0, 3.0, 4.0, 5.0];

  try {
    // Load the debug image as a File
    const response = await fetch(debugImagePath);
    const blob = await response.blob();
    const file = new File([blob], 'debug_mods.png', { type: 'image/png' });

    console.log(`>>> [Contrast Test] Testing ${contrastLevels.length} contrast levels with ${blueBoostLevels.length} blue boost levels <<<`);

    for (const contrast of contrastLevels) {
      for (const blueBoost of blueBoostLevels) {
        console.log(`>>> [Contrast Test] Testing contrast: ${contrast}, blue boost: ${blueBoost} <<<`);

        try {
          // Enhance image with current settings
          const enhancedBase64 = await enhanceImageContrast(file, contrast, blueBoost);

          // Save enhanced image for visual inspection (browser will show download)
          const downloadLink = document.createElement('a');
          downloadLink.href = `data:image/png;base64,${enhancedBase64}`;
          downloadLink.download = `debug_mods_c${contrast}_b${blueBoost}.png`;
          console.log(`>>> [Contrast Test] Enhanced image available for download: ${downloadLink.download} <<<`);

          // Auto-download all enhanced images for comparison
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);

          // Test with Gemini using the same API pattern as the rest of the service
          const prompt = `Analyze this Warframe mod inventory screenshot and list each mod with its rank.

CRITICAL INSTRUCTIONS for mod rank detection:
- Look at the BOTTOM of each mod card for rank dots
- BRIGHT BLUE glowing dots = leveled up ranks (COUNT THESE)
- DARK GREY/BLACK empty dots = unranked slots
- Count ONLY the bright blue filled dots (0-10)
- If ALL dots are bright blue = max rank (usually 5-10)
- If ALL dots are dark grey = rank 0

For each mod, output format:
MOD_NAME | R[RANK_NUMBER]

Example output:
Transient Fortitude | R5
Whirlwind | R0
Steel Fiber | R10`;

          const result = await genAI!.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      data: enhancedBase64,
                      mimeType: 'image/png'
                    }
                  }
                ]
              }
            ]
          });

          const analysisText = result.text;
          console.log(`>>> [Contrast Test] Contrast ${contrast}, Blue Boost ${blueBoost} Result: <<<`);
          console.log(analysisText);

          // Analyze the results for accuracy
          const hasHighRanks = /R[5-9]|R10/.test(analysisText);
          const hasR0Only = /R0/.test(analysisText) && !/R[1-9]|R10/.test(analysisText);
          const r10Count = (analysisText.match(/R10/g) || []).length;
          const r5Count = (analysisText.match(/R5/g) || []).length;
          const r0Count = (analysisText.match(/R0/g) || []).length;

          console.log(`>>> [Contrast Test] Stats - R10: ${r10Count}, R5: ${r5Count}, R0: ${r0Count}, Has high ranks: ${hasHighRanks}, All R0: ${hasR0Only} <<<`);

          // Store all results for comparison (don't stop early)
          // We want to test all combinations to find the most accurate one

        } catch (error) {
          console.error(`>>> [Contrast Test] Error testing contrast ${contrast}, blue boost ${blueBoost}:`, error);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`>>> [Contrast Test] No optimal settings found in tested range <<<`);

  } catch (error) {
    console.error(`>>> [Contrast Test] Failed to load debug image:`, error);
  }
};

const enhanceImageContrast = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Apply CSS filter: brightness(125%) saturate(300%)
      ctx.filter = 'brightness(125%) saturate(300%)';
      ctx.drawImage(img, 0, 0);

      // Convert to base64
      const dataURL = canvas.toDataURL('image/png', 1.0);
      const base64 = dataURL.split(',')[1];
      resolve(base64);
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
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
const parseDetectedItems = (responseText: string, screenType?: string): DetectedItem[] => {
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
    // CRITICAL: Only parse syndicate rewards when screenType is 'syndicate' or undefined
    // NEVER parse syndicate rewards in mod screens - this prevents confusion with mod format
    const syndicateRewardMatch = line.match(/^(.*?)\s*\|\s*([\d,]+)/);
    if (syndicateRewardMatch && screenType !== 'mods') {
      const name = syndicateRewardMatch[1].trim();
      const standingStr = syndicateRewardMatch[2].replace(/,/g, '');
      const standingCost = parseInt(standingStr, 10);

      console.log(`>>> [AI Parsing] Syndicate reward detected: "${name}" with ${standingCost} standing <<<`);

      const reward: SyndicateReward = {
        id: `syndicate-${Date.now()}-${index}`,
        name,
        category: 'syndicate_rewards',
        syndicate: detectedSyndicate,
        standingCost: isNaN(standingCost) ? 0 : standingCost,
        itemType: 'mod' // Most syndicate items are mods; will be refined by syndicateService
      };
      detectedItems.push(reward);
      console.log(`>>> [AI Parsing] Added syndicate reward: "${name}" (${detectedSyndicate}) <<<`);
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

    // CRITICAL: If we're in a syndicate screen and this line doesn't match syndicate format, skip it
    // This prevents fallback parsing from creating mod items in syndicate screens
    if (screenType === 'syndicate' && !line.includes('|')) {
      console.log(`>>> [AI Parsing] Skipping line in syndicate screen (no standing cost format): "${line}" <<<`);
      return; // Skip this line entirely
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
    // CRITICAL: Only parse mods if screen type is 'mods' or undefined (for backward compatibility)
    // NEVER parse mods in syndicate screens - syndicate rewards can be mods but they're not inventory mods!
    else if (screenType !== 'syndicate' && // Never parse mods in syndicate screens
             cleanLine &&
             !cleanLine.includes('Prime') &&
             !cleanLine.includes('Relic') &&
             !cleanLine.startsWith('*') && // Markdown bullets
             !cleanLine.startsWith('-') && // List items
             !cleanLine.includes('This mod has') && // Explanatory text
             !cleanLine.includes('blue dots') && // Explanatory text
             !cleanLine.includes('According to') && // Explanatory text
             !cleanLine.includes('Therefore') && // Explanatory text
             !cleanLine.includes('Following the same') && // Explanatory text
             !cleanLine.includes('indicating it is') && // Explanatory text
             cleanLine.length < 100 && // Reasonable mod name length (increased for new format)
             !/^[*\-\s]*\*\*/.test(cleanLine) && // Markdown bold formatting
             !/^\s*\*/.test(cleanLine) && // Lines starting with asterisks
             !/^\d+\./.test(cleanLine)) { // Numbered lists

      // Try to parse the new format: "MOD_NAME | QUANTITY | LEVEL | DRAIN"
      const newFormatMatch = cleanLine.match(/^(.*?)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)$/);
      if (newFormatMatch) {
        const modName = newFormatMatch[1].trim();
        const detectedQuantity = parseInt(newFormatMatch[2]);
        const detectedLevel = parseInt(newFormatMatch[3]);
        const detectedDrain = parseInt(newFormatMatch[4]);

        console.log(`>>> [AI Parsing] New format detected: "${modName}" qty:${detectedQuantity} level:${detectedLevel} drain:${detectedDrain} <<<`);

        const rarity = determineModRarity(modName);
        const type = determineModType(modName);

        const modItem: Mod = {
          id: `mod-${Date.now()}-${index}`,
          name: modName,
          category: 'mods',
          rank: detectedLevel > 0 ? detectedLevel : undefined,
          quantity: detectedQuantity,
          rarity,
          type,
          status: 'loading'
        };
        detectedItems.push(modItem);
        console.log(`>>> [AI Parsing] Added mod (new format): "${modName}" (${rarity} ${type}) qty:${detectedQuantity} level:${detectedLevel} <<<`);
      } else {
        // Fallback to old format parsing for backward compatibility
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
        console.log(`>>> [AI Parsing] Added mod (fallback): "${modName}" (${rarity} ${type}) qty:${quantity} rank:${rank || 'unranked'} <<<`);
      }
    }
  });

  return detectedItems;
};

const determineScreenType = async (imageBase64: string, mimeType: string): Promise<'prime_parts' | 'relics' | 'syndicate' | 'mods' | 'unknown'> => {
  const screenTypePrompt = `Look at this Warframe screenshot and determine what type of screen this is.

SIMPLE RULES:
- If you see "Syndicate Offerings" or syndicate names like "Arbiters of Hexis", "Steel Meridian", "Cephalon Suda" in the header/title area = SYNDICATE
- If you see "Prime Parts" or items with "Prime" in their names = PRIME_PARTS
- If you see "Void Relics" or items like "Lith A1", "Meso B2" = RELICS
- If you see mod cards with polarity symbols (V, D, -) and capacity costs (numbers like 4, 6, 8, 10, 12, 14, 16) = MODS
- If you see mod names but NO syndicate header = MODS (default to mods if unsure)

RESPONSE FORMAT:
Respond with EXACTLY ONE word:
- MODS
- SYNDICATE
- PRIME_PARTS
- RELICS
- UNKNOWN

IMPORTANT: If you see mod names but NO explicit syndicate header, classify as MODS. Only classify as SYNDICATE if you see the actual syndicate header.`;

  const result = await genAI!.models.generateContent({
    model: 'gemini-2.0-flash-exp',
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

  // More specific matching to avoid false positives
  if (text === 'PRIME_PARTS' || text.includes('PRIME_PARTS')) return 'prime_parts';
  if (text === 'RELICS' || text.includes('RELICS')) return 'relics';
  if (text === 'SYNDICATE' || text.includes('SYNDICATE')) return 'syndicate';
  if (text === 'MODS' || text.includes('MODS')) return 'mods';

  console.log(`>>> [Gemini Screen Type] No match found, defaulting to unknown. Raw text: "${text}" <<<`);
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
    model: 'gemini-2.0-flash-exp',
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
    model: 'gemini-2.0-flash-exp',
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
  const syndicatePrompt = `Analyze this Warframe Syndicate Offerings screen.

CRITICAL: This MUST be a Syndicate Offerings screen with syndicate header visible!

STRICT RULES:
- MUST see syndicate name in header (e.g., "Arbiters of Hexis", "Steel Meridian", "Cephalon Suda")
- MUST see standing costs (numbers like 5,000, 25,000, 100,000) on items
- If you see mod names but NO syndicate header, respond with "NONE_DETECTED"
- If you see mod names but NO standing costs, respond with "NONE_DETECTED"

RESPONSE FORMAT:
First line: SYNDICATE: [Syndicate Name]
Then each item on its own line:
ITEM_NAME | STANDING

Example:
SYNDICATE: Arbiters of Hexis
Telos Akbolto | 100,000
Stinging Truth | 25,000

If you cannot clearly see syndicate header, respond with "NONE_DETECTED"`;

  const result = await genAI!.models.generateContent({
    model: 'gemini-2.0-flash-exp',
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
  const modsPrompt = `Analyze this Warframe mod inventory screenshot and identify ALL visible mods with COMPLETE information.

CRITICAL FILTERING RULES - ONLY DETECT UNRANKED MODS:
- **ONLY** detect mods with SEMI-TRANSPARENT GREY/SILVER DOTS (unranked mods)
- **NEVER** detect mods with BRIGHT BLUE DOTS (leveled mods) - these should be completely ignored
- **NEVER** detect mods with any rank > 0 - these are not for sale

IMPORTANT: Only analyze FULLY VISIBLE and COMPLETE mod cards. Skip any mods that are:
- Cropped at screenshot edges
- Cut off at top, bottom, left, or right
- Missing any part of their card (name, corners, or rank dots)

CRITICAL DETECTION REQUIREMENTS - YOU MUST DETECT ALL FOUR ELEMENTS:

1. **MOD NAME**: The exact name as displayed on the mod card
2. **QUANTITY**: Look for a small number in the TOP-LEFT corner of mod cards (usually white text)
   - If NO number is visible in top-left corner = quantity is 1 (single copy)
   - If number is present (2, 3, 4, 12, etc.) = that is the quantity
   - NEVER use the number in the top-right corner for quantity!

3. **LEVEL**: Count ONLY the BRIGHT/GLOWING dots - DO NOT count total dots!
   - IGNORE THE TOP-RIGHT CORNER NUMBERS (that's drain, not rank!)
   - Look at the bottom edge - you'll see a row of small circular dots
   - CRITICAL: DO NOT DEFAULT TO ANY NUMBER - actually count each mod's dots individually
   - NEVER assume all mods have the same rank (like 4 or 5) - each mod is different
   - CRITICAL DISTINCTION:
     * BRIGHT/GLOWING/FILLED dots = these are "ON" (count these for rank)
     * DARK/DIM/EMPTY dots = these are "OFF" (DO NOT count these)
   - Common ranks you'll see:
     * Many mods will be rank 0 (NO bright dots at all)
     * Some mods will be rank 3, 4, or 5 (partially ranked)
     * Few mods will be rank 8, 9, or 10 (highly ranked)
   - DO NOT use 4/5 or any other default - COUNT EACH MOD INDIVIDUALLY
   - Example: If you see 10 total dots but only 3 are bright/glowing = rank 3
   - Example: If you see 5 total dots but 0 are bright/glowing = rank 0
   - Example: If you see 10 total dots and ALL 10 are bright/glowing = rank 10
   - CRITICAL FOR DUPLICATE MODS: Each individual mod card has its own rank
   - Visual cues for BRIGHT dots: they glow, they're vivid blue/cyan, they stand out
   - Visual cues for DARK dots: they're gray, black, dim, barely visible, empty circles

4. **DRAIN**: The number in the TOP-RIGHT corner (this is mod capacity/drain cost)
   - Usually appears as a number with a small arrow pointing down
   - This is NOT quantity - it's the mod's capacity cost

VISUAL DETECTION GUIDELINES:
- **TOP-LEFT CORNER**: Look for small white numbers (2, 3, 4, 12, etc.) - this is QUANTITY
- **TOP-RIGHT CORNER**: Look for numbers with arrow symbols (like "14 ↓") - this is DRAIN
- **BOTTOM DOTS - MOST CRITICAL**: Examine the bottom edge of each mod card very carefully:
  * Look for a ROW OF SMALL CIRCULAR DOTS (usually 5-10 dots per mod)
  * BRIGHT/GLOWING/FILLED dots = count these for the rank
  * DARK/DIM/EMPTY dots = ignore these (they're unfilled slots)
  * EXAMINE EACH MOD INDIVIDUALLY - don't assume all mods have the same rank pattern
  * Some mods will have ALL dots bright (max rank), others will have NO bright dots (rank 0)
  * The number of BRIGHT dots = the rank number
- **ABSENCE OF TOP-LEFT NUMBER**: If no number in top-left = quantity is 1

CRITICAL RANK DETECTION STEPS FOR EACH MOD CARD:
1. Find each individual mod card (scan left to right, top to bottom)
2. ONLY ANALYZE COMPLETE MODS: Skip any mod cards that are cropped or cut off at edges
   - If you can't see the full mod name, skip it
   - If you can't see the top corners (where quantity/drain numbers are), skip it
   - If you can't see the bottom edge (where rank dots are), skip it
   - Only analyze mods that are fully visible and complete
3. For DUPLICATE mod names: treat each card as a separate item with its own rank
4. Look at the very bottom edge of THAT SPECIFIC CARD for a row of dots
5. Count BOTH types of dots separately:
   - Count BRIGHT dots (glowing, vivid blue/cyan, stand out visually)
   - Count TOTAL dots (bright + dark combined)
6. Report as BRIGHT_DOTS/TOTAL_DOTS format
7. If you see the same mod name multiple times, report each occurrence separately

EXAMPLES OF CORRECT COUNTING:
- "I see 10 total dots, 8 are bright, 2 are dark" → 8/10
- "I see 5 total dots, all 5 are bright" → 5/5
- "I see 10 total dots, 0 are bright, all are dark" → 0/10
- "I see 8 total dots, 3 are bright, 5 are dark" → 3/8

WRONG APPROACH: "I see bright dots, so 10"
CORRECT APPROACH: "I count 8 bright dots out of 10 total dots, so 8/10"

SANITY CHECK RULES:
- Same mod name at same rank = must have same drain (e.g., both R0 Condition Overload should have same drain)
- Quantity should be 1-5 (not 17!)
- If you get impossible combinations, re-examine that specific mod card more carefully
- Higher rank = higher drain (R0 has lower drain than R10)

EXAMPLE OUTPUT FOR DUPLICATES:
Condition Overload | 1 | 0 | 15
Condition Overload | 1 | 10 | 18

NOT IMPOSSIBLE COMBINATIONS LIKE:
Condition Overload | 1 | 0 | 15
Condition Overload | 1 | 0 | 10  ← WRONG: same rank, different drain!

RESPONSE FORMAT:
Use this exact format for each mod:
"MOD_NAME | QUANTITY | RANK | DRAIN"

Where RANK is ONLY the number of BRIGHT/GLOWING dots you count at the bottom.

Examples (based on actual dot counts):
Narrow Minded | 1 | 1 | 14  (1 bright dot out of 10 total)
Vitality | 3 | 0 | 4  (0 bright dots - all dark)
Primed Flow | 1 | 5 | 16  (5 bright dots out of 10 total)
Serration | 12 | 0 | 4  (0 bright dots - all dark)
Adaptation | 1 | 8 | 10  (8 bright dots out of 10 total)
Condition Overload | 1 | 5 | 15  (5 bright dots out of 5 total - max rank)

IMPORTANT RULES:
- If no number in top-left corner = quantity is 1 (single copy)
- If you see "14 ↓" in top-right = drain is 14, NOT quantity
- Count filled blue dots at bottom for level (0 if no blue dots filled)
- Be extremely careful not to confuse drain (top-right) with quantity (top-left)
- If you see a number in the top-right, that is MOD DRAIN, not quantity!
- Only count the small number in the TOP-LEFT or the paper-stack icon as duplicate indicators.
- ONLY count mods with semi-transparent grey dots (unranked), IGNORE mods with bright blue dots (leveled).
- If you cannot clearly see any UNRANKED mods, respond with "NONE_DETECTED".

If you cannot clearly see any mods, respond with "NONE_DETECTED".`;

  const result = await genAI!.models.generateContent({
    model: 'gemini-2.0-flash-exp',
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

export const analyzeImage = async (imageFile: File): Promise<{ items: DetectedItem[]; screenType: string }> => {
  if (!isGeminiConfigured()) {
    throw new Error('Gemini API key not configured');
  }

  try {
    let imageBase64 = await fileToBase64(imageFile);

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
    let screenType = await determineScreenType(imageBase64, imageFile.type);
    console.log(`>>> [Gemini] Detected screen type: ${screenType} <<<`);

    // Step 1.5: For mod screens, enhance image contrast to better detect rank dots
    if (screenType === 'mods') {
      console.log(`>>> [Gemini] Enhancing image contrast for mod rank detection <<<`);
      try {
        imageBase64 = await enhanceImageContrast(imageFile);

        // DEBUG: Download enhanced image to verify enhancement
        const debugLink = document.createElement('a');
        debugLink.href = `data:image/png;base64,${imageBase64}`;
        debugLink.download = `enhanced_mod_image_${Date.now()}.png`;
        document.body.appendChild(debugLink);
        debugLink.click();
        document.body.removeChild(debugLink);
        console.log(`>>> [Gemini] DEBUG: Enhanced image downloaded as ${debugLink.download} <<<`);
      } catch (error) {
        console.warn(`>>> [Gemini] Contrast enhancement failed, using original image:`, error);
        // Continue with original image if enhancement fails
      }
    }

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

      // CRITICAL FALLBACK: If syndicate analysis finds nothing, try mod analysis
      if (analysisText.trim() === "NONE_DETECTED") {
        console.log(`>>> [Gemini] Syndicate analysis found nothing, falling back to mod analysis <<<`);
        analysisText = await analyzeMods(imageBase64, imageFile.type);
        screenType = 'mods'; // Update screen type for correct parsing
      }
    } else if (screenType === 'mods') {
      console.log(`>>> [Gemini] Step 2: Analyzing Mods <<<`);
      analysisText = await analyzeMods(imageBase64, imageFile.type);
    } else {
      console.log(`>>> [Gemini] Unknown screen type, using generic analysis <<<`);
      analysisText = await analyzePrimeParts(imageBase64, imageFile.type); // Default to prime parts
    }

    // Debug: Log the analysis type and first few lines of response
    console.log(`>>> [Gemini] Analysis type: ${screenType} <<<`);
    console.log(`>>> [Gemini] Analysis response preview:`, analysisText.substring(0, 200) + (analysisText.length > 200 ? '...' : ''), ` <<<`);

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

    const detectedItems = parseDetectedItems(analysisText, screenType);
    console.log(`>>> [Gemini] Screen type: ${screenType} <<<`);
    console.log(`>>> [Gemini] Parsed ${detectedItems.length} items:`, detectedItems.map(item => `${item.name} (${item.category})`), ` <<<`);

    // Debug: Check for category distribution
    const categoryCounts = detectedItems.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`>>> [Gemini] Category distribution:`, categoryCounts, ` <<<`);

    // Cache the results for future use
    setCachedAnalysis(imageHash, screenType, detectedItems);

    // Filter out items that already exist in inventory
    const newItems = filterNewItems(detectedItems);
    console.log(`>>> [Gemini] ${newItems.length} new items after deduplication <<<`);

    return { items: newItems, screenType };
  } catch (error) {
    console.error('Error analyzing image with Gemini:', error);
    throw new Error('Failed to analyze image. Please try again.');
  }
};