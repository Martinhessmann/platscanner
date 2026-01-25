
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables with debug option
const result = dotenv.config({ debug: true });

const API_KEY = process.env.LLMWHISPERER_API_KEY || process.env.VITE_LLMWHISPERER_API_KEY || process.env.LLM_WHISPERER_TOKEN;
const DEBUG_DIR = path.join(process.cwd(), 'debug');
const API_URL = 'https://llmwhisperer-api.eu-west.unstract.com/api/v2';

console.log('Current working directory:', process.cwd());
console.log('Available Env Keys:', Object.keys(process.env).filter(k => k.includes('LLM') || k.includes('API')));
console.log('API Key found:', !!API_KEY);

if (!API_KEY) {
  console.error('❌ Error: LLMWHISPERER_API_KEY (or VITE_LLMWHISPERER_API_KEY or LLM_WHISPERER_TOKEN) not found in environment variables.');
  console.error('Please create a .env file or set the variable.');
  process.exit(1);
}

// --- Parsing Logic (Mirrored from ocrService.ts) ---

interface DetectedItem {
  name: string;
  category: string;
  quantity: number;
  rarity?: string;
  rank?: number;
  drain?: number;
  syndicate?: string;
  standingCost?: number;
  currency?: 'standing' | 'vitus_essence';
}

// Helper to parse quantity from a line
const parseQuantity = (line: string): { quantity: number, cleanLine: string } => {
  let quantity = 1;
  let cleanLine = line;

  // Try "5 x Item" or "5 × Item"
  let match = line.match(/^(\d+)\s*[x×]\s*(.+)$/i);
  if (match) {
    quantity = parseInt(match[1]);
    cleanLine = match[2].trim();
    return { quantity, cleanLine };
  }

  // Try "Item x5" or "Item ×5"
  match = line.match(/^(.+)\s*[x×](\d+)$/i);
  if (match) {
    cleanLine = match[1].trim();
    quantity = parseInt(match[2]);
    return { quantity, cleanLine };
  }

  // Try "x5 Item" or "×5 Item"
  match = line.match(/^[x×](\d+)\s*(.+)$/i);
  if (match) {
    quantity = parseInt(match[1]);
    cleanLine = match[2].trim();
    return { quantity, cleanLine };
  }

  return { quantity, cleanLine };
};

const determineModRarity = (name: string) => 'unknown'; // Mock
const determineModType = (name: string) => 'other'; // Mock

const parseDetectedItems = (text: string, screenType: string): DetectedItem[] => {
  const detectedItems: DetectedItem[] = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  let detectedSyndicate = 'Unknown';

  lines.forEach((line, index) => {
    // Skip UI noise (simplified)
    if (line.length < 3) return;

    // Check for syndicate name
    if (line.includes('Arbiters of Hexis') || line.includes('Cephalon Suda') ||
        line.includes('Steel Meridian') || line.includes('New Loka') ||
        line.includes('Red Veil') || line.includes('Perrin Sequence') ||
        line.includes('Arbitration Honors') || line.match(/^SYNDICATE:\s*(.+)$/i)) {

      const match = line.match(/^SYNDICATE:\s*(.+)$/i);
      detectedSyndicate = match ? match[1].trim() : line.trim();
      return;
    }

    // Parse quantity
    const { quantity, cleanLine } = parseQuantity(line);

    // Syndicate reward format: "ITEM_NAME | 25,000"
    const syndicateRewardMatch = cleanLine.match(/^(.*?)\s*\|\s*([\d,]+)/);
    if (syndicateRewardMatch && (screenType === 'syndicate' || screenType === 'unknown')) {
      const name = syndicateRewardMatch[1].trim();
      const standingStr = syndicateRewardMatch[2].replace(/,/g, '');
      const standingCost = parseInt(standingStr, 10);

      // Skip if it looks like a mod line (e.g. "Mod Name | Rank | Drain")
      const isModLine = cleanLine.match(/^.+?\|\s*\d+\s*\|\s*\d+/);

      if (!isModLine) {
        detectedItems.push({
          name,
          category: 'syndicate_rewards',
          syndicate: detectedSyndicate,
          standingCost: isNaN(standingCost) ? 0 : standingCost,
          currency: detectedSyndicate.toLowerCase().includes('arbitration') ? 'vitus_essence' : 'standing',
          quantity
        });
        return;
      }
    }

    // Check if it's a Void Relic
    if (cleanLine.includes('Relic') || /\b(Lith|Meso|Neo|Axi)\s+[A-Z]\d+/i.test(cleanLine)) {
      let relicName = cleanLine;
      let rarity = 'intact';

      const rarityMatch = cleanLine.match(/[\(\[](Intact|Exceptional|Flawless|Radiant)[\)\]]/i) ||
                          cleanLine.match(/\b(Intact|Exceptional|Flawless|Radiant)\b/i);

      if (rarityMatch) {
        rarity = rarityMatch[1].toLowerCase();
        relicName = cleanLine.replace(/[\(\[](Intact|Exceptional|Flawless|Radiant)[\)\]]/gi, '')
                             .replace(/\b(Intact|Exceptional|Flawless|Radiant)\b/gi, '')
                             .trim()
                             .replace(/\s+/g, ' ');
      }

      if (!relicName.toLowerCase().includes('relic')) {
          relicName += ' Relic';
      }

      detectedItems.push({
        name: relicName,
        category: 'relics',
        rarity,
        quantity
      });
      return;
    }

    // Check if it's a mod
    if (
      screenType !== 'syndicate' &&
      cleanLine &&
      !cleanLine.includes('Prime') &&
      !cleanLine.includes('Relic') &&
      cleanLine.length < 100 &&
      cleanLine.length > 1
    ) {
      // Mod Pattern 1: "Name | Rank X | Drain Y"
      const pipeMatch = cleanLine.match(/^(.+?)\s*\|\s*(\d+)\s*\|\s*(\d+)/);
      if (pipeMatch) {
        detectedItems.push({
          name: pipeMatch[1].trim(),
          category: 'mods',
          rank: parseInt(pipeMatch[2]),
          quantity,
          drain: parseInt(pipeMatch[3])
        });
        return;
      }

      // Mod Pattern 2: "Name Rank X/Y (Drain Z)"
      const rankMatch = cleanLine.match(/^(.+?)\s+(?:Rank|r)\s*(\d+)\/\d+\s*(?:\(Drain\s*(\d+)\))?/i);
      if (rankMatch) {
        detectedItems.push({
          name: rankMatch[1].trim(),
          category: 'mods',
          rank: parseInt(rankMatch[2]),
          quantity,
          drain: rankMatch[3] ? parseInt(rankMatch[3]) : undefined
        });
        return;
      }

      // Prime Parts (Simple fallback for test)
      if (cleanLine.includes('Prime') || cleanLine.includes('Blueprint')) {
         detectedItems.push({
            name: cleanLine,
            category: 'prime_parts',
            quantity
         });
      }
    }
  });

  return detectedItems;
};

// --- API Interaction ---

const processImage = async (filePath: string) => {
  const fileName = path.basename(filePath);
  console.log(`\n📸 Processing: ${fileName}`);

  try {
    const fileBuffer = fs.readFileSync(filePath);

    console.log('   Sending to LLMWhisperer...');
    const response = await fetch(`${API_URL}/whisper?mode=high_quality&output_mode=text`, {
      method: 'POST',
      headers: {
        'unstract-key': API_KEY,
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('   🔍 API Response Keys:', Object.keys(result));

    if (!result.whisper_hash) {
      throw new Error('No whisper_hash returned from API');
    }

    const whisperHash = result.whisper_hash;
    console.log(`   ⏳ Job submitted. Hash: ${whisperHash}`);

    // Poll for completion
    let status = 'processing';
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds timeout

    while (status !== 'processed' && status !== 'error' && attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s

      const statusResponse = await fetch(`${API_URL}/whisper-status?whisper_hash=${whisperHash}`, {
        headers: { 'unstract-key': API_KEY },
      });

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const statusResult = await statusResponse.json();
      status = statusResult.status;
      // console.log(`   ... Status: ${status} (Attempt ${attempts}/${maxAttempts})`);
    }

    if (status !== 'processed') {
      throw new Error(`Processing failed or timed out. Final status: ${status}`);
    }

    // Retrieve result
    console.log('   📥 Retrieving result...');
    const retrieveResponse = await fetch(`${API_URL}/whisper-retrieve?whisper_hash=${whisperHash}&output_mode=text`, {
      headers: { 'unstract-key': API_KEY },
    });

    if (!retrieveResponse.ok) {
      throw new Error(`Retrieve failed: ${retrieveResponse.status}`);
    }

    const retrieveResult = await retrieveResponse.json();
    const text = retrieveResult.result_text || '';

    console.log('   ✅ OCR Complete. Text length:', text.length);
    console.log('   --- Raw Text Preview ---');
    console.log(text.substring(0, 200).replace(/\n/g, ' '));
    console.log('   ------------------------');

    // Determine screen type based on filename for testing
    let screenType = 'unknown';
    if (fileName.includes('prime')) screenType = 'prime_parts';
    else if (fileName.includes('relic')) screenType = 'relics';
    else if (fileName.includes('mod')) screenType = 'mods';
    else if (fileName.includes('syndicate')) screenType = 'syndicate';

    const items = parseDetectedItems(text, screenType);
    console.log(`   🔍 Detected ${items.length} items:`);
    items.forEach(item => {
      let details = '';
      if (item.category === 'relics') details = `(${item.rarity})`;
      if (item.category === 'mods') details = `(R${item.rank} D${item.drain})`;
      if (item.category === 'syndicate_rewards') details = `(${item.standingCost} ${item.currency})`;

      console.log(`      - [x${item.quantity}] ${item.name} ${details}`);
    });

  } catch (error) {
    console.error(`   ❌ Error:`, error instanceof Error ? error.message : String(error));
  }
};

// --- Main ---

const main = async () => {
  console.log('🚀 Starting LLMWhisperer OCR Test');
  console.log(`📂 Debug Directory: ${DEBUG_DIR}`);

  if (!fs.existsSync(DEBUG_DIR)) {
    console.error('Debug directory not found!');
    return;
  }

  const files = fs.readdirSync(DEBUG_DIR).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));

  if (files.length === 0) {
    console.log('No image files found in debug directory.');
    return;
  }

  console.log(`Found ${files.length} images.`);

  for (const file of files) {
    await processImage(path.join(DEBUG_DIR, file));
  }
};

main();
