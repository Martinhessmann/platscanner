import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * CRITICAL COMPONENT - DO NOT MODIFY WITHOUT REVIEW
 * 
 * This service handles all interactions with the Google Gemini Vision API.
 * It is responsible for:
 * 1. Managing the API key
 * 2. Converting images to base64
 * 3. Analyzing images for item detection
 * 
 * Key Dependencies:
 * - @google/generative-ai
 * - Session storage for API key persistence
 * 
 * Usage Requirements:
 * - API key must be configured before use
 * - Only supports image files (PNG, JPG, JPEG, WEBP)
 * - Images should be clear screenshots of Warframe inventory
 * 
 * Error Handling:
 * - Throws if API key is not configured
 * - Handles unreadable images gracefully
 * - Returns empty array for invalid responses
 */

// Initialize the Gemini API client with a default empty key
let API_KEY = '';
let genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Updates the API key and reinitializes the client
 * CRITICAL: This function must be called before using any other features
 */
export const setApiKey = (key: string) => {
  API_KEY = key;
  genAI = new GoogleGenerativeAI(API_KEY);
  // Store in session storage
  sessionStorage.setItem('gemini_api_key', key);
};

/**
 * Validates if the API key is properly configured
 * Returns: boolean indicating if the API is ready to use
 */
export const isGeminiConfigured = () => {
  return API_KEY && API_KEY.length > 0;
};

// Load API key from session storage on init
const storedKey = sessionStorage.getItem('gemini_api_key');
if (storedKey) {
  setApiKey(storedKey);
}

/**
 * PRIVATE: Converts a File object to base64 string
 * Do not modify this function as it's critical for image processing
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove the data URL prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = error => reject(error);
  });
};

/**
 * PRIVATE: Checks if the response text indicates an unreadable image
 * Add new error indicators here if needed
 */
const isErrorResponse = (text: string): boolean => {
  const errorIndicators = [
    'impossible to provide',
    'cannot identify',
    'unable to detect',
    'no prime parts',
    'could not analyze',
    'cannot analyze',
    'not a valid',
    'not readable',
  ];
  
  return errorIndicators.some(indicator => 
    text.toLowerCase().includes(indicator.toLowerCase())
  );
};

/**
 * CRITICAL: Main function for analyzing images
 * DO NOT modify the prompt or response handling without thorough testing
 * 
 * @param imageFile - The screenshot file to analyze
 * @returns Array of detected item names
 * @throws Error if API key not configured or analysis fails
 */
export const analyzeImage = async (imageFile: File) => {
  if (!isGeminiConfigured()) {
    throw new Error('Gemini API key not configured');
  }

  try {
    // Get the Gemini 1.5 Flash model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Convert image to base64
    const imageBase64 = await fileToBase64(imageFile);

    // CRITICAL: This prompt format is essential for accurate detection
    const prompt = `
      Analyze this Warframe inventory screenshot and list all Prime parts you can identify.
      Only include the exact names of Prime parts, one per line.
      Do not include any additional text or explanations.
      Example format:
      Mirage Prime Blueprint
      Kronen Prime Blade
      Burston Prime Receiver
    `;

    // Generate content
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: imageFile.type,
          data: imageBase64
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();

    // Check if the response indicates an error or unreadable image
    if (isErrorResponse(text)) {
      return [];
    }

    // Parse the response into an array of part names
    const partNames = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.includes('Prime'));

    return partNames;
  } catch (error) {
    console.error('Error analyzing image with Gemini:', error);
    throw new Error('Failed to analyze image. Please try again.');
  }
};