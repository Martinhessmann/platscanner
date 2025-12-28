import { LLMWhispererClientV2 } from 'llmwhisperer-client';

const API_KEY = 'Bje2g82NYNaRitYXxkgogFA74ocyxOXLgIsSQ4TGGvs';

async function checkApiKey() {
  console.log('Checking LLMWhisperer API key...\n');
  console.log('API Key:', API_KEY.substring(0, 10) + '...');
  
  const client = new LLMWhispererClientV2({
    apiKey: API_KEY,
    loggingLevel: 'error',  // Reduce noise
  });
  
  try {
    const usage = await client.getUsageInfo();
    console.log('\n✅ API Key is valid!');
    console.log('Usage info:', JSON.stringify(usage, null, 2));
  } catch (error) {
    console.error('\n❌ API Key error:', error.message);
    
    // Try direct API call
    console.log('\nTrying direct API call...');
    const response = await fetch('https://llmwhisperer-api.us-central.unstract.com/api/v2/get-usage-info', {
      headers: {
        'unstract-key': API_KEY,
      },
    });
    
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text);
  }
}

checkApiKey().catch(console.error);
