import {
  isLLMWhispererConfigured,
  setLLMWhispererApiKey
} from './llmWhispererService';
import { analyzeImage as analyzeImagePipeline } from './ocr/pipeline';
import {
  clearCachedAnalysis,
  clearImageCache,
  fileToBase64,
  generateImageHash,
  getCacheStats
} from './ocr/stepCache';

export const analyzeImage = analyzeImagePipeline;

export { clearCachedAnalysis, clearImageCache, fileToBase64, generateImageHash, getCacheStats };
export { buildStepSnapshotFromWhisperResult, compareSnapshotWithExpected } from './ocr/testKit';

export const isOcrConfigured = (): boolean => {
  return isLLMWhispererConfigured();
};

export const setOcrApiKey = (apiKey: string): boolean => {
  try {
    setLLMWhispererApiKey(apiKey);
    return true;
  } catch (error) {
    console.error('Failed to store OCR API key:', error);
    return false;
  }
};

export const getOcrApiKey = (): string | null => {
  try {
    return localStorage.getItem('platscanner_llmwhisperer_api_key');
  } catch (error) {
    console.error('Failed to retrieve OCR API key:', error);
    return null;
  }
};

export { isLLMWhispererConfigured, setLLMWhispererApiKey } from './llmWhispererService';
