// Netlify Function for LLMWhisperer API Proxy
// Handles CORS and forwards requests to LLMWhisperer API

import type { Handler, HandlerEvent } from '@netlify/functions';

const DEFAULT_LLMWHISPERER_API_URLS = [
  process.env.LLMWHISPERER_API_URL,
  'https://llmwhisperer-api.us-central.unstract.com/api/v2',
  'https://llmwhisperer-api.eu-west.unstract.com/api/v2',
].filter((value, index, values): value is string => !!value && values.indexOf(value) === index);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-LLMWhisperer-Key',
};

interface RegionAttemptError {
  apiUrl: string;
  body: string;
  status: number;
}

const getApiUrls = (event: HandlerEvent): string[] => {
  const requestedApiUrl = event.queryStringParameters?.api_url;
  if (requestedApiUrl) {
    return [requestedApiUrl, ...DEFAULT_LLMWHISPERER_API_URLS.filter(url => url !== requestedApiUrl)];
  }
  return DEFAULT_LLMWHISPERER_API_URLS;
};

const createRegionHint = (status: number, body: string): string | undefined => {
  if (status !== 401) return undefined;
  if (/wrong api endpoint|invalid subscription key/i.test(body)) {
    return 'The API key may belong to a different LLMWhisperer region. This proxy now supports both us-central and eu-west after redeploy.';
  }
  return undefined;
};

const fetchWithRegionFallback = async (
  event: HandlerEvent,
  path: string,
  initFactory: (apiKey: string) => RequestInit,
  apiKey: string
): Promise<{ apiUrl: string; response: Response } | { error: RegionAttemptError }> => {
  let lastError: RegionAttemptError | null = null;

  for (const apiUrl of getApiUrls(event)) {
    const response = await fetch(`${apiUrl}${path}`, initFactory(apiKey));
    if (response.ok) {
      return { apiUrl, response };
    }

    const body = await response.text();
    lastError = { apiUrl, body, status: response.status };
    console.warn('[LLMWhisperer Proxy] Region attempt failed:', {
      apiUrl,
      path,
      status: response.status,
      body: body.substring(0, 300),
    });
  }

  return {
    error: lastError || {
      apiUrl: 'unknown',
      body: 'No LLMWhisperer API endpoints configured',
      status: 500,
    },
  };
};

const handler: Handler = async (event: HandlerEvent) => {
  console.log('[LLMWhisperer Proxy] Request received:', event.httpMethod, event.path);

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    const action = event.queryStringParameters?.action;
    const apiKey = event.headers['x-llmwhisperer-key'];

    console.log('[LLMWhisperer Proxy] Action:', action, 'Has API key:', !!apiKey);

    if (!apiKey) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing API key header (X-LLMWhisperer-Key)' }),
      };
    }

    // Handle different actions
    if (action === 'whisper') {
      console.log('[LLMWhisperer Proxy] Processing whisper request');

      // Get image data from request body
      const imageData = event.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64')
        : Buffer.from(event.body || '');

      console.log('[LLMWhisperer Proxy] Image data size:', imageData.length);

      const result = await fetchWithRegionFallback(
        event,
        '/whisper?mode=high_quality&output_mode=layout_preserving',
        (key) => ({
          method: 'POST',
          headers: {
            'unstract-key': key,
            'Content-Type': 'application/octet-stream',
          },
          body: imageData,
        }),
        apiKey
      );

      if ('error' in result) {
        console.error('[LLMWhisperer Proxy] API error:', result.error.status, result.error.body);
        return {
          statusCode: result.error.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: `LLMWhisperer API error: ${result.error.status}`,
            details: result.error.body,
            apiUrl: result.error.apiUrl,
            hint: createRegionHint(result.error.status, result.error.body),
          }),
        };
      }

      const payload = await result.response.json();
      console.log('[LLMWhisperer Proxy] Whisper result:', JSON.stringify(payload).substring(0, 200), 'via', result.apiUrl);

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          apiUrl: result.apiUrl,
        }),
      };

    } else if (action === 'status') {
      const whisperHash = event.queryStringParameters?.whisper_hash;
      console.log('[LLMWhisperer Proxy] Checking status for:', whisperHash);

      if (!whisperHash) {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Missing whisper_hash parameter' }),
        };
      }

      const result = await fetchWithRegionFallback(
        event,
        `/whisper-status?whisper_hash=${whisperHash}`,
        (key) => ({
          headers: { 'unstract-key': key },
        }),
        apiKey
      );

      if ('error' in result) {
        return {
          statusCode: result.error.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: `Status check failed: ${result.error.status}`,
            details: result.error.body,
            apiUrl: result.error.apiUrl,
          }),
        };
      }

      const payload = await result.response.json();
      console.log('[LLMWhisperer Proxy] Status result:', payload.status, 'via', result.apiUrl);

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          apiUrl: result.apiUrl,
        }),
      };

    } else if (action === 'retrieve') {
      const whisperHash = event.queryStringParameters?.whisper_hash;
      console.log('[LLMWhisperer Proxy] Retrieving result for:', whisperHash);

      if (!whisperHash) {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Missing whisper_hash parameter' }),
        };
      }

      const result = await fetchWithRegionFallback(
        event,
        `/whisper-retrieve?whisper_hash=${whisperHash}`,
        (key) => ({
          headers: { 'unstract-key': key },
        }),
        apiKey
      );

      if ('error' in result) {
        return {
          statusCode: result.error.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: `Retrieve failed: ${result.error.status}`,
            details: result.error.body,
            apiUrl: result.error.apiUrl,
          }),
        };
      }

      // Return the RAW JSON from LLMWhisperer (disable text_only=true)
      const payload = await result.response.json();
      console.log('[LLMWhisperer Proxy] Retrieved result keys:', Object.keys(payload), 'via', result.apiUrl);

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          apiUrl: result.apiUrl,
        }),
      };

    } else {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid action. Use: whisper, status, or retrieve', receivedAction: action }),
      };
    }

  } catch (error) {
    console.error('[LLMWhisperer Proxy] Error:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Proxy error',
        details: error instanceof Error ? error.message : String(error)
      }),
    };
  }
};

export { handler };
