// Shared prime item validation utility
// Extracted to avoid circular dependencies between ocrService and llmWhispererService

import { getPrimeSetsCache } from './staticDataService';
import { ocrLogger } from './ocrLogger';

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
export const findBestPrimeMatch = (ocrText: string, threshold: number = 0.85): string | null => {
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
