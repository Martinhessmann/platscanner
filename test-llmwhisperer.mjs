import fs from 'fs';

const API_KEY = 'Bje2g82NYNaRitYXxkgogFA74ocyxOXLgIsSQ4TGGvs';
const BASE_URL = 'https://llmwhisperer-api.eu-west.unstract.com/api/v2';  // EU-West region!

async function testLLMWhisperer() {
  console.log('Testing LLMWhisperer OCR...\n');
  console.log('Base URL:', BASE_URL);
  console.log('API Key:', API_KEY.substring(0, 10) + '...\n');
  
  // First test: Check usage info to verify API key
  console.log('--- Checking API Key ---');
  const usageResponse = await fetch(`${BASE_URL}/get-usage-info`, {
    headers: {
      'unstract-key': API_KEY,
    },
  });
  
  console.log('Usage Status:', usageResponse.status);
  if (usageResponse.ok) {
    const usage = await usageResponse.json();
    console.log('Usage Info:', JSON.stringify(usage, null, 2));
  } else {
    const errorText = await usageResponse.text();
    console.log('Usage Error:', errorText);
    return;
  }
  
  // Read and send the test image
  console.log('\n--- Processing Image ---');
  const imagePath = './debug/IMG_0318.png';
  const imageBuffer = fs.readFileSync(imagePath);
  console.log(`Image: ${imagePath} (${imageBuffer.length} bytes)`);
  
  // Send to whisper endpoint
  // Use output_mode=text for cleaner parsing (not layout_preserving)
  const whisperResponse = await fetch(`${BASE_URL}/whisper?mode=high_quality&output_mode=text`, {
    method: 'POST',
    headers: {
      'unstract-key': API_KEY,
      'Content-Type': 'application/octet-stream',
    },
    body: imageBuffer,
  });
  
  console.log('Whisper Status:', whisperResponse.status);
  
  if (!whisperResponse.ok) {
    const errorText = await whisperResponse.text();
    console.log('Whisper Error:', errorText);
    return;
  }
  
  const whisperResult = await whisperResponse.json();
  console.log('Whisper Result:', JSON.stringify(whisperResult, null, 2));
  
  // If async processing, poll for result
  if (whisperResult.status === 'processing' || whisperResult.whisper_hash) {
    const whisperHash = whisperResult.whisper_hash;
    console.log(`\nProcessing started, hash: ${whisperHash}`);
    console.log('Polling for result...\n');
    
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      
      const statusResponse = await fetch(`${BASE_URL}/whisper-status?whisper_hash=${whisperHash}`, {
        headers: { 'unstract-key': API_KEY },
      });
      
      const statusResult = await statusResponse.json();
      console.log(`Poll ${i+1}: ${statusResult.status}`);
      
      if (statusResult.status === 'processed') {
        // Retrieve the text (text_only=true returns raw text, not JSON)
        const retrieveResponse = await fetch(`${BASE_URL}/whisper-retrieve?whisper_hash=${whisperHash}&text_only=true`, {
          headers: { 'unstract-key': API_KEY },
        });
        
        const text = await retrieveResponse.text();
        console.log('\n=== Extracted Text ===');
        console.log(text.substring(0, 2000) + (text.length > 2000 ? '\n...(truncated)' : ''));
        
        // Parse prime items
        const primePattern = /([A-Z][a-zA-Z'&]+)\s+Prime\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/gi;
        const matches = text.match(primePattern) || [];
        
        console.log('\n=== Prime Items Found ===');
        const unique = [...new Set(matches.map(m => m.trim()))];
        unique.forEach((item, i) => console.log(`${i+1}. ${item}`));
        console.log(`\nTotal: ${unique.length} items`);
        return;
      }
      
      if (statusResult.status === 'error') {
        console.log('Processing error:', statusResult);
        return;
      }
    }
    
    console.log('Timeout waiting for result');
  }
}

testLLMWhisperer().catch(console.error);
