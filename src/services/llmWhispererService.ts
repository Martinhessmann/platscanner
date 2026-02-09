/**
 * LLMWhisperer OCR Service
 * Uses Unstract's LLMWhisperer API for high-quality OCR
 * Proxied through Netlify function to avoid CORS issues
 */

// Netlify function proxy endpoint
// In local dev, this can be pointed to the production URL via VITE_PROD_FUNCTIONS_URL
const PROXY_URL = (import.meta.env.VITE_PROD_FUNCTIONS_URL || '') + '/.netlify/functions/llmwhisperer';

export interface WhisperResult {
  extracted_text?: string;
  text?: string;
  result_text?: string;
  pages?: any[];
  blocks?: any[];
  metadata?: any;
}

export interface ExtractTextOptions {
  logRawResponse?: boolean;
  label?: string;
}

// Get API key from localStorage
const getStoredApiKey = (): string | null => {
  try {
    return localStorage.getItem('platscanner_llmwhisperer_api_key');
  } catch {
    return null;
  }
};

const getEnvApiKey = (): string | null => {
  const envKey = import.meta.env.VITE_LLMWHISPERER_API_KEY;
  return typeof envKey === 'string' && envKey.trim().length > 0 ? envKey.trim() : null;
};

// Effective API key: user-provided key first, fallback to env key in local dev/deploys where present.
const getApiKey = (): string | null => {
  const stored = getStoredApiKey();
  if (stored && stored.trim().length > 0) return stored.trim();
  return getEnvApiKey();
};

// Set API key in localStorage
export const setLLMWhispererApiKey = (apiKey: string): void => {
  try {
    localStorage.setItem('platscanner_llmwhisperer_api_key', apiKey);
  } catch (error) {
    console.error('Failed to save LLMWhisperer API key:', error);
  }
};

// Check if LLMWhisperer is configured
export const isLLMWhispererConfigured = (): boolean => {
  try {
    const key = getApiKey();
    const isConfigured = !!key && key.length > 10;
    console.log('[LLMWhisperer] isConfigured check:', { hasKey: !!key, keyLength: key?.length || 0, isConfigured });
    return isConfigured;
  } catch (error) {
    console.error('[LLMWhisperer] Error checking configuration:', error);
    return false;
  }
};

const parseProxyError = async (response: Response): Promise<{ message: string; raw: any }> => {
  const fallback = `LLMWhisperer API error: ${response.status}`;
  try {
    const errorData = await response.json();
    let message = errorData?.error || fallback;

    if (typeof errorData?.details === 'string') {
      try {
        const parsedDetails = JSON.parse(errorData.details);
        if (parsedDetails?.message) {
          message = parsedDetails.message;
        }
      } catch {
        // Keep original message if details is not JSON
      }
    }

    return { message, raw: errorData };
  } catch {
    return { message: fallback, raw: null };
  }
};

const requestWhisper = async (apiKey: string, arrayBuffer: ArrayBuffer): Promise<Response> => {
  return fetch(`${PROXY_URL}?action=whisper`, {
    method: 'POST',
    headers: {
      'X-LLMWhisperer-Key': apiKey,
      'Content-Type': 'application/octet-stream',
    },
    body: arrayBuffer,
  });
};

// Extract text from image using LLMWhisperer (via Netlify proxy)
export const extractTextWithLLMWhisperer = async (
  imageFile: File,
  options: ExtractTextOptions = {}
): Promise<WhisperResult> => {
  const { logRawResponse = true, label } = options;
  console.log('[LLMWhisperer] extractTextWithLLMWhisperer called', label ? { label } : undefined);
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[LLMWhisperer] No API key found!');
    throw new Error('LLMWhisperer API key not configured');
  }

  console.log('[LLMWhisperer] Starting OCR for:', imageFile.name, `(${imageFile.size} bytes)`);

  // Get file as ArrayBuffer
  const arrayBuffer = await imageFile.arrayBuffer();

  // Call LLMWhisperer via Netlify proxy
  let effectiveApiKey = apiKey;
  let response = await requestWhisper(effectiveApiKey, arrayBuffer);

  // If user-stored key fails with 401, retry once with env fallback key (when available).
  if (response.status === 401) {
    const fallbackKey = getEnvApiKey();
    if (fallbackKey && fallbackKey !== effectiveApiKey) {
      console.warn('[LLMWhisperer] Stored key returned 401. Retrying with environment fallback key.');
      effectiveApiKey = fallbackKey;
      response = await requestWhisper(effectiveApiKey, arrayBuffer);
    }
  }

  if (!response.ok) {
    const parsed = await parseProxyError(response);
    console.error('[LLMWhisperer] API error:', response.status, parsed.raw);

    if (response.status === 401) {
      throw new Error('LLMWhisperer authentication failed (401): API key is invalid or expired. Open API Settings and update your key.');
    }

    throw new Error(`LLMWhisperer API error (${response.status}): ${parsed.message}`);
  }

  const result = await response.json();

  if (result.status === 'processing' || result.whisper_hash) {
    // Need to poll for result (async processing)
    console.log('[LLMWhisperer] Processing, whisper hash:', result.whisper_hash);
    return await pollForResult(effectiveApiKey, result.whisper_hash, 30, logRawResponse);
  }

  if (logRawResponse) {
    console.log(`>>> [LLMWhisperer RAW JSON] >>>`);
    console.log(JSON.stringify(result, null, 2));
    console.log(`<<< [LLMWhisperer RAW JSON] <<<`);
  }

  return result;
};

// Poll for async result (via Netlify proxy)
const pollForResult = async (
  apiKey: string,
  whisperHash: string,
  maxAttempts = 30,
  logRawResponse: boolean = true
): Promise<WhisperResult> => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

    // Check status via proxy
    const statusResponse = await fetch(`${PROXY_URL}?action=status&whisper_hash=${whisperHash}`, {
      headers: {
        'X-LLMWhisperer-Key': apiKey,
      },
    });

    if (!statusResponse.ok) {
      throw new Error(`Failed to check status: ${statusResponse.status}`);
    }

    const result = await statusResponse.json();
    console.log(`[LLMWhisperer] Poll ${attempt + 1}: ${result.status}`);

    if (result.status === 'processed') {
      // Retrieve the result via proxy
      const textResponse = await fetch(`${PROXY_URL}?action=retrieve&whisper_hash=${whisperHash}`, {
        headers: {
          'X-LLMWhisperer-Key': apiKey,
        },
      });

      if (!textResponse.ok) {
        throw new Error(`Failed to retrieve result: ${textResponse.status}`);
      }

      const textResult = await textResponse.json() as WhisperResult;
      if (logRawResponse) {
        console.log(`>>> [LLMWhisperer RAW JSON] >>>`);
        // Use stringify because custom loggers (like marketLogger) might not handle objects
        console.log(JSON.stringify(textResult, null, 2));
        console.log(`<<< [LLMWhisperer RAW JSON] <<<`);
      }

      return textResult;
    }

    if (result.status === 'error') {
      throw new Error('LLMWhisperer processing failed');
    }
  }

  throw new Error('LLMWhisperer processing timeout');
};

// Parse prime items from extracted text
export const parsePrimeItemsFromText = (text: string): string[] => {
  const items: string[] = [];
  const seenItems = new Set<string>();

  // Pattern: "Something Prime ComponentName" or "Something Prime ComponentName Blueprint"
  const primePattern = /([A-Z][a-zA-Z'&]+)\s+Prime\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/gi;

  let match;
  while ((match = primePattern.exec(text)) !== null) {
    const setName = match[1].trim();
    const component = match[2].trim();
    const fullName = `${setName} Prime ${component}`;

    // Skip if too short or already seen
    if (fullName.length < 10) continue;

    const normalized = fullName.toLowerCase();
    if (seenItems.has(normalized)) continue;

    seenItems.add(normalized);
    items.push(fullName);
  }

  return items;
};

// Main export for use in ocrService
export default {
  isConfigured: isLLMWhispererConfigured,
  setApiKey: setLLMWhispererApiKey,
  extractText: extractTextWithLLMWhisperer,
  parseItems: parsePrimeItemsFromText,
};
