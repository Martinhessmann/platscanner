// Purpose: Utility functions for handling relic-related operations
// Provides consistent image paths and other helper functions for void relics

import { VoidRelic } from '../types';

/**
 * Get the image path for a void relic based on its era and refinement level
 */
export const getRelicImagePath = (relicName: string, refinementLevel: VoidRelic['rarity'] = 'intact'): string => {
  // Check if it's a Requiem relic
  if (relicName.includes('Requiem')) {
    // For Requiem relics, use a special Requiem image path
    // Normalize refinement level
    const refinement = refinementLevel || 'intact';
    return `/images/relics/requiem_${refinement}.png`;
  }

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
  // Check for standard relics (Lith, Meso, Neo, Axi)
  const standardMatch = relicName.match(/^(Lith|Meso|Neo|Axi)\s+([A-Z][0-9]+)/i);
  if (standardMatch) {
    return {
      era: standardMatch[1],
      identifier: standardMatch[2]
    };
  }

  // Check for Requiem relics
  const requiemMatch = relicName.match(/^Requiem\s+([I|V|X]+)/i);
  if (requiemMatch) {
    return {
      era: 'Requiem',
      identifier: requiemMatch[1]
    };
  }

  return {
    era: 'Unknown',
    identifier: 'Unknown'
  };
};