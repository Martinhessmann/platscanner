/**
 * LLMWhisperer OCR Service
 * Uses Unstract's LLMWhisperer API for high-quality OCR
 * Proxied through Netlify function to avoid CORS issues
 */

// Netlify function proxy endpoint
const PROXY_URL = '/.netlify/functions/llmwhisperer';

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
export const extractTextWithLLMWhisperer = async (imageFile: File): Promise<string> => {
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

  console.log('[LLMWhisperer] Extracted', result.extracted_text?.length || 0, 'characters');
  return result.extracted_text || '';
};

// Poll for async result (via Netlify proxy)
const pollForResult = async (apiKey: string, whisperHash: string, maxAttempts = 30): Promise<string> => {
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
      
      const textResult = await textResponse.json();
      const extractedText = textResult.text || '';
      console.log(`[LLMWhisperer] Extracted ${extractedText.length} characters`);
      return extractedText;
    }
    
    if (result.status === 'error') {
      throw new Error('LLMWhisperer processing failed');
    }
  }
  
  throw new Error('LLMWhisperer processing timeout');
};

// Parse prime items from extracted text
import { findBestPrimeMatch } from './primeItemValidator';

export const parsePrimeItemsFromText = (text: string): string[] => {
  const items: string[] = [];
  const seenItems = new Set<string>();
  
  // Pattern: "Something Prime ComponentName" or "Something Prime ComponentName Blueprint"
  // Updated to handle more variations and be more flexible
  const primePattern = /([A-Z][a-zA-Z'&\s]*?)\s+Prime\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/gi;
  
  // Normalize text - replace newlines with spaces for cross-line matching
  const normalizedText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  
  let match;
  while ((match = primePattern.exec(normalizedText)) !== null) {
    const setName = match[1].trim();
    const component = match[2].trim();
    const fullName = `${setName} Prime ${component}`;
    
    // Skip if too short
    if (fullName.length < 10) continue;
    
    // Validate against known items from primesets.json
    const matchedItem = findBestPrimeMatch(fullName, 0.75); // Lower threshold for LLM Whisperer (more accurate OCR)
    if (!matchedItem) {
      // Try without component name (just "X Prime")
      const setNameOnly = `${setName} Prime`;
      const setNameMatch = findBestPrimeMatch(setNameOnly, 0.7);
      if (setNameMatch && !seenItems.has(setNameMatch.toLowerCase())) {
        seenItems.add(setNameMatch.toLowerCase());
        items.push(setNameMatch);
      }
      continue; // Skip if not a valid item
    }
    
    const normalized = matchedItem.toLowerCase();
    if (seenItems.has(normalized)) continue;
    
    seenItems.add(normalized);
    items.push(matchedItem); // Use validated/corrected name
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
