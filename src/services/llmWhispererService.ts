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
  pages?: any[];
  blocks?: any[];
  metadata?: any;
}

// Get API key from localStorage
const getApiKey = (): string | null => {
  try {
    return localStorage.getItem('platscanner_llmwhisperer_api_key');
  } catch {
    return null;
  }
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

// Extract text from image using LLMWhisperer (via Netlify proxy)
export const extractTextWithLLMWhisperer = async (imageFile: File): Promise<WhisperResult> => {
  console.log('[LLMWhisperer] extractTextWithLLMWhisperer called');
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[LLMWhisperer] No API key found!');
    throw new Error('LLMWhisperer API key not configured');
  }

  console.log('[LLMWhisperer] Starting OCR for:', imageFile.name, `(${imageFile.size} bytes)`);

  // Get file as ArrayBuffer
  const arrayBuffer = await imageFile.arrayBuffer();

  // Call LLMWhisperer via Netlify proxy
  const response = await fetch(`${PROXY_URL}?action=whisper`, {
    method: 'POST',
    headers: {
      'X-LLMWhisperer-Key': apiKey,
      'Content-Type': 'application/octet-stream',
    },
    body: arrayBuffer,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[LLMWhisperer] API error:', response.status, errorData);
    throw new Error(`LLMWhisperer API error: ${response.status} - ${errorData.error || errorData.details || 'Unknown'}`);
  }

  const result = await response.json();

  if (result.status === 'processing' || result.whisper_hash) {
    // Need to poll for result (async processing)
    console.log('[LLMWhisperer] Processing, whisper hash:', result.whisper_hash);
    return await pollForResult(apiKey, result.whisper_hash);
  }

  return result;
};

// Poll for async result (via Netlify proxy)
const pollForResult = async (apiKey: string, whisperHash: string, maxAttempts = 30): Promise<WhisperResult> => {
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
      console.log(`>>> [LLMWhisperer RAW JSON] >>>`);
      // Use stringify because custom loggers (like marketLogger) might not handle objects
      console.log(JSON.stringify(textResult, null, 2));
      console.log(`<<< [LLMWhisperer RAW JSON] <<<`);

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
