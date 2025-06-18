// Purpose: Utility functions for handling relic-related operations
// Provides consistent image paths and other helper functions for void relics

import { VoidRelic } from '../types';

/**
 * Get the image path for a void relic based on its era and refinement level
 */
export const getRelicImagePath = (relicName: string, refinementLevel: VoidRelic['rarity'] = 'intact'): string => {
  // Extract era from relic name (Lith, Meso, Neo, Axi)
  const eraMatch = relicName.match(/^(Lith|Meso|Neo|Axi)/i);
  const era = eraMatch ? eraMatch[1].toLowerCase() : 'unknown';

  // Normalize refinement level
  const refinement = refinementLevel || 'intact';

  // Return the path to the appropriate image
  return `/images/relics/${era}_${refinement}.png`;
};

/**
 * Get a display name for a relic that includes its refinement level
 */
export const getRelicDisplayName = (relicName: string, refinementLevel: VoidRelic['rarity'] = 'intact'): string => {
  // If the refinement level is intact, just return the relic name
  if (refinementLevel === 'intact') {
    return relicName;
  }

  // Otherwise, append the refinement level in parentheses
  const refinementDisplay = refinementLevel.charAt(0).toUpperCase() + refinementLevel.slice(1);
  return `${relicName} (${refinementDisplay})`;
};

/**
 * Extract the base era and identifier from a relic name
 * Example: "Lith W2 Relic" -> { era: "Lith", identifier: "W2" }
 */
export const parseRelicName = (relicName: string): { era: string; identifier: string } => {
  const match = relicName.match(/^(Lith|Meso|Neo|Axi)\s+([A-Z][0-9]+)/i);

  if (match) {
    return {
      era: match[1],
      identifier: match[2]
    };
  }

  return {
    era: 'Unknown',
    identifier: 'Unknown'
  };
};