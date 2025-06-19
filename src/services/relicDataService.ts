// Purpose: Handles Warframe Void Relic drop data using a local static JSON file.
// This provides the list of items that can drop from each relic, along with their drop chances.
// The relics.json file should be updated manually when new relics are added to the game.

import { RelicRewardItem, VoidRelic } from '../types';

// Cache for relic data
let relicsData: any[] = [];

// Hardcoded drop chances by refinement level
const DROP_CHANCES = {
  intact: {
    Common: 25.33, // 76% total (25.33% for each of 3 items)
    Uncommon: 11,  // 22% total (11% for each of 2 items)
    Rare: 2        // 2% total (for 1 item)
  },
  exceptional: {
    Common: 23.33, // 70% total (23.33% for each of 3 items)
    Uncommon: 13,  // 26% total (13% for each of 2 items)
    Rare: 4        // 4% total (for 1 item)
  },
  flawless: {
    Common: 20,    // 60% total (20% for each of 3 items)
    Uncommon: 17,  // 34% total (17% for each of 2 items)
    Rare: 6        // 6% total (for 1 item)
  },
  radiant: {
    Common: 16.67, // 50% total (16.67% for each of 3 items)
    Uncommon: 20,  // 40% total (20% for each of 2 items)
    Rare: 10       // 10% total (for 1 item)
  }
};

// Void trace costs for refinement upgrades
const REFINEMENT_COSTS = {
  'intact_to_exceptional': 25,
  'exceptional_to_flawless': 50,
  'flawless_to_radiant': 100,
  'intact_to_flawless': 75,      // 25 + 50
  'intact_to_radiant': 175,      // 25 + 50 + 100
  'exceptional_to_radiant': 150  // 50 + 100
};

// Helper type for refinement analysis
export interface RefinementAnalysis {
  currentLevel: VoidRelic['rarity'];
  targetLevel: VoidRelic['rarity'];
  voidTraceCost: number;
  currentExpectedValue: number;
  targetExpectedValue: number;
  platGain: number;
  platPerVoidTrace: number;
  roiPercentage: number;
  recommendation: 'REFINE' | 'DONT_REFINE';
}

// Load relic data from the static file
const loadRelicsData = async (): Promise<any[]> => {
  if (relicsData.length === 0) {
    try {
      console.log(`>>> [Relic Data] Loading relics from /relics.json <<<`);
      // Fetch from our local static file
      const response = await fetch('/relics.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch relics data: ${response.statusText}`);
      }

      const allItems = await response.json();
      console.log(`>>> [Relic Data] Raw JSON loaded: ${allItems.length} total items <<<`);

      // Filter for relics only (by type, not category)
      relicsData = allItems.filter((item: any) => item.type === 'Relic');

      console.log(`>>> [Relic Data] Filtered to ${relicsData.length} relics <<<`);
      console.log(`>>> [Relic Data] Sample relic names:`, relicsData.slice(0, 5).map(r => r.name));
    } catch (error) {
      console.error('>>> [Relic Data] Failed to load relics data from static file:', error);
      throw new Error('Failed to load relic drop data from static file.');
    }
  }
  return relicsData;
};

/**
 * Adjusts drop chances based on relic refinement level
 */
const adjustDropChances = (drops: RelicRewardItem[], refinementLevel: VoidRelic['rarity']): RelicRewardItem[] => {
  // Ensure refinementLevel is a valid key for DROP_CHANCES
  const validRefinement = refinementLevel && ['intact', 'exceptional', 'flawless', 'radiant'].includes(refinementLevel)
    ? refinementLevel
    : 'intact';

  const dropChances = DROP_CHANCES[validRefinement];

  console.log(`>>> [Relic Adjustment] Using ${validRefinement} drop chances: Common=${dropChances.Common}%, Uncommon=${dropChances.Uncommon}%, Rare=${dropChances.Rare}% <<<`);

  return drops.map(drop => ({
    ...drop,
    dropChance: dropChances[drop.rarity] || drop.dropChance // Use hardcoded chance or fallback to original
  }));
};

/**
 * Gets the drop data for a specific Void Relic by its name and refinement level.
 */
export const getRelicDropsByName = async (relicName: string, rarity: VoidRelic['rarity'] = 'intact'): Promise<RelicRewardItem[] | undefined> => {
  try {
    console.log(`>>> [Relic Lookup] Searching for: "${relicName}" with rarity: "${rarity}" <<<`);
    const allRelics = await loadRelicsData();

    // Convert "Lith L2 Relic" or "Neo W2 Relic [Radiant]" to "Neo W2" for base matching
    let baseRelicName = relicName.replace(/\s+Relic$/, ''); // Remove " Relic" suffix
    baseRelicName = baseRelicName.replace(/\s+(Intact|Exceptional|Flawless|Radiant)$/, ''); // Remove space-separated refinement
    baseRelicName = baseRelicName.replace(/\s+\[(Intact|Exceptional|Flawless|Radiant)\]$/, ''); // Remove bracket-enclosed refinement
    console.log(`>>> [Relic Lookup] Base name extracted: "${baseRelicName}" <<<`);

    // For base relic lookup, we'll always use the Intact version first
    const targetRelicName = `${baseRelicName} Intact`;
    console.log(`>>> [Relic Lookup] Target base relic name: "${targetRelicName}" <<<`);

    // Try to find exact match with Intact version first (for consistent base data)
    let relic = allRelics.find((r: any) => r.name === targetRelicName);
    console.log(`>>> [Relic Lookup] Exact match for "${targetRelicName}": ${relic ? 'FOUND' : 'NOT FOUND'} <<<`);

    // If not found, try the original input name as fallback
    if (!relic) {
      relic = allRelics.find((r: any) => r.name === relicName);
      console.log(`>>> [Relic Lookup] Fallback match for "${relicName}": ${relic ? 'FOUND' : 'NOT FOUND'} <<<`);
    }

    // If still not found, look for any relics that start with the base name
    if (!relic) {
      const matchingRelics = allRelics.filter((r: any) => r.name.startsWith(baseRelicName + ' '));
      console.log(`>>> [Relic Lookup] Found ${matchingRelics.length} relics matching base name "${baseRelicName}" <<<`);
      console.log(`>>> [Relic Lookup] Matching relics:`, matchingRelics.map((r: any) => r.name));

      // Use the first matching relic
      relic = matchingRelics[0];
      console.log(`>>> [Relic Lookup] Fallback selected relic: ${relic ? relic.name : 'NONE'} <<<`);
    }

    if (!relic) {
      console.warn(`>>> [Relic Lookup] No relic found for: ${relicName} (base: ${baseRelicName}) <<<`);
      console.log(`>>> [Relic Lookup] Available relics starting with same prefix:`,
        allRelics.filter((r: any) => r.name.startsWith(baseRelicName.split(' ')[0])).slice(0, 5).map((r: any) => r.name));
      return undefined;
    }

    if (!relic.rewards) {
      console.warn(`>>> [Relic Lookup] Relic found but no rewards data: ${relicName} <<<`);
      console.log(`>>> [Relic Lookup] Relic structure:`, Object.keys(relic));
      return undefined;
    }

    console.log(`>>> [Relic Lookup] Found ${relic.rewards.length} rewards for ${relicName} <<<`);
    console.log(`>>> [Relic Lookup] Selected relic name: "${relic.name}" <<<`);
    console.log(`>>> [Relic Lookup] Raw rewards data:`, relic.rewards.map((r: any) => `${r.item.name}: ${r.chance}% (${r.rarity})`));

    // Convert to our internal RelicRewardItem format with proper rarity mapping
    const baseDrops = relic.rewards.map((reward: any) => {
      // Determine rarity based on drop chance rather than label
      // In the game, there are 3 Common items (25.33%), 2 Uncommon items (11%), and 1 Rare item (2%)
      let normalizedRarity: 'Common' | 'Uncommon' | 'Rare';

      // First check the drop chance to determine actual rarity
      if (Math.abs(reward.chance - 25.33) < 0.1) {
        normalizedRarity = 'Common'; // ~25.33% items are actually Common
      } else if (Math.abs(reward.chance - 11) < 0.1) {
        normalizedRarity = 'Uncommon'; // ~11% items are actually Uncommon
      } else if (Math.abs(reward.chance - 2) < 0.1) {
        normalizedRarity = 'Rare'; // ~2% items are actually Rare
      } else {
        // Fallback to the labeled rarity if drop chance doesn't match expected values
        const rawRarity = reward.rarity.toLowerCase();
        if (rawRarity === 'rare') {
          normalizedRarity = 'Rare';
        } else if (rawRarity === 'uncommon') {
          normalizedRarity = 'Uncommon';
        } else {
          normalizedRarity = 'Common';
        }
      }

      return {
        itemName: reward.item.name,
        rarity: normalizedRarity,
        dropChance: reward.chance, // Original drop chance from JSON (will be overridden by adjustDropChances)
        warframeMarketUrlName: reward.item.warframeMarket?.urlName || '',
      };
    });

    // Log the rarities before adjustment
    console.log(`>>> [Relic Lookup] Base drops with rarities:`,
      baseDrops.map((r: any) => `${r.itemName} (${r.rarity}) - Original: ${r.dropChance}%`));

    // Apply the correct drop chances based on refinement level
    const adjustedDrops = adjustDropChances(baseDrops, rarity);

    console.log(`>>> [Relic Lookup] Adjusted drops for ${rarity}:`,
      adjustedDrops.map((r: any) => `${r.itemName} (${r.rarity}: ${r.dropChance}%) -> ${r.warframeMarketUrlName}`));

    return adjustedDrops;
  } catch (error) {
    console.error('>>> [Relic Lookup] Error getting relic drops:', error);
    return undefined;
  }
};

/**
 * Calculate expected value for a specific refinement level
 */
const calculateExpectedValueForLevel = (
  baseDrops: RelicRewardItem[],
  refinementLevel: VoidRelic['rarity'],
  priceData: any[]
): number => {
  const adjustedDrops = adjustDropChances(baseDrops, refinementLevel);

  let expectedValue = 0;
  adjustedDrops.forEach(drop => {
    const priceInfo = priceData.find(p =>
      p.name === drop.itemName ||
      p.name.toLowerCase().replace(/\s+/g, '_') === drop.itemName.toLowerCase().replace(/\s+/g, '_')
    );
    const price = priceInfo?.price || 0;
    expectedValue += price * (drop.dropChance / 100);
  });

  return parseFloat(expectedValue.toFixed(2));
};

/**
 * Comprehensive refinement analysis that evaluates all possible refinement paths
 * Returns the most efficient refinement recommendation based on plat/void trace ratio
 */
export const analyzeRefinementOpportunities = async (
  relicName: string,
  currentRarity: VoidRelic['rarity'] = 'intact',
  priceData: any[]
): Promise<{
  currentExpectedValue: number;
  refinementAnalyses: RefinementAnalysis[];
  bestRefinement: RefinementAnalysis | null;
  overallRecommendation: 'OPEN' | 'REFINE_TO_EXCEPTIONAL' | 'REFINE_TO_FLAWLESS' | 'REFINE_TO_RADIANT';
}> => {
  try {
    console.log(`>>> [Refinement Analysis] Starting comprehensive analysis for: ${relicName} (${currentRarity}) <<<`);

    const relicDrops = await getRelicDropsByName(relicName, 'intact'); // Always get base drops first
    if (!relicDrops || relicDrops.length === 0) {
      throw new Error(`No drop data found for relic: ${relicName}`);
    }

    // Calculate expected values for all refinement levels
    const expectedValues = {
      intact: calculateExpectedValueForLevel(relicDrops, 'intact', priceData),
      exceptional: calculateExpectedValueForLevel(relicDrops, 'exceptional', priceData),
      flawless: calculateExpectedValueForLevel(relicDrops, 'flawless', priceData),
      radiant: calculateExpectedValueForLevel(relicDrops, 'radiant', priceData)
    };

    console.log(`>>> [Refinement Analysis] Expected values:`, expectedValues);

    const effectiveRarity = currentRarity || 'intact';
    const currentExpectedValue = expectedValues[effectiveRarity];
    const refinementAnalyses: RefinementAnalysis[] = [];

    // Define possible refinement paths based on current level
    const possibleRefinements: Array<{
      target: 'exceptional' | 'flawless' | 'radiant';
      costKey: keyof typeof REFINEMENT_COSTS;
    }> = [];

    switch (effectiveRarity) {
      case 'intact':
        possibleRefinements.push(
          { target: 'exceptional', costKey: 'intact_to_exceptional' },
          { target: 'flawless', costKey: 'intact_to_flawless' },
          { target: 'radiant', costKey: 'intact_to_radiant' }
        );
        break;
      case 'exceptional':
        possibleRefinements.push(
          { target: 'flawless', costKey: 'exceptional_to_flawless' },
          { target: 'radiant', costKey: 'exceptional_to_radiant' }
        );
        break;
      case 'flawless':
        possibleRefinements.push(
          { target: 'radiant', costKey: 'flawless_to_radiant' }
        );
        break;
      case 'radiant':
        // Already at max level
        break;
    }

    // Analyze each possible refinement path
    for (const refinement of possibleRefinements) {
      const voidTraceCost = REFINEMENT_COSTS[refinement.costKey];
      const targetExpectedValue = expectedValues[refinement.target];
      const platGain = targetExpectedValue - currentExpectedValue;
      const platPerVoidTrace = platGain / voidTraceCost;
      const roiPercentage = (platGain / voidTraceCost) * 100;

      const analysis: RefinementAnalysis = {
        currentLevel: effectiveRarity,
        targetLevel: refinement.target,
        voidTraceCost,
        currentExpectedValue,
        targetExpectedValue,
        platGain,
        platPerVoidTrace,
        roiPercentage,
        recommendation: platPerVoidTrace > 0.05 ? 'REFINE' : 'DONT_REFINE' // Threshold: 5p per 100 void traces
      };

      refinementAnalyses.push(analysis);

      console.log(`>>> [Refinement Analysis] ${effectiveRarity} → ${refinement.target}: +${platGain.toFixed(2)}p for ${voidTraceCost} traces (${platPerVoidTrace.toFixed(3)} p/trace, ${roiPercentage.toFixed(1)}% ROI) <<<`);
    }

    // Find the best refinement option (highest plat per void trace ratio)
    const viableRefinements = refinementAnalyses.filter(a => a.recommendation === 'REFINE');
    const bestRefinement = viableRefinements.length > 0
      ? viableRefinements.reduce((best, current) =>
          current.platPerVoidTrace > best.platPerVoidTrace ? current : best
        )
      : null;

    // Determine overall recommendation
    let overallRecommendation: 'OPEN' | 'REFINE_TO_EXCEPTIONAL' | 'REFINE_TO_FLAWLESS' | 'REFINE_TO_RADIANT' = 'OPEN';

    if (bestRefinement) {
      switch (bestRefinement.targetLevel) {
        case 'exceptional':
          overallRecommendation = 'REFINE_TO_EXCEPTIONAL';
          break;
        case 'flawless':
          overallRecommendation = 'REFINE_TO_FLAWLESS';
          break;
        case 'radiant':
          overallRecommendation = 'REFINE_TO_RADIANT';
          break;
      }
    }

    console.log(`>>> [Refinement Analysis] Best option: ${overallRecommendation}${bestRefinement ? ` (+${bestRefinement.platGain.toFixed(2)}p for ${bestRefinement.voidTraceCost} traces)` : ''} <<<`);

    return {
      currentExpectedValue,
      refinementAnalyses,
      bestRefinement,
      overallRecommendation
    };

  } catch (error) {
    console.error('>>> [Refinement Analysis] Error:', error);
    throw error;
  }
};

/**
 * NEW: Optimal Refinement Analysis with Market Price Comparison
 *
 * This improved approach:
 * 1. Finds the optimal refinement level based on expected drop value
 * 2. Calculates the investment needed to reach that optimal level
 * 3. Fetches market prices for the optimal refinement level relic (with fallbacks)
 * 4. Compares optimal expected value vs optimal market price
 * 5. Uses real market data instead of arbitrary thresholds
 */
export const analyzeOptimalRefinementStrategy = async (
  relicName: string,
  currentRarity: VoidRelic['rarity'] = 'intact',
  dropPriceData: any[]
): Promise<{
  currentExpectedValue: number;
  optimalRefinementLevel: VoidRelic['rarity'];
  optimalExpectedValue: number;
  investmentCost: number;
  optimalMarketPrice: number;
  optimalMarketPriceFallback?: string; // Which price level was used
  platPerVoidTrace: number;
  recommendation: 'OPEN' | 'SELL' | 'REFINE_TO_EXCEPTIONAL' | 'REFINE_TO_FLAWLESS' | 'REFINE_TO_RADIANT';
  expectedProfit: number;
  analysis: {
    comparison: string;
    reasoning: string;
  };
}> => {
  try {
    console.log(`>>> [Optimal Refinement] Starting analysis for: ${relicName} (${currentRarity}) <<<`);

    const relicDrops = await getRelicDropsByName(relicName, 'intact');
    if (!relicDrops || relicDrops.length === 0) {
      throw new Error(`No drop data found for relic: ${relicName}`);
    }

    // Calculate expected values for all refinement levels
    const expectedValues = {
      intact: calculateExpectedValueForLevel(relicDrops, 'intact', dropPriceData),
      exceptional: calculateExpectedValueForLevel(relicDrops, 'exceptional', dropPriceData),
      flawless: calculateExpectedValueForLevel(relicDrops, 'flawless', dropPriceData),
      radiant: calculateExpectedValueForLevel(relicDrops, 'radiant', dropPriceData)
    };

    console.log(`>>> [Optimal Refinement] Expected values:`, expectedValues);

        // Find the optimal refinement level (highest expected value)
    const optimalRefinementLevel = Object.entries(expectedValues).reduce((best, [level, value]) =>
      value > expectedValues[best] ? level as VoidRelic['rarity'] : best
    , 'intact' as VoidRelic['rarity']);

    const effectiveCurrentRarity = (currentRarity && ['intact', 'exceptional', 'flawless', 'radiant'].includes(currentRarity)) ? currentRarity : 'intact';
    const currentExpectedValue = expectedValues[effectiveCurrentRarity];
    const optimalExpectedValue = expectedValues[optimalRefinementLevel || 'intact'];

    console.log(`>>> [Optimal Refinement] Optimal level: ${optimalRefinementLevel} (${optimalExpectedValue}p) vs current: ${currentRarity} (${currentExpectedValue}p) <<<`);

    // Calculate investment cost to reach optimal level
    let investmentCost = 0;
    let costKey: keyof typeof REFINEMENT_COSTS | null = null;

    if (effectiveCurrentRarity === optimalRefinementLevel) {
      // Already at optimal level
      investmentCost = 0;
    } else {
      // Calculate cost from current to optimal
      const refinementPath = `${effectiveCurrentRarity}_to_${optimalRefinementLevel}` as keyof typeof REFINEMENT_COSTS;
      if (REFINEMENT_COSTS[refinementPath]) {
        investmentCost = REFINEMENT_COSTS[refinementPath];
        costKey = refinementPath;
      } else {
        console.warn(`>>> [Optimal Refinement] No direct path from ${currentRarity} to ${optimalRefinementLevel} <<<`);
        investmentCost = 0; // Fallback - shouldn't happen with current data
      }
    }

    // Fetch market price for the optimal refinement level relic with fallback logic
    let optimalMarketPrice = 0;
    let optimalMarketPriceFallback = 'none';

    const { fetchSinglePriceOnly } = await import('./warframeMarketService');

    // Try to get market price for optimal refinement level
    const refinementLevels: VoidRelic['rarity'][] = ['radiant', 'flawless', 'exceptional', 'intact'];
    const optimalIndex = refinementLevels.indexOf(optimalRefinementLevel);

    for (let i = optimalIndex; i < refinementLevels.length; i++) {
      const level = refinementLevels[i];
      if (!level) continue; // Skip if level is undefined
      const levelName = level.charAt(0).toUpperCase() + level.slice(1);
      const marketRelicName = `${relicName} [${levelName}]`;

      try {
        console.log(`>>> [Optimal Refinement] Trying market price for: ${marketRelicName} <<<`);
        const marketData = await fetchSinglePriceOnly({
          id: 'temp',
          name: marketRelicName,
          category: 'relics',
          status: 'loading'
        });

        if (marketData.price && marketData.price > 0) {
          optimalMarketPrice = marketData.price;
          optimalMarketPriceFallback = level === optimalRefinementLevel ? 'exact' : `fallback_${level}`;
          console.log(`>>> [Optimal Refinement] Found market price: ${optimalMarketPrice}p for ${marketRelicName} (${optimalMarketPriceFallback}) <<<`);
          break;
        }
      } catch (error) {
        console.log(`>>> [Optimal Refinement] No market data for ${marketRelicName}, trying lower refinement <<<`);
        continue;
      }
    }

    if (optimalMarketPrice === 0) {
      console.log(`>>> [Optimal Refinement] No market data found for any refinement level, using 0p <<<`);
    }

    // Calculate plat per void trace efficiency
    const platPerVoidTrace = investmentCost > 0 ? (optimalExpectedValue - currentExpectedValue) / investmentCost : 0;

    // Make recommendation based on optimal comparison
    let recommendation: 'OPEN' | 'SELL' | 'REFINE_TO_EXCEPTIONAL' | 'REFINE_TO_FLAWLESS' | 'REFINE_TO_RADIANT';
    let expectedProfit: number;
    let analysis: { comparison: string; reasoning: string };

    // Compare: should we refine to optimal and open, or sell at optimal market price, or open current?
    const refinementGain = optimalExpectedValue - currentExpectedValue;
    const sellingProfit = optimalMarketPrice - optimalExpectedValue;
    const currentOpeningProfit = currentExpectedValue - optimalMarketPrice;

    if (investmentCost === 0) {
      // Already at optimal level, compare opening vs selling
      if (optimalMarketPrice > optimalExpectedValue) {
        recommendation = 'SELL';
        expectedProfit = sellingProfit;
        analysis = {
          comparison: `Market: ${optimalMarketPrice}p vs Opening: ${optimalExpectedValue}p`,
          reasoning: `Selling intact relic is more profitable (+${sellingProfit.toFixed(2)}p)`
        };
      } else {
        recommendation = 'OPEN';
        expectedProfit = -sellingProfit;
        analysis = {
          comparison: `Opening: ${optimalExpectedValue}p vs Market: ${optimalMarketPrice}p`,
          reasoning: `Opening relic is more profitable (+${(-sellingProfit).toFixed(2)}p)`
        };
      }
    } else {
      // Need to invest void traces - compare all options
      const investmentEfficiency = refinementGain / investmentCost;

      if (optimalMarketPrice > optimalExpectedValue && optimalMarketPrice > currentExpectedValue) {
        // Selling optimal refined relic is best
        recommendation = optimalRefinementLevel === 'exceptional' ? 'REFINE_TO_EXCEPTIONAL' :
                        optimalRefinementLevel === 'flawless' ? 'REFINE_TO_FLAWLESS' : 'REFINE_TO_RADIANT';
        expectedProfit = (optimalMarketPrice - currentExpectedValue) - investmentCost * 0.01; // Rough void trace cost
        analysis = {
          comparison: `Refine & Sell: ${optimalMarketPrice}p vs Current Open: ${currentExpectedValue}p`,
          reasoning: `Refining to ${optimalRefinementLevel} and selling is most profitable (+${expectedProfit.toFixed(2)}p net)`
        };
      } else if (refinementGain > investmentCost * 0.01) { // If refinement gain > rough void trace cost
        // Refining to optimal and opening is best
        recommendation = optimalRefinementLevel === 'exceptional' ? 'REFINE_TO_EXCEPTIONAL' :
                        optimalRefinementLevel === 'flawless' ? 'REFINE_TO_FLAWLESS' : 'REFINE_TO_RADIANT';
        expectedProfit = refinementGain - investmentCost * 0.01; // Rough void trace cost
        analysis = {
          comparison: `Refine & Open: ${optimalExpectedValue}p vs Current: ${currentExpectedValue}p (Cost: ${investmentCost} traces)`,
          reasoning: `Refining to ${optimalRefinementLevel} for opening is worth it (+${expectedProfit.toFixed(2)}p net, ${platPerVoidTrace.toFixed(3)}p/trace)`
        };
      } else {
        // Opening current level is best
        recommendation = 'OPEN';
        expectedProfit = currentExpectedValue - optimalMarketPrice;
        analysis = {
          comparison: `Current Open: ${currentExpectedValue}p vs Refinement Cost: ${investmentCost} traces`,
          reasoning: `Refinement investment not worth it, open current level`
        };
      }
    }

    console.log(`>>> [Optimal Refinement] Final recommendation: ${recommendation} (+${expectedProfit.toFixed(2)}p) <<<`);
    console.log(`>>> [Optimal Refinement] Analysis: ${analysis.reasoning} <<<`);

    return {
      currentExpectedValue,
      optimalRefinementLevel,
      optimalExpectedValue,
      investmentCost,
      optimalMarketPrice,
      optimalMarketPriceFallback,
      platPerVoidTrace,
      recommendation,
      expectedProfit,
      analysis
    };

  } catch (error) {
    console.error('>>> [Optimal Refinement] Error:', error);
    throw error;
  }
};