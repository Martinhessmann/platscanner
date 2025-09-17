import { FileWithPath } from 'react-dropzone';

export type ItemCategory = 'prime_parts' | 'relics' | 'syndicate_rewards' | 'mods';

export interface BaseItem {
  id: string;
  name: string;
  category: ItemCategory;
  quantity?: number; // Number of this item owned (default: 1)
  imgUrl?: string;
  price?: number;
  ducats?: number;
  volume?: number;
  average?: number;
  status: 'loading' | 'loaded' | 'error';
  error?: string;
  // Buyer information for whisper message generation
  buyerUsername?: string | null;
  buyerQuantity?: number;
  // NEW: Distinguish between inventory items and truly owned items
  isOwned?: boolean; // true = user wants to keep this item, false/undefined = can be sold
}

export interface PrimePart extends BaseItem {
  category: 'prime_parts';
}

export interface VoidRelic extends BaseItem {
  category: 'relics';
  rarity?: 'intact' | 'exceptional' | 'flawless' | 'radiant';
  relicDrops?: RelicRewardItem[];
  minDropValue?: number;
  maxDropValue?: number;
  expectedDropValue?: number;
  directSalePrice?: number;
  recommendation?: 'OPEN' | 'SELL' | 'REFINE_TO_EXCEPTIONAL' | 'REFINE_TO_FLAWLESS' | 'REFINE_TO_RADIANT';
  expectedProfit?: number;
  // Enhanced refinement analysis fields
  refinementAnalysis?: {
    platPerVoidTrace?: number;
    bestRefinementTarget?: 'exceptional' | 'flawless' | 'radiant';
    bestRefinementCost?: number;
    bestRefinementGain?: number;
    // New optimal analysis fields
    optimalMarketPrice?: number;
    optimalMarketPriceFallback?: string; // 'exact', 'fallback_flawless', etc.
    reasoning?: string; // Human-readable explanation
    comparison?: string; // Comparison details
  };
}

export interface SyndicateReward extends BaseItem {
  category: 'syndicate_rewards';
  syndicate: string;
  standingCost: number;
  masteryRank?: number;
  itemType: 'weapon' | 'mod' | 'cosmetic' | 'resource' | 'other';
  platPerStanding?: number;
  marketVolume?: number;
  availability?: 'always' | 'rotation' | 'limited';
}

export interface Mod extends DetectedItem {
  rank?: number;
  drain?: number; // Mod capacity/drain cost
  rarity: string;
  type: string;
  endoValue?: number;
  recommendation?: 'SELL_FOR_ENDO' | 'TRADE_ON_MARKET' | 'KEEP' | 'HOLD' | 'HOLD_FOR_LATER';
  reasoning?: string;
  platPerEndo?: number;
  imgUrl?: string;
  hasHistoricalSales?: boolean;
  average?: number; // Historical average price from market data
}

export type DetectedItem = PrimePart | VoidRelic | SyndicateReward | Mod;

export interface ImageState {
  id: string;
  file: FileWithPath;
  preview: string;
  status: 'queued' | 'analyzing' | 'analyzed' | 'fetching' | 'complete' | 'error';
  results: DetectedItem[];
  syndicateRewards?: SyndicateReward[]; // Track syndicate rewards for price fetching
  error?: string;
  wasCached?: boolean; // Track if this image used cached Gemini results
  screenType?: 'prime_parts' | 'relics' | 'syndicate' | 'mods' | 'unknown'; // Track detected screen type
}

export interface ProcessingState {
  activeImageId: string | null;
  images: Map<string, ImageState>;
  combinedResults: Map<string, DetectedItem>;
  processedCount: number;
  totalCount: number;
}

export interface WarframeMarketOrder {
  id: string;
  platinum: number;
  quantity: number;
  order_type: 'sell' | 'buy';
  visible: boolean;
  creation_date: string;
  user: {
    status: string;
    ingame_name: string;
    banned: boolean;
  };
}

export interface WarframeMarketItem {
  id: string;
  url_name: string;
  thumb: string;
  item_name: string;
  ducats?: number;
}

export interface WarframeMarketResponse {
  payload: {
    orders: WarframeMarketOrder[];
    item?: WarframeMarketItem;
  };
}

export interface RelicRewardItem {
  itemName: string;
  rarity: 'Common' | 'Uncommon' | 'Rare';
  dropChance: number;
  warframeMarketUrlName: string;
  currentPrice?: number;
}