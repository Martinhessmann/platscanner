import { GoogleGenerativeAI } from '@google/generative-ai';

let API_KEY = '';
let genAI = new GoogleGenerativeAI(API_KEY);

export const setApiKey = (key: string) => {
  try {
    API_KEY = key;
    genAI = new GoogleGenerativeAI(API_KEY);
    // Store in local storage instead of session storage
    localStorage.setItem('gemini_api_key', key);
    return true;
  } catch (error) {
    console.error('Failed to store API key:', error);
    return false;
  }
};

export const isGeminiConfigured = () => {
  return API_KEY && API_KEY.length > 0;
};

// Load API key from local storage on init
try {
  const storedKey = localStorage.getItem('gemini_api_key');
  if (storedKey) {
    setApiKey(storedKey);
  }
} catch (error) {
  console.error('Failed to load stored API key:', error);
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