// Netlify Function for LLMWhisperer API Proxy
// Handles CORS and forwards requests to LLMWhisperer API

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const LLMWHISPERER_API_URL = 'https://llmwhisperer-api.eu-west.unstract.com/api/v2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-LLMWhisperer-Key',
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
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

      const response = await fetch(`${LLMWHISPERER_API_URL}/whisper?mode=high_quality&output_mode=layout_preserving`, {
        method: 'POST',
        headers: {
          'unstract-key': apiKey,
          'Content-Type': 'application/octet-stream',
        },
        body: imageData,
      });

      console.log('[LLMWhisperer Proxy] LLMWhisperer response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LLMWhisperer Proxy] API error:', response.status, errorText);
        return {
          statusCode: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: `LLMWhisperer API error: ${response.status}`, details: errorText }),
        };
      }

      const result = await response.json();
      console.log('[LLMWhisperer Proxy] Whisper result:', JSON.stringify(result).substring(0, 200));

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
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

      const response = await fetch(`${LLMWHISPERER_API_URL}/whisper-status?whisper_hash=${whisperHash}`, {
        headers: { 'unstract-key': apiKey },
      });

      if (!response.ok) {
        return {
          statusCode: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: `Status check failed: ${response.status}` }),
        };
      }

      const result = await response.json();
      console.log('[LLMWhisperer Proxy] Status result:', result.status);

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
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

      const response = await fetch(`${LLMWHISPERER_API_URL}/whisper-retrieve?whisper_hash=${whisperHash}`, {
        headers: { 'unstract-key': apiKey },
      });

      if (!response.ok) {
        return {
          statusCode: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: `Retrieve failed: ${response.status}` }),
        };
      }

      // Return the RAW JSON from LLMWhisperer (disable text_only=true)
      const result = await response.json();
      console.log('[LLMWhisperer Proxy] Retrieved result keys:', Object.keys(result));

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
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
