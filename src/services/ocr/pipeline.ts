import { DetectedItem } from '../../types';
import { getCategorizedInventory } from '../inventoryService';
import { extractTextWithLLMWhisperer, isLLMWhispererConfigured } from '../llmWhispererService';
import { ocrLogger } from '../ocrLogger';
import {
  clearCachedAnalysis,
  fileToBase64,
  generateImageHash,
  getCachedAnalysis,
  setCachedAnalysis
} from './stepCache';
import { parseGenericItemsFromText } from './stepGenericItemsParser';
import { parsePrimePartsFromText } from './stepPrimePartsParser';
import { parsePrimePartsFromWhisperResult } from './stepPrimePartsWhisperParser';
import { determineScreenType, OcrScreenType } from './stepScreenType';
import { getWhisperExtractedText } from './stepTextExtraction';
import type { WhisperResult } from '../llmWhispererService';

const DEBUG_UPLOAD_PATH_PREFIX = '/debug/';

const isDebugFixtureImage = (file: File): boolean => {
  const path = (file as File & { path?: string }).path;
  return typeof path === 'string' && path.startsWith(DEBUG_UPLOAD_PATH_PREFIX);
};

const filterNewItems = (detectedItems: DetectedItem[]): DetectedItem[] => {
  const inventory = getCategorizedInventory();
  const existingItems = new Set<string>();

  inventory.prime_parts.forEach((item) => existingItems.add(`${item.category}:${item.name}`));
  inventory.relics.forEach((item) => existingItems.add(`${item.category}:${item.name}`));
  inventory.syndicate_rewards.forEach((item) => existingItems.add(`${item.category}:${item.name}`));
  inventory.mods.forEach((item) => {
    const rank = (item as any).rank ?? 0;
    const drain = (item as any).drain ?? '';
    existingItems.add(`${item.category}:${item.name}:r${rank}:d${drain}`);
  });

  const newItems = detectedItems.filter((item) => {
    let key = `${item.category}:${item.name}`;
    if (item.category === 'mods') {
      const mod = item as any;
      const rank = mod.rank ?? 0;
      const drain = mod.drain ?? '';
      key = `${item.category}:${item.name}:r${rank}:d${drain}`;
    }
    return !existingItems.has(key);
  });

  if (newItems.length < detectedItems.length) {
    ocrLogger.info('Filter', `Filtered ${detectedItems.length - newItems.length} duplicate items`, {
      kept: newItems.length
    });
  }

  return newItems;
};

const parseDetectedItemsByScreenType = (
  whisperResult: WhisperResult,
  text: string,
  screenType: OcrScreenType
): DetectedItem[] => {
  ocrLogger.debug('Parsing', 'Starting item parsing', {
    screenType,
    textLength: text.length,
    textPreview: text.substring(0, 300)
  });

  if (screenType === 'prime_parts') {
    return parsePrimePartsFromWhisperResult(whisperResult);
  }

  return parseGenericItemsFromText(text, screenType);
};

export const analyzeImage = async (
  imageFile: File,
  forceRetry: boolean = false
): Promise<{ items: DetectedItem[]; screenType: OcrScreenType; wasCached: boolean }> => {
  const analysisStartTime = Date.now();
  const isDebugImage = isDebugFixtureImage(imageFile);
  const bypassCache = forceRetry || isDebugImage;

  ocrLogger.info('Analysis', 'Starting image analysis', {
    fileName: imageFile.name,
    fileSize: imageFile.size,
    fileType: imageFile.type,
    forceRetry,
    isDebugImage,
    bypassCache
  });

  try {
    const imageBase64 = await fileToBase64(imageFile);
    const imageHash = await generateImageHash(imageBase64);

    if (!bypassCache) {
      const cachedResult = getCachedAnalysis(imageHash);
      if (cachedResult) {
        const items = filterNewItems(cachedResult);
        if (items.length > 0) {
          return { items, screenType: 'unknown', wasCached: true };
        }
      }
    } else {
      clearCachedAnalysis(imageHash);
      if (isDebugImage) {
        ocrLogger.info('Cache', 'Bypassing cache for debug upload image', {
          fileName: imageFile.name,
          imageHash
        });
      }
    }

    if (!isLLMWhispererConfigured()) {
      throw new Error('LLMWhisperer API key not configured.');
    }

    const whisperResult = await extractTextWithLLMWhisperer(imageFile);
    const extractedText = getWhisperExtractedText(whisperResult);

    ocrLogger.info('Analysis', 'OCR response fields', {
      hasExtractedText: !!whisperResult.extracted_text,
      extractedTextLength: whisperResult.extracted_text?.length || 0,
      hasText: !!whisperResult.text,
      textLength: whisperResult.text?.length || 0,
      hasResultText: !!whisperResult.result_text,
      resultTextLength: whisperResult.result_text?.length || 0
    });

    if (!extractedText.trim()) {
      ocrLogger.error('Analysis', 'OCR text missing in response', {
        topLevelKeys: Object.keys(whisperResult || {}),
        metadataKeys: whisperResult?.metadata ? Object.keys(whisperResult.metadata) : []
      });
      throw new Error('OCR extracted no text.');
    }

    const screenType = determineScreenType(extractedText);
    const detectedItems = parseDetectedItemsByScreenType(whisperResult, extractedText, screenType);

    if (!isDebugImage) {
      setCachedAnalysis(imageHash, screenType, detectedItems);
    } else {
      ocrLogger.info('Cache', 'Skipped storing OCR cache for debug upload image', {
        fileName: imageFile.name,
        imageHash
      });
    }

    const newItems = filterNewItems(detectedItems);
    const duration = Date.now() - analysisStartTime;
    ocrLogger.info('Analysis', `Completed in ${duration}ms`, {
      totalItems: detectedItems.length,
      newItems: newItems.length
    });

    return { items: newItems, screenType, wasCached: false };
  } catch (error) {
    const duration = Date.now() - analysisStartTime;
    ocrLogger.error('Analysis', 'Failed', {
      error: error instanceof Error ? error.message : String(error),
      duration
    });
    throw error;
  }
};
