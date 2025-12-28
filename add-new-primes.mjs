#!/usr/bin/env node
/**
 * Quick script to add new Prime sets to primesets.json
 * Only checks for new primes, doesn't update existing ones
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WARFRAME_MARKET_API = 'https://api.warframe.market/v2';
const PRIMESETS_FILE = path.join(__dirname, 'public', 'primesets.json');
const RATE_LIMIT_DELAY = 334;

const apiHeaders = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Language': 'en',
  'Platform': 'pc',
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const categoryMap = {
  'warframe': 'warframe',
  'primary': 'primary',
  'secondary': 'secondary',
  'melee': 'melee',
  'archwing': 'archwing',
  'sentinel': 'sentinel',
  'companion': 'companion',
};

async function fetchItem(slug) {
  try {
    await delay(RATE_LIMIT_DELAY);
    const response = await fetch(`${WARFRAME_MARKET_API}/items/${slug}`, { headers: apiHeaders });
    if (!response.ok) return null;
    const data = await response.json();
    return data.error ? null : data.data;
  } catch (error) {
    return null;
  }
}

function extractSetName(itemName) {
  const match = itemName.match(/^(.+?)\s+Prime/);
  return match ? `${match[1]} Prime` : null;
}

async function fetchSetComponents(baseSlug, setName, category) {
  const components = [];
  const componentPatterns = {
    warframe: [
      ['blueprint'],
      ['chassis_blueprint', 'chassis'],
      ['neuroptics_blueprint', 'neuroptics'],
      ['systems_blueprint', 'systems']
    ],
    primary: [
      ['blueprint'],
      ['barrel'],
      ['receiver'],
      ['stock']
    ],
    secondary: [
      ['blueprint'],
      ['barrel'],
      ['receiver']
    ],
    melee: [
      ['blueprint'],
      ['blade'],
      ['handle']
    ],
    archwing: [
      ['blueprint'],
      ['barrel'],
      ['receiver'],
      ['stock']
    ],
    sentinel: [
      ['blueprint'],
      ['carapace'],
      ['cerebrum'],
      ['systems']
    ],
    companion: [
      ['blueprint'],
      ['band'],
      ['buckle']
    ],
  };
  
  const patterns = componentPatterns[category] || [['blueprint']];
  
  for (const patternGroup of patterns) {
    let found = false;
    for (const pattern of patternGroup) {
      const slug = `${baseSlug}_${pattern}`;
      const item = await fetchItem(slug);
      
      if (item && item.tags && item.tags.includes('prime')) {
        const itemName = item.i18n?.en?.name || slug;
        let componentName = itemName.replace(`${setName} `, '').trim();
        
        if (componentName !== 'Blueprint' && componentName.endsWith(' Blueprint')) {
          componentName = componentName.replace(' Blueprint', '').trim();
        }
        
        const existing = components.find(c => c.name === componentName);
        if (!existing) {
          components.push({ name: componentName, count: 1 });
        } else {
          existing.count++;
        }
        found = true;
        break; // Found this component, move to next pattern group
      }
    }
  }
  
  return components;
}

function generateImageFilename(setName) {
  const slug = setName.toLowerCase().replace(/\s+/g, '-');
  const hash = Math.random().toString(36).substring(2, 11);
  return `${slug}-${hash}.png`;
}

async function main() {
  console.log('🚀 Adding new Prime sets...\n');
  
  // Load existing
  let existing = [];
  try {
    const data = fs.readFileSync(PRIMESETS_FILE, 'utf8');
    existing = JSON.parse(data);
  } catch (error) {
    console.warn('⚠️  Could not load existing primesets.json');
  }
  
  const existingNames = new Set(existing.map(item => item.name));
  console.log(`📚 Found ${existing.length} existing prime sets\n`);
  
  // Only check for new primes
  const newPrimes = [
    'Gyre Prime',
    // Add more new primes here as they're released
  ];
  
  const toAdd = newPrimes.filter(name => !existingNames.has(name));
  
  if (toAdd.length === 0) {
    console.log('✅ All primes already in the file!');
    return;
  }
  
  console.log(`🔍 Checking ${toAdd.length} new prime sets...\n`);
  
  const newSets = [];
  for (const setName of toAdd) {
    const baseSlug = setName.toLowerCase().replace(/\s+/g, '_');
    console.log(`  Checking ${setName}...`);
    
    const blueprint = await fetchItem(`${baseSlug}_blueprint`);
    if (!blueprint || !blueprint.tags || !blueprint.tags.includes('prime')) {
      console.log(`    ⚠️  Not found`);
      continue;
    }
    
    let category = 'other';
    for (const tag of blueprint.tags || []) {
      if (categoryMap[tag]) {
        category = categoryMap[tag];
        break;
      }
    }
    
    const components = await fetchSetComponents(baseSlug, setName, category);
    
    if (components.length > 0) {
      newSets.push({
        name: setName,
        image: generateImageFilename(setName),
        category,
        components,
      });
      console.log(`    ✅ Added with ${components.length} components`);
    }
  }
  
  if (newSets.length === 0) {
    console.log('\n⚠️  No new primes found');
    return;
  }
  
  // Merge and sort
  const merged = [...existing, ...newSets].sort((a, b) => a.name.localeCompare(b.name));
  
  // Write file
  fs.writeFileSync(PRIMESETS_FILE, JSON.stringify(merged, null, 2));
  console.log(`\n✅ Updated ${PRIMESETS_FILE}`);
  console.log(`   Added ${newSets.length} new prime set(s): ${newSets.map(s => s.name).join(', ')}`);
}

main().catch(console.error);
