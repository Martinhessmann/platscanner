// Purpose: Handle mod duplicate analysis and market value recommendations
// Helps users decide which duplicate mods to sell for endo vs trade on Warframe Market

import { fetchBatchPriceData } from './warframeMarketService';

export interface ModItem {
  id: string;
  name: string;
  category: 'mods';
  rank?: number;
  quantity: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary' | 'primed';
  type: 'warframe' | 'weapon' | 'companion' | 'archwing' | 'stance' | 'augment' | 'other';
  price?: number;
  volume?: number;
  average?: number;
  status: 'loading' | 'loaded' | 'error';
  error?: string;
  addedAt: Date;
  lastUpdated: Date;
  // Analysis fields
  marketValue?: number;
  endoValue?: number;
  recommendation?: 'SELL_FOR_ENDO' | 'TRADE_ON_MARKET' | 'KEEP_ONE_SELL_REST' | 'KEEP_ALL';
  reasoning?: string;
  platPerEndo?: number;
}

export interface ModDuplicateAnalysis {
  totalMods: number;
  duplicates: number;
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
  
  // High-value mods should generally be kept/traded
  if (HIGH_VALUE_MODS.has(lowerName)) {
    if (mod.quantity > 1) {
      recommendation = 'KEEP_ONE_SELL_REST';
      reasoning = 'High-value mod - keep one, consider trading extras if market price is good';
    } else {
      recommendation = 'KEEP_ALL';
      reasoning = 'High-value mod - keep for builds';
    }
  }
  // Primed mods are always valuable
  else if (mod.rarity === 'primed') {
    if (mod.quantity > 1) {
      recommendation = 'KEEP_ONE_SELL_REST';
      reasoning = 'Primed mod - keep one, trade extras for good platinum';
    } else {
      recommendation = 'KEEP_ALL';
      reasoning = 'Primed mod - valuable for builds';
    }
  }
  // Check market price vs endo value
  else if (mod.price && mod.price >= marketThreshold) {
    const platPerEndo = mod.price / endoValue;
    if (platPerEndo > 0.1) { // If you get more than 0.1 plat per endo equivalent
      if (mod.quantity > 1) {
        recommendation = 'KEEP_ONE_SELL_REST';
        reasoning = `Market price (${mod.price}p) is better than endo value - keep one, trade rest`;
      } else {
        recommendation = 'TRADE_ON_MARKET';
        reasoning = `Market price (${mod.price}p) is better than endo value`;
      }
    } else {
      recommendation = 'SELL_FOR_ENDO';
      reasoning = `Market price too low compared to endo value (${endoValue} endo)`;
    }
  }
  // Augment mods might be worth checking market
  else if (mod.type === 'augment') {
    if (mod.quantity > 1) {
      recommendation = 'KEEP_ONE_SELL_REST';
      reasoning = 'Augment mod - keep one for builds, check market for extras';
    } else {
      recommendation = 'KEEP_ALL';
      reasoning = 'Augment mod - useful for specialized builds';
    }
  }
  // Default: sell for endo if low value
  else {
    recommendation = 'SELL_FOR_ENDO';
    reasoning = `Low market value - better to dissolve for ${endoValue} endo`;
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
  const itemNames = mods.map(mod => mod.name);
  
  try {
    const priceData = await fetchBatchPriceData(itemNames, onProgress);
    
    return mods.map(mod => {
      const price = priceData.get(mod.name);
      if (price) {
        return {
          ...mod,
          price: price.price,
          volume: price.volume,
          average: price.average,
          status: 'loaded' as const,
          lastUpdated: new Date()
        };
      } else {
        return {
          ...mod,
          status: 'error' as const,
          error: 'Price not found',
          lastUpdated: new Date()
        };
      }
    });
  } catch (error) {
    console.error('Failed to refresh mod prices:', error);
    return mods.map(mod => ({
      ...mod,
      status: 'error' as const,
      error: 'Failed to fetch price',
      lastUpdated: new Date()
    }));
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
    console.error('Failed to save mod inventory:', error);
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
    console.error('Failed to load mod inventory:', error);
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