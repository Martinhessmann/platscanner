import { DetectedItem } from '../../types';
import { ocrLogger } from '../ocrLogger';
import { OcrScreenType } from './stepScreenType';

const IMAGE_CACHE_KEY = 'platscanner_image_cache';
const CACHE_EXPIRY_HOURS = 24;
const IMAGE_CACHE_VERSION = 2;

interface ImageCacheEntry {
  version: number;
  hash: string;
  timestamp: number;
  screenType: OcrScreenType;
  detectedItems: DetectedItem[];
}

export const generateImageHash = async (imageBase64: string): Promise<string> => {
  try {
    ocrLogger.debug('Hash', 'Generating image hash');
    const sample = imageBase64.substring(0, 1000);
    const encoder = new TextEncoder();
    const data = encoder.encode(sample);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    ocrLogger.debug('Hash', `Generated hash: ${hash}`);
    return hash;
  } catch (error) {
    ocrLogger.error('Hash', 'Failed to generate image hash', { error: String(error) });
    throw error;
  }
};

export const getCachedAnalysis = (imageHash: string): DetectedItem[] | null => {
  try {
    const cacheData = localStorage.getItem(IMAGE_CACHE_KEY);
    if (!cacheData) return null;

    const cache: ImageCacheEntry[] = JSON.parse(cacheData);
    const now = Date.now();
    const expiryTime = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;

    const validCache = cache.filter(
      (item) => item.version === IMAGE_CACHE_VERSION && now - item.timestamp < expiryTime
    );

    if (validCache.length !== cache.length) {
      localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(validCache));
    }

    const entry = validCache.find((item) => item.hash === imageHash);

    if (entry) {
      ocrLogger.info('Cache', `Found cached result for image hash ${imageHash}`);
      return entry.detectedItems;
    }

    return null;
  } catch (error) {
    ocrLogger.error('Cache', 'Failed to read image cache', { error: String(error) });
    return null;
  }
};

export const clearCachedAnalysis = (imageHash: string): void => {
  try {
    const stored = localStorage.getItem(IMAGE_CACHE_KEY);
    if (!stored) return;

    const cache: ImageCacheEntry[] = JSON.parse(stored);
    const filteredCache = cache.filter((entry) => entry.hash !== imageHash);
    localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(filteredCache));

    ocrLogger.info('Cache', `Cleared cached result for image hash ${imageHash}`);
  } catch (error) {
    ocrLogger.error('Cache', 'Failed to clear image cache', { error: String(error) });
  }
};

export const setCachedAnalysis = (
  imageHash: string,
  screenType: OcrScreenType,
  detectedItems: DetectedItem[]
): void => {
  try {
    const cacheData = localStorage.getItem(IMAGE_CACHE_KEY);
    let cache: ImageCacheEntry[] = cacheData ? JSON.parse(cacheData) : [];

    const now = Date.now();
    const expiryTime = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
    cache = cache.filter((entry) => now - entry.timestamp < expiryTime);

    const newEntry: ImageCacheEntry = {
      version: IMAGE_CACHE_VERSION,
      hash: imageHash,
      timestamp: now,
      screenType,
      detectedItems
    };

    cache.push(newEntry);
    if (cache.length > 50) {
      cache = cache.slice(-50);
    }

    localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(cache));
    ocrLogger.info('Cache', `Stored result for image hash ${imageHash}`);
  } catch (error) {
    ocrLogger.error('Cache', 'Failed to store image cache', { error: String(error) });
  }
};

export const clearImageCache = (): void => {
  try {
    localStorage.removeItem(IMAGE_CACHE_KEY);
    ocrLogger.info('Cache', 'Cleared image cache');
  } catch (error) {
    ocrLogger.error('Cache', 'Failed to clear image cache', { error: String(error) });
  }
};

export const getCacheStats = (): { entries: number; oldestEntry?: Date; newestEntry?: Date } => {
  try {
    const cacheData = localStorage.getItem(IMAGE_CACHE_KEY);
    if (!cacheData) return { entries: 0 };

    const cache: ImageCacheEntry[] = JSON.parse(cacheData);
    if (cache.length === 0) return { entries: 0 };

    const timestamps = cache.map((entry) => entry.timestamp).sort();
    return {
      entries: cache.length,
      oldestEntry: new Date(timestamps[0]),
      newestEntry: new Date(timestamps[timestamps.length - 1])
    };
  } catch (error) {
    ocrLogger.error('Cache', 'Failed to get cache stats', { error: String(error) });
    return { entries: 0 };
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    ocrLogger.debug('FileConversion', `Converting file to base64: ${file.name}`);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      try {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        ocrLogger.debug('FileConversion', `File converted successfully, base64 length: ${base64.length}`);
        resolve(base64);
      } catch (error) {
        ocrLogger.error('FileConversion', 'Failed to extract base64 from data URL', { error: String(error) });
        reject(error);
      }
    };
    reader.onerror = (error) => {
      ocrLogger.error('FileConversion', 'FileReader error', { error: error.toString() });
      reject(error);
    };
  });
};
