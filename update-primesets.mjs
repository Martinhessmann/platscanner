#!/usr/bin/env node
/**
 * Script to update primesets.json from Warframe Market API v2
 * 
 * Usage: node update-primesets.mjs
 * 
 * This script:
 * 1. Fetches all prime items from Warframe Market API v2
 * 2. Groups items by their set (using setParts or setRoot)
 * 3. Updates public/primesets.json with new items
 * 4. Preserves existing image filenames when possible
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WARFRAME_MARKET_API = 'https://api.warframe.market/v2';
const PRIMESETS_FILE = path.join(__dirname, 'public', 'primesets.json');
const RATE_LIMIT_DELAY = 334; // ~3 requests per second

const apiHeaders = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Language': 'en',
  'Platform': 'pc',
};

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Category mapping from tags to our category format
const categoryMap = {
  'warframe': 'warframe',
  'primary': 'primary',
  'secondary': 'secondary',
  'melee': 'melee',
  'archwing': 'archwing',
  'sentinel': 'sentinel',
  'companion': 'companion',
};

// Component name normalization
const normalizeComponentName = (name) => {
  // Remove "Prime" suffix if present
  return name.replace(/\s+Prime\s*$/, '').trim();
};

// Extract set name from item name (e.g., "Gyre Prime Blueprint" -> "Gyre Prime")
const extractSetName = (itemName) => {
  const match = itemName.match(/^(.+?)\s+Prime/);
  return match ? `${match[1]} Prime` : null;
};

// Fetch item by slug
async function fetchItem(slug) {
  try {
    await delay(RATE_LIMIT_DELAY);
    const response = await fetch(`${WARFRAME_MARKET_API}/items/${slug}`, { headers: apiHeaders });
    
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.error || !data.data) return null;
    
    return data.data;
  } catch (error) {
    console.error(`Error fetching ${slug}:`, error.message);
    return null;
  }
}

// Fetch all components for a prime set by trying common component patterns
async function fetchSetComponents(baseSlug, setName, category) {
  const components = [];
  const componentPatterns = {
    warframe: ['blueprint', 'chassis', 'neuroptics', 'systems'],
    primary: ['blueprint', 'barrel', 'receiver', 'stock'],
    secondary: ['blueprint', 'barrel', 'receiver'],
    melee: ['blueprint', 'blade', 'handle'],
    archwing: ['blueprint', 'barrel', 'receiver', 'stock'],
    sentinel: ['blueprint', 'carapace', 'cerebrum', 'systems'],
    companion: ['blueprint', 'band', 'buckle'],
  };
  
  const patterns = componentPatterns[category] || ['blueprint'];
  
  for (const pattern of patterns) {
    const slug = `${baseSlug}_${pattern}`;
    const item = await fetchItem(slug);
    
    if (item && item.tags && item.tags.includes('prime')) {
      const itemName = item.i18n?.en?.name || slug;
      // Extract component name: "Gyre Prime Chassis Blueprint" -> "Chassis"
      // or "Gyre Prime Blueprint" -> "Blueprint"
      let componentName = itemName.replace(`${setName} `, '').trim();
      
      // Remove "Blueprint" suffix from component names (e.g., "Chassis Blueprint" -> "Chassis")
      // But keep "Blueprint" if it's the main blueprint
      if (componentName !== 'Blueprint' && componentName.endsWith(' Blueprint')) {
        componentName = componentName.replace(' Blueprint', '').trim();
      }
      
      // Check if component already exists
      const existing = components.find(c => c.name === componentName);
      if (!existing) {
        components.push({
          name: componentName,
          count: 1,
        });
      } else {
        existing.count++;
      }
    }
  }
  
  return components;
}

// Fetch all prime items from the API
async function fetchAllPrimeItems() {
  console.log('🔍 Fetching prime items from Warframe Market API v2...');
  
  const primeSets = new Map(); // Map<setName, {name, category, components: []}>
  const processedSets = new Set();
  
  // List of prime sets to check
  // You can add new primes here, or the script will discover them from existing data
  // Start with newer primes that might be missing from the JSON file
  const primeSetNames = [
    'Gyre Prime', 'Kullervo Prime', 'Dagath Prime', 'Qorvex Prime',
    // Add more as needed
  ];
  
  // Also load existing primesets to check for updates
  try {
    const existing = JSON.parse(fs.readFileSync(PRIMESETS_FILE, 'utf8'));
    for (const set of existing) {
      if (!primeSetNames.includes(set.name)) {
        primeSetNames.push(set.name);
      }
    }
    console.log(`📚 Also checking ${existing.length} existing prime sets for updates...\n`);
  } catch (error) {
    // File doesn't exist yet, that's okay
  }
  
  console.log(`📦 Checking ${primeSetNames.length} prime sets...\n`);
  
  for (const setName of primeSetNames) {
    if (processedSets.has(setName)) continue;
    processedSets.add(setName);
    
    // Convert "Gyre Prime" to "gyre_prime"
    const baseSlug = setName.toLowerCase().replace(/\s+/g, '_');
    
    // Try fetching the blueprint first to determine category
    const blueprint = await fetchItem(`${baseSlug}_blueprint`);
    
    if (!blueprint || !blueprint.tags || !blueprint.tags.includes('prime')) {
      console.log(`  ⚠️  ${setName}: Not found or not a prime item`);
      continue;
    }
    
    // Determine category
    let category = 'other';
    for (const tag of blueprint.tags || []) {
      if (categoryMap[tag]) {
        category = categoryMap[tag];
        break;
      }
    }
    
    console.log(`  ✅ ${setName} (${category})`);
    
    // Fetch all components for this set
    const components = await fetchSetComponents(baseSlug, setName, category);
    
    if (components.length > 0) {
      primeSets.set(setName, {
        name: setName,
        category,
        components,
      });
      console.log(`     Found ${components.length} components: ${components.map(c => c.name).join(', ')}`);
    }
  }
  
  return Array.from(primeSets.values());
}

// Load existing primesets to preserve image filenames
function loadExistingPrimesets() {
  try {
    const data = fs.readFileSync(PRIMESETS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('⚠️  Could not load existing primesets.json, starting fresh');
    return [];
  }
}

// Generate image filename from set name (matching existing pattern)
function generateImageFilename(setName) {
  // Convert "Gyre Prime" -> "gyre-prime-{hash}.png"
  const slug = setName.toLowerCase().replace(/\s+/g, '-');
  // Generate a simple hash (in real implementation, you'd want consistent hashing)
  const hash = Math.random().toString(36).substring(2, 11);
  return `${slug}-${hash}.png`;
}

// Merge new items with existing data
function mergePrimesets(existing, newItems) {
  const existingMap = new Map(existing.map(item => [item.name, item]));
  const newMap = new Map(newItems.map(item => [item.name, item]));
  
  // Update existing items with new component data
  for (const [name, newItem] of newMap) {
    if (existingMap.has(name)) {
      const existing = existingMap.get(name);
      // Update components but preserve image
      existing.components = newItem.components;
      existing.category = newItem.category;
    } else {
      // New item - add with generated image filename
      existingMap.set(name, {
        ...newItem,
        image: generateImageFilename(newItem.name),
      });
    }
  }
  
  return Array.from(existingMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Main function
async function main() {
  console.log('🚀 Starting primesets.json update...\n');
  
  try {
    // Load existing data
    const existing = loadExistingPrimesets();
    console.log(`📚 Loaded ${existing.length} existing prime sets\n`);
    
    // Fetch new items from API
    const newItems = await fetchAllPrimeItems();
    console.log(`\n✨ Found ${newItems.length} prime sets from API\n`);
    
    // Merge with existing data
    const merged = mergePrimesets(existing, newItems);
    
    // Write updated file
    fs.writeFileSync(PRIMESETS_FILE, JSON.stringify(merged, null, 2));
    console.log(`✅ Updated ${PRIMESETS_FILE} with ${merged.length} prime sets`);
    console.log(`   Added: ${merged.length - existing.length} new sets`);
    
  } catch (error) {
    console.error('❌ Error updating primesets:', error);
    process.exit(1);
  }
}

main();
