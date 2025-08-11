import { GoogleGenAI } from '@google/genai';
import { DetectedItem, PrimePart, VoidRelic } from '../types';

const API_KEY_STORAGE_KEY = 'platscanner_gemini_api_key';

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

  lines.forEach((line, index) => {
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
  });

  return detectedItems;
};

const determineScreenType = async (imageBase64: string, mimeType: string): Promise<'prime_parts' | 'relics' | 'unknown'> => {
  const screenTypePrompt = `Look at this Warframe screenshot and determine what type of inventory screen this is.

Respond with EXACTLY ONE of these options:
- PRIME_PARTS (if you see items with "Prime" in their names like "Sevagoth Prime Blueprint", "Mirage Prime Chassis", etc.)
- RELICS (if you see Void Relics like "Lith A1 Relic", "Meso B2 Relic", "Neo C3 Relic", "Axi D4 Relic")
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

export const analyzeImage = async (imageFile: File): Promise<DetectedItem[]> => {
  if (!isGeminiConfigured()) {
    throw new Error('Gemini API key not configured');
  }

  try {
    const imageBase64 = await fileToBase64(imageFile);

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

    return detectedItems;
  } catch (error) {
    console.error('Error analyzing image with Gemini:', error);
    throw new Error('Failed to analyze image. Please try again.');
  }
};