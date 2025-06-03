import { GoogleGenerativeAI } from '@google/generative-ai';

let API_KEY = '';
let genAI = new GoogleGenerativeAI(API_KEY);

export const setApiKey = (key: string) => {
  try {
    if (!key || key.trim().length === 0) {
      throw new Error('Invalid API key');
    }

    // Test the API key by creating a new instance
    const testGenAI = new GoogleGenerativeAI(key);

    // If successful, update the global instances
    API_KEY = key;
    genAI = testGenAI;

    // Store in local storage
    localStorage.setItem('gemini_api_key', key);
    return true;
  } catch (error) {
    console.error('Failed to set API key:', error);
    // Clear invalid key
    API_KEY = '';
    localStorage.removeItem('gemini_api_key');
    throw error;
  }
};

export const isGeminiConfigured = () => {
  // Check both the in-memory key and localStorage
  const storedKey = localStorage.getItem('gemini_api_key');
  return Boolean(API_KEY) || Boolean(storedKey);
};

// Load API key from local storage on init
try {
  const storedKey = localStorage.getItem('gemini_api_key');
  if (storedKey) {
    setApiKey(storedKey);
  }
} catch (error) {
  console.error('Failed to load stored API key:', error);
  // Clear invalid key
  localStorage.removeItem('gemini_api_key');
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = error => reject(error);
  });
};

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

export const analyzeImage = async (imageFile: File) => {
  if (!isGeminiConfigured()) {
    throw new Error('Gemini API key not configured');
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const imageBase64 = await fileToBase64(imageFile);

    const prompt = `
      Analyze this Warframe inventory screenshot and list all Prime parts you can identify.
      Only include the exact names of Prime parts, one per line.
      Do not include any additional text or explanations.
      Example format:
      Mirage Prime Blueprint
      Kronen Prime Blade
      Burston Prime Receiver
    `;

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

    if (isErrorResponse(text)) {
      return [];
    }

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