import type { Context } from "@netlify/functions";

const LLMWHISPERER_API_URL = 'https://llmwhisperer-api.eu-west.unstract.com/api/v2';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-LLMWhisperer-Key',
};

export default async (request: Request, context: Context) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const apiKey = request.headers.get('X-LLMWhisperer-Key');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing API key' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different actions
    if (action === 'whisper') {
      // Extract text from image
      const imageData = await request.arrayBuffer();
      
      const response = await fetch(`${LLMWHISPERER_API_URL}/whisper?mode=high_quality&output_mode=text`, {
        method: 'POST',
        headers: {
          'unstract-key': apiKey,
          'Content-Type': 'application/octet-stream',
        },
        body: imageData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LLMWhisperer Proxy] API error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: `LLMWhisperer API error: ${response.status}`, details: errorText }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await response.json();
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'status') {
      // Check processing status
      const whisperHash = url.searchParams.get('whisper_hash');
      if (!whisperHash) {
        return new Response(
          JSON.stringify({ error: 'Missing whisper_hash' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch(`${LLMWHISPERER_API_URL}/whisper-status?whisper_hash=${whisperHash}`, {
        headers: { 'unstract-key': apiKey },
      });

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `Status check failed: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await response.json();
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'retrieve') {
      // Retrieve processed text
      const whisperHash = url.searchParams.get('whisper_hash');
      if (!whisperHash) {
        return new Response(
          JSON.stringify({ error: 'Missing whisper_hash' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch(`${LLMWHISPERER_API_URL}/whisper-retrieve?whisper_hash=${whisperHash}&text_only=true`, {
        headers: { 'unstract-key': apiKey },
      });

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `Retrieve failed: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // text_only=true returns raw text
      const extractedText = await response.text();
      return new Response(
        JSON.stringify({ text: extractedText }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use: whisper, status, or retrieve' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[LLMWhisperer Proxy] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Proxy error', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

export const config = {
  path: "/.netlify/functions/llmwhisperer",
};
