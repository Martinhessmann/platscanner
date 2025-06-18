import { GoogleGenerativeAI } from '@google/generative-ai';
import { DetectedItem, PrimePart, VoidRelic } from '../types';

const API_KEY_STORAGE_KEY = 'platscanner_gemini_api_key';

let genAI: GoogleGenerativeAI | null = null;

export const initializeGemini = (apiKey: string) => {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
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
 * Parse the AI response to categorize detected items
 */
const parseDetectedItems = (responseText: string): DetectedItem[] => {
  const lines = responseText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const detectedItems: DetectedItem[] = [];

  lines.forEach((line, index) => {
    // Check if it's a Prime part
    if (line.includes('Prime')) {
      const primeItem: PrimePart = {
        id: `prime-${Date.now()}-${index}`,
        name: line,
        category: 'prime_parts',
        status: 'loading'
      };
      detectedItems.push(primeItem);
    }
    // Check if it's a Void Relic
    else if (line.includes('Relic') || /\b(Lith|Meso|Neo|Axi)\s+[A-Z]\d+/.test(line)) {
      let relicName = line;
      let rarity: VoidRelic['rarity'] = 'intact'; // default

      // Regex to capture the relic name and optional refinement level in parentheses
      const relicRegex = /(.*) \((Intact|Exceptional|Flawless|Radiant)\)/;
      const match = line.match(relicRegex);

      if (match) {
        relicName = match[1].trim(); // Capture the name before the parentheses
        const detectedRarity = match[2].toLowerCase(); // Capture the rarity string
        // Ensure the captured rarity is a valid type
        if (detectedRarity === 'intact' || detectedRarity === 'exceptional' || detectedRarity === 'flawless' || detectedRarity === 'radiant') {
          rarity = detectedRarity;
        }
      }
      // If no match, relicName remains the original line, and rarity remains 'intact' (default)

      const relicItem: VoidRelic = {
        id: `relic-${Date.now()}-${index}`,
        name: relicName, // Use the extracted name without rarity
        category: 'relics',
        rarity,
        status: 'loading'
      };
      detectedItems.push(relicItem);
    }
  });

  return detectedItems;
};

export const analyzeImage = async (imageFile: File): Promise<DetectedItem[]> => {
  if (!isGeminiConfigured()) {
    throw new Error('Gemini API key not configured');
  }

  try {
    const model = genAI!.getGenerativeModel({ model: "gemini-1.5-flash" });
    const imageBase64 = await fileToBase64(imageFile);

    const prompt = `
      Analyze this Warframe inventory screenshot and identify items from the following categories:

      1. PRIME PARTS: Any items with "Prime" in the name.
      2. VOID RELICS: Items that are Void Relics (Lith, Meso, Neo, Axi followed by a letter and number).

      CRITICAL INSTRUCTIONS FOR RELICS:
      - ONLY detect relics that are clearly visible, fully opaque, and NOT semi-transparent/faded. Semi-transparent or faded relics must be EXCLUDED as they represent unowned items.
      - For each detected Void Relic, if a refinement level is visible (Intact, Exceptional, Flawless, Radiant), include it in parentheses after the relic's name. If no refinement level is visible, assume 'Intact'.
      - Look for pattern: "Lith/Meso/Neo/Axi [Letter][Number] Relic" (e.g., "Lith A1 Relic", "Neo Z3 Relic").

      List each detected item on a separate line with the exact name.
      Do not include any additional text, explanations, or categories outside of the specified format.

      Example format:
      Mirage Prime Blueprint
      Kronen Prime Blade
      Lith A1 Relic (Radiant)
      Neo Z3 Relic (Intact)
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: imageFile.type,
          data: imageBase64
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();

    if (isErrorResponse(text)) {
      return [];
    }

    const detectedItems = parseDetectedItems(text);
    console.log(`Detected ${detectedItems.length} items:`, detectedItems.map(item => `${item.name} (${item.category})`));

    return detectedItems;
  } catch (error) {
    console.error('Error analyzing image with Gemini:', error);
    throw new Error('Failed to analyze image. Please try again.');
  }
};