// Supabase Edge Function for OCR processing
// Handles Tesseract.js OCR server-side to avoid browser security restrictions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64, fileName, fileType } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Missing imageBase64 parameter' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Import Tesseract.js - Deno can use npm: specifier
    const { createWorker } = await import('npm:tesseract.js@5.0.4');

    // Create worker - no security restrictions on server side
    const worker = await createWorker('eng', 1);

    // Convert base64 to buffer for Tesseract
    // Tesseract.js can accept base64 string directly or buffer
    // We'll pass the base64 string directly as it's more efficient
    const imageDataUrl = `data:${fileType || 'image/png'};base64,${imageBase64}`;

    // Perform OCR - Tesseract.js can handle data URLs
    const { data: { text } } = await worker.recognize(imageDataUrl);

    // Clean up
    await worker.terminate();

    return new Response(
      JSON.stringify({
        success: true,
        text,
        fileName: fileName || 'unknown',
        fileType: fileType || 'image/png',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('OCR processing error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
