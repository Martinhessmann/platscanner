/**
 * LLMWhisperer OCR Service
 * Uses Unstract's LLMWhisperer API for high-quality OCR
 * Designed specifically for extracting text from images for LLM consumption
 */

// EU-West endpoint (matches the API key region)
const LLMWHISPERER_API_URL = 'https://llmwhisperer-api.eu-west.unstract.com/api/v2';

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
  const key = getApiKey();
  return !!key && key.length > 10;
};

// Convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Extract text from image using LLMWhisperer
export const extractTextWithLLMWhisperer = async (imageFile: File): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('LLMWhisperer API key not configured');
  }

  console.log('[LLMWhisperer] Starting OCR for:', imageFile.name, `(${imageFile.size} bytes)`);

  // Get file as ArrayBuffer
  const arrayBuffer = await imageFile.arrayBuffer();
  
  // Call LLMWhisperer API with output_mode=text for cleaner parsing
  const response = await fetch(`${LLMWHISPERER_API_URL}/whisper?mode=high_quality&output_mode=text`, {
    method: 'POST',
    headers: {
      'unstract-key': apiKey,
      'Content-Type': 'application/octet-stream',
    },
    body: arrayBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[LLMWhisperer] API error:', response.status, errorText);
    throw new Error(`LLMWhisperer API error: ${response.status}`);
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

// Poll for async result
const pollForResult = async (apiKey: string, whisperHash: string, maxAttempts = 30): Promise<string> => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const response = await fetch(`${LLMWHISPERER_API_URL}/whisper-status?whisper_hash=${whisperHash}`, {
      headers: {
        'unstract-key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to check status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`[LLMWhisperer] Poll ${attempt + 1}: ${result.status}`);
    
    if (result.status === 'processed') {
      // Fetch the result (text_only=true returns raw text)
      const textResponse = await fetch(`${LLMWHISPERER_API_URL}/whisper-retrieve?whisper_hash=${whisperHash}&text_only=true`, {
        headers: {
          'unstract-key': apiKey,
        },
      });
      
      if (!textResponse.ok) {
        throw new Error(`Failed to retrieve result: ${textResponse.status}`);
      }
      
      // text_only=true returns raw text, not JSON
      const extractedText = await textResponse.text();
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
