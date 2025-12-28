import { LLMWhispererClientV2 } from 'llmwhisperer-client';
import fs from 'fs';

const API_KEY = 'Bje2g82NYNaRitYXxkgogFA74ocyxOXLgIsSQ4TGGvs';

async function testLLMWhisperer() {
  console.log('Testing LLMWhisperer OCR...\n');
  
  const client = new LLMWhispererClientV2({
    apiKey: API_KEY,
  });
  
  // Read the test image
  const imagePath = './debug/IMG_0318.png';
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  
  console.log(`Image size: ${imageBuffer.length} bytes`);
  console.log('Sending to LLMWhisperer...\n');
  
  try {
    // Use whisper method to extract text
    const result = await client.whisper({
      filePath: imagePath,
      mode: 'high_quality',  // Best quality for game screenshots
      outputMode: 'line_printer',  // Preserve layout
    });
    
    console.log('=== LLMWhisperer Result ===');
    console.log('Status:', result.status);
    console.log('Text length:', result.extracted_text?.length || 0);
    console.log('\n--- Extracted Text ---\n');
    console.log(result.extracted_text || '(no text)');
    
    // Parse for Prime items
    if (result.extracted_text) {
      const primePattern = /([A-Z][a-zA-Z']+\s+Prime\s+[A-Za-z]+(?:\s+[A-Za-z]+)?)/gi;
      const matches = result.extracted_text.match(primePattern) || [];
      
      console.log('\n--- Prime Items Found ---');
      const unique = [...new Set(matches.map(m => m.trim()))];
      unique.forEach((item, i) => console.log(`${i+1}. ${item}`));
      console.log(`\nTotal: ${unique.length} items`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testLLMWhisperer().catch(console.error);
