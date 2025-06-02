import { FileWithPath } from 'react-dropzone';

export interface PrimePart {
  id: string;
  name: string;
  imgUrl?: string;
  price?: number;
  ducats?: number;
  volume?: number;
  average?: number;
  status: 'loading' | 'loaded' | 'error';
  error?: string;
}

export interface ImageState {
  id: string;
  file: FileWithPath;
  preview: string;
  status: 'queued' | 'analyzing' | 'fetching' | 'complete' | 'error';
  results: PrimePart[];
  error?: string;
}

export interface ProcessingState {
  activeImageId: string | null;
  images: Map<string, ImageState>;
  combinedResults: Map<string, PrimePart>;
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