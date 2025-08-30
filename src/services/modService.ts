// Purpose: Handle mod duplicate analysis and market value recommendations
// Helps users decide which duplicate mods to sell for endo vs trade on Warframe Market

import { fetchBatchPriceData } from './warframeMarketService';
import { logger } from '../utils/logger';

export interface ModItem {
  id: string;
  name: string;
  category: 'mods';
  rank?: number;
  quantity: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary' | 'primed' | 'unknown';
  type: 'warframe' | 'weapon' | 'companion' | 'archwing' | 'stance' | 'augment' | 'other';
  price?: number;
  volume?: number;
  average?: number;
  status: 'loading' | 'loaded' | 'error';
  error?: string;
  addedAt: Date;
  lastUpdated: Date;
  imgUrl?: string; // Image URL from Warframe Market
  // Analysis fields
  marketValue?: number;
  endoValue?: number;
  recommendation?: 'SELL_FOR_ENDO' | 'TRADE_ON_MARKET' | 'KEEP' | 'HOLD';
  reasoning?: string;
  platPerEndo?: number;
}

export interface ModDuplicateAnalysis {
  totalMods: number;
  duplicates: number;
  leveledMods: number;
  unrankedMods: number;
  recommendedForEndo: ModItem[];
  recommendedForMarket: ModItem[];
  keepOneSellRest: ModItem[];
  totalEndoValue: number;
  totalMarketValue: number;
  potentialPlatinum: number;
}

// Endo values for different mod rarities (approximate dissolution values)
const ENDO_VALUES: Record<string, number> = {
  'common': 15,
  'uncommon': 30,
  'rare': 75,
  'legendary': 150,
  'primed': 300 // Primed mods give significantly more endo
};

// Minimum market price thresholds for trading vs selling for endo
const MARKET_THRESHOLDS = {
  'common': 5, // If market price >= 5p, consider trading
  'uncommon': 8,
  'rare': 15,
  'legendary': 25,
  'primed': 50
};

// High-value mods that should generally be kept/traded even if duplicates
const HIGH_VALUE_MODS = new Set([
  // Primed mods
  'primed continuity',
  'primed flow',
  'primed pressure point',
  'primed point blank',
  'primed serration',
  'primed hornet strike',
  'primed pistol gambit',
  'primed target cracker',
  'primed ravage',
  'primed reach',
  'primed fury',
  'primed vigor',
  'primed heated charge',
  'primed cryo rounds',
  'primed fast hands',

  // Valuable rare mods
  'condition overload',
  'blood rush',
  'weeping wounds',
  'maiming strike',
  'argon scope',
  'bladed rounds',
  'laser sight',
  'hydraulic crosshairs',
  'narrow minded',
  'fleeting expertise',
  'blind rage',
  'transient fortitude',
  'overextended',
  'heavy caliber',
  'magnum force',
  'tainted mag',
  'corrupted charge',
  'vicious spread',
  'critical delay',
  'anemic agility',
  'frail momentum',
  'hollow point',
  'creeping bullseye',
  'critical deceleration'
]);

// Additional rare mods (golden frame) that might not be in HIGH_VALUE_MODS
const RARE_MODS = new Set([
  'adaptation',
  'sovereign outcast',
  'tranquil cleave',
  'rolling guard',
  'acolyte mods',
  'hunter munitions',
  'vigilante armaments',
  'gladiator vice',
  'sacrificial steel',
  'sacrificial pressure',
  'umbral vitality',
  'umbral intensify',
  'umbral fiber',
  'galvanized crosshairs',
  'galvanized chamber',
  'galvanized hell',
  'galvanized diffusion',
  'galvanized shot',
  'galvanized savvy'
]);

// Augment mods that are generally valuable for trading
const AUGMENT_MOD_PATTERNS = [
  'augment',
  'eternal war',
  'iron shrapnel',
  'chromatic blade',
  'peaceful provocation',
  'explosive legerdemain',
  'pool of life',
  'soul survivor',
  'regenerating molt',
  'iron vault',
  'firequake',
  'phoenix renewal'
];

// Non-tradeable mod patterns (these won't be found on Warframe Market)
const NON_TRADEABLE_MOD_PATTERNS = [
  // Stance mods - generally not tradeable
  'stance', 'wasp', 'ruin', 'royale', 'dervish', 'justice', 'revenge', 'hurricane', 'gale',
  // Common mods that aren't worth trading
  'vitality', 'redirection', 'steel fiber', 'intensify', 'stretch', 'continuity', 'flow',
  'serration', 'hornet strike', 'pressure point', 'fury', 'berserker', 'killing blow',
  // Aura mods (most aren't tradeable)
  'rifle scavenger', 'pistol scavenger', 'shotgun scavenger', 'sniper scavenger',
  'physique', 'rejuvenation', 'shield disruption', 'infested impedance',
  // Flawed mods
  'flawed'
];

/**
 * Check if a mod is tradeable on Warframe Market
 */
export const isModTradeable = (modName: string, modType: string, modRarity: string): boolean => {
  const lowerName = modName.toLowerCase();

  // Stance mods are generally not tradeable
  if (modType === 'stance') {
    return false;
  }

  // Common mods are rarely tradeable
  if (modRarity === 'common') {
    return false;
  }

  // Check against known non-tradeable patterns
  if (NON_TRADEABLE_MOD_PATTERNS.some(pattern => lowerName.includes(pattern))) {
    return false;
  }

  // Flawed mods are not tradeable
  if (lowerName.startsWith('flawed ')) {
    return false;
  }

  // Default to tradeable for uncommon+ mods
  return true;
};

/**
 * Determine mod rarity based on name patterns and known mod data
 */
export const determineModRarity = (modName: string): ModItem['rarity'] => {
  const lowerName = modName.toLowerCase();

  // Primed mods
  if (lowerName.startsWith('primed ')) {
    return 'primed';
  }

  // Legendary mods (Rivens, some special mods)
  if (lowerName.includes('riven') || lowerName.includes('legendary')) {
    return 'legendary';
  }

  // High-value rare mods
  if (HIGH_VALUE_MODS.has(lowerName)) {
    return 'rare';
  }

  // Additional rare mods (golden frame in game)
  if (RARE_MODS.has(lowerName)) {
    return 'rare';
  }

  // Augment mods are typically uncommon/rare
  if (AUGMENT_MOD_PATTERNS.some(pattern => lowerName.includes(pattern))) {
    return 'uncommon';
  }

  // Corrupted mods (typically rare)
  if (lowerName.includes('corrupted') || lowerName.includes('tainted') ||
      lowerName.includes('heavy ') || lowerName.includes('magnum ') ||
      lowerName.includes('vicious ') || lowerName.includes('anemic ') ||
      lowerName.includes('frail ') || lowerName.includes('hollow ') ||
      lowerName.includes('creeping ') || lowerName.includes('critical delay')) {
    return 'rare';
  }

  // Default to uncommon for most mods
  return 'uncommon';
};

/**
 * Determine mod type based on name patterns
 */
export const determineModType = (modName: string): ModItem['type'] => {
  const lowerName = modName.toLowerCase();

  // Stance mods
  if (lowerName.includes('stance') || lowerName.includes('combo') ||
      lowerName.includes('crushing ruin') || lowerName.includes('tempo royale') ||
      lowerName.includes('crimson dervish') || lowerName.includes('blind justice')) {
    return 'stance';
  }

  // Augment mods
  if (AUGMENT_MOD_PATTERNS.some(pattern => lowerName.includes(pattern))) {
    return 'augment';
  }

  // Companion mods
  if (lowerName.includes('companion') || lowerName.includes('sentinel') ||
      lowerName.includes('kavat') || lowerName.includes('kubrow') ||
      lowerName.includes('beast') || lowerName.includes('pack leader')) {
    return 'companion';
  }

  // Archwing mods
  if (lowerName.includes('archwing') || lowerName.includes('arch-gun') ||
      lowerName.includes('archgun') || lowerName.includes('arch-melee')) {
    return 'archwing';
  }

  // Warframe mods (ability/survivability focused)
  if (lowerName.includes('ability') || lowerName.includes('energy') ||
      lowerName.includes('health') || lowerName.includes('shield') ||
      lowerName.includes('armor') || lowerName.includes('power') ||
      lowerName.includes('duration') || lowerName.includes('efficiency') ||
      lowerName.includes('range') || lowerName.includes('strength') ||
      lowerName.includes('vitality') || lowerName.includes('redirection') ||
      lowerName.includes('steel fiber') || lowerName.includes('flow') ||
      lowerName.includes('streamline') || lowerName.includes('continuity') ||
      lowerName.includes('stretch') || lowerName.includes('intensify')) {
    return 'warframe';
  }

  // Default to weapon mods
  return 'weapon';
};

/**
 * Calculate endo value for a mod
 */
export const calculateEndoValue = (mod: ModItem): number => {
  const baseValue = ENDO_VALUES[mod.rarity] || ENDO_VALUES['uncommon'];
  // Multiply by quantity for total endo value
  return baseValue * mod.quantity;
};

/**
 * Analyze a single mod for duplicate recommendations
 */
export const analyzeModForDuplicates = (mod: ModItem): ModItem => {
  const endoValue = calculateEndoValue(mod);
  const marketThreshold = MARKET_THRESHOLDS[mod.rarity] || MARKET_THRESHOLDS['uncommon'];
  const lowerName = mod.name.toLowerCase();

  let recommendation: ModItem['recommendation'] = 'SELL_FOR_ENDO';
  let reasoning = '';

  // RULE 1: Leveled mods (R>0) are always KEEP
  if (mod.rank && mod.rank > 0) {
    recommendation = 'KEEP';
    reasoning = `Leveled mod (R${mod.rank}) - valuable investment`;
  }
  // RULE 2: High-value mods, primed mods, and augments are KEEP
  else if (HIGH_VALUE_MODS.has(lowerName) || mod.rarity === 'primed' || mod.type === 'augment') {
    recommendation = 'KEEP';
    reasoning = mod.rarity === 'primed' ? 'Primed mod - valuable for builds' :
                mod.type === 'augment' ? 'Augment mod - useful for specialized builds' :
                'High-value mod - keep for builds';
  }
  // RULE 3: Check market conditions
  else if (mod.price !== undefined && mod.price >= 0) {
    // If price is 0 but has average price (historical sales but no current buyers)
    if (mod.price === 0 && mod.average && mod.average > 0) {
      recommendation = 'HOLD';
      reasoning = `Hold for later - average price ${mod.average}p (no current buyers)`;
    }
    // If current price is good compared to endo value
    else if (mod.price >= marketThreshold) {
      const platPerEndo = mod.price / endoValue;
      if (platPerEndo > 0.1) { // If you get more than 0.1 plat per endo equivalent
        recommendation = 'TRADE_ON_MARKET';
        reasoning = `Market price (${mod.price}p) is better than endo value`;
      } else {
        recommendation = 'SELL_FOR_ENDO';
        reasoning = `Low plat/endo ratio - better to dissolve for ${endoValue} endo`;
      }
    } else {
      recommendation = 'SELL_FOR_ENDO';
      reasoning = `Price too low - dissolve for ${endoValue} endo`;
    }
  }
  // RULE 4: Default - sell for endo if no market value or low value
  else {
    recommendation = 'SELL_FOR_ENDO';
    reasoning = `No/low market value - dissolve for ${endoValue} endo`;
  }

  return {
    ...mod,
    endoValue,
    recommendation,
    reasoning,
    platPerEndo: mod.price ? mod.price / endoValue : undefined
  };
};

/**
 * Analyze all mods for duplicate management
 */
export const analyzeModDuplicates = (mods: ModItem[]): ModDuplicateAnalysis => {
  const analyzedMods = mods.map(analyzeModForDuplicates);

  const duplicates = analyzedMods.filter(mod => mod.quantity > 1);
  const leveledMods = analyzedMods.filter(mod => mod.rank && mod.rank > 0);
  const unrankedMods = analyzedMods.filter(mod => !mod.rank || mod.rank === 0);
  
  const recommendedForEndo = analyzedMods.filter(mod =>
    mod.recommendation === 'SELL_FOR_ENDO'
  );
  const recommendedForMarket = analyzedMods.filter(mod =>
    mod.recommendation === 'TRADE_ON_MARKET'
  );
  const keepOneSellRest = analyzedMods.filter(mod =>
    mod.recommendation === 'KEEP_ONE_SELL_REST'
  );

  const totalEndoValue = recommendedForEndo.reduce((sum, mod) =>
    sum + (mod.endoValue || 0), 0
  );

  const totalMarketValue = recommendedForMarket.reduce((sum, mod) =>
    sum + ((mod.price || 0) * mod.quantity), 0
  );

  const keepOneMarketValue = keepOneSellRest.reduce((sum, mod) =>
    sum + ((mod.price || 0) * (mod.quantity - 1)), 0
  );

  return {
    totalMods: analyzedMods.length,
    duplicates: duplicates.length,
    leveledMods: leveledMods.length,
    unrankedMods: unrankedMods.length,
    recommendedForEndo,
    recommendedForMarket,
    keepOneSellRest,
    totalEndoValue,
    totalMarketValue,
    potentialPlatinum: totalMarketValue + keepOneMarketValue
  };
};

/**
 * Refresh market prices for mod items
 */
export const refreshModPrices = async (
  mods: ModItem[],
  onProgress?: (current: number, total: number) => void
): Promise<ModItem[]> => {
  // Separate tradeable and non-tradeable mods
  // Also exclude ranked mods (R>0) from market fetching as they're not traded on market
  const tradeableMods = mods.filter(mod => 
    isModTradeable(mod.name, mod.type, mod.rarity) && 
    (!mod.rank || mod.rank === 0)
  );
  const nonTradeableMods = mods.filter(mod => 
    !isModTradeable(mod.name, mod.type, mod.rarity) || 
    (mod.rank && mod.rank > 0)
  );

  logger.debug('mod-service', `Processing ${mods.length} mods: ${tradeableMods.length} tradeable, ${nonTradeableMods.length} non-tradeable/ranked`);

  // Set non-tradeable and ranked mods to loaded status with 0 price
  // Ranked mods (R>0) are kept by players and not traded on market
  const nonTradeableResults = nonTradeableMods.map(mod => ({
    ...mod,
    price: 0,
    volume: 0,
    average: 0,
    imgUrl: mod.imgUrl || '/images/mod.webp', // Use existing image or fallback
    status: 'loaded' as const,
    lastUpdated: new Date(),
    error: undefined // Clear any existing error
  }));

  // Only fetch prices for tradeable mods
  if (tradeableMods.length === 0) {
    return [...nonTradeableResults];
  }

  try {
    const itemNames = tradeableMods.map(mod => mod.name);
    const priceData = await fetchBatchPriceData(itemNames, onProgress);

    const tradeableResults = tradeableMods.map(mod => {
      const priceItem = priceData.find(item => item.name === mod.name);
      console.log(`>>> [Mod Service Debug] ${mod.name}:`, {
        found: !!priceItem,
        price: priceItem?.price,
        thumb: priceItem?.thumb,
        hasThumb: !!priceItem?.thumb
      });
      if (priceItem && priceItem.price !== undefined) {
        // Use Market API rarity and type if available
        let updatedRarity = mod.rarity;
        let updatedType = mod.type;

        if (priceItem.rarity) {
          // Map market API rarity to our ModItem rarity types
          const marketRarity = priceItem.rarity.toLowerCase();
          updatedRarity = marketRarity === 'common' ? 'common' :
                         marketRarity === 'uncommon' ? 'uncommon' :
                         marketRarity === 'rare' ? 'rare' :
                         marketRarity === 'legendary' ? 'legendary' :
                         marketRarity === 'primed' ? 'primed' : 'unknown';
          logger.debug('mod-service', `Updated ${mod.name} rarity from "${mod.rarity}" to "${updatedRarity}" (Market API: "${priceItem.rarity}")`);
        }

        // Extract type from tags if available
        if (priceItem.tags && Array.isArray(priceItem.tags)) {
          const typeFromTags = priceItem.tags.find(tag =>
            ['warframe', 'weapon', 'stance', 'archwing', 'companion', 'augment'].includes(tag.toLowerCase())
          );
          if (typeFromTags) {
            updatedType = typeFromTags.toLowerCase() === 'weapon' ? 'weapon' :
                         typeFromTags.toLowerCase() === 'warframe' ? 'warframe' :
                         typeFromTags.toLowerCase() === 'stance' ? 'stance' :
                         typeFromTags.toLowerCase() === 'archwing' ? 'archwing' :
                         typeFromTags.toLowerCase() === 'companion' ? 'companion' :
                         typeFromTags.toLowerCase() === 'augment' ? 'augment' : 'other';
          }
        }

        return {
          ...mod,
          price: priceItem.price,
          volume: priceItem.volume,
          average: priceItem.average,
          rarity: updatedRarity,
          type: updatedType,
          imgUrl: priceItem.thumb ? `https://warframe.market/static/assets/${priceItem.thumb}` : '/images/mod.webp',
          status: 'loaded' as const,
          lastUpdated: new Date(),
          error: undefined // Clear any existing error
        };
      } else {
        return {
          ...mod,
          imgUrl: mod.imgUrl || '/images/mod.webp', // Provide fallback image
          status: 'error' as const,
          error: priceItem?.error || 'Price not found',
          lastUpdated: new Date()
        };
      }
    });

    return [...tradeableResults, ...nonTradeableResults];
  } catch (error) {
    logger.error('mod-service', 'Failed to refresh mod prices:', error);
    const errorResults = tradeableMods.map(mod => ({
      ...mod,
      imgUrl: mod.imgUrl || '/images/mod.webp', // Provide fallback image
      status: 'error' as const,
      error: 'Failed to fetch price',
      lastUpdated: new Date()
    }));
    return [...errorResults, ...nonTradeableResults];
  }
};

// Storage keys for mod data
const MOD_INVENTORY_KEY = 'platscanner_mod_inventory';
const MOD_LAST_REFRESH_KEY = 'platscanner_mod_last_refresh';

/**
 * Save mods to local storage
 */
export const saveModInventory = (mods: ModItem[]): void => {
  try {
    const data = {
      mods,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(MOD_INVENTORY_KEY, JSON.stringify(data));
  } catch (error) {
    logger.error('mod-service', 'Failed to save mod inventory:', error);
  }
};

/**
 * Load mods from local storage
 */
export const loadModInventory = (): ModItem[] => {
  try {
    const stored = localStorage.getItem(MOD_INVENTORY_KEY);
    if (!stored) return [];

    const data = JSON.parse(stored);
    return data.mods.map((mod: any) => ({
      ...mod,
      addedAt: new Date(mod.addedAt),
      lastUpdated: new Date(mod.lastUpdated)
    }));
  } catch (error) {
    logger.error('mod-service', 'Failed to load mod inventory:', error);
    return [];
  }
};

/**
 * Add mod to inventory
 */
export const addModToInventory = (mod: Omit<ModItem, 'id' | 'addedAt' | 'lastUpdated'>): ModItem => {
  const newMod: ModItem = {
    ...mod,
    id: `${mod.name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`,
    addedAt: new Date(),
    lastUpdated: new Date()
  };

  const currentMods = loadModInventory();

  // Check if we already have this mod
  const existingModIndex = currentMods.findIndex(m =>
    m.name.toLowerCase() === mod.name.toLowerCase() && m.rank === mod.rank
  );

  if (existingModIndex !== -1) {
    // Update quantity of existing mod
    currentMods[existingModIndex].quantity += mod.quantity;
    currentMods[existingModIndex].lastUpdated = new Date();
  } else {
    // Add new mod
    currentMods.push(newMod);
  }

  saveModInventory(currentMods);
  return newMod;
};

/**
 * Remove mod from inventory
 */
export const removeModFromInventory = (modId: string): void => {
  const currentMods = loadModInventory();
  const filteredMods = currentMods.filter(mod => mod.id !== modId);
  saveModInventory(filteredMods);
};

/**
 * Clear all mods from inventory
 */
export const clearModInventory = (): void => {
  localStorage.removeItem(MOD_INVENTORY_KEY);
  localStorage.removeItem(MOD_LAST_REFRESH_KEY);
};

/**
 * Get last refresh time for mods
 */
export const getModLastRefreshTime = (): Date | null => {
  try {
    const stored = localStorage.getItem(MOD_LAST_REFRESH_KEY);
    return stored ? new Date(stored) : null;
  } catch (error) {
    return null;
  }
};

/**
 * Set last refresh time for mods
 */
export const setModLastRefreshTime = (date: Date): void => {
  localStorage.setItem(MOD_LAST_REFRESH_KEY, date.toISOString());
};
