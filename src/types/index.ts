import { FileWithPath } from 'react-dropzone';

export type ItemCategory = 'prime_parts' | 'relics';

export interface BaseItem {
  id: string;
  name: string;
  category: ItemCategory;
  imgUrl?: string;
  price?: number;
  ducats?: number;
  volume?: number;
  average?: number;
  status: 'loading' | 'loaded' | 'error';
  error?: string;
}

export interface PrimePart extends BaseItem {
  category: 'prime_parts';
}

export interface VoidRelic extends BaseItem {
  category: 'relics';
  rarity?: 'intact' | 'exceptional' | 'flawless' | 'radiant';
}

export type DetectedItem = PrimePart | VoidRelic;

export interface ImageState {
  id: string;
  file: FileWithPath;
  preview: string;
  status: 'queued' | 'analyzing' | 'fetching' | 'complete' | 'error';
  results: DetectedItem[];
  error?: string;
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