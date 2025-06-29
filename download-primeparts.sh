#!/bin/bash

# Create directory if it doesn't exist
mkdir -p public/images/primeparts

echo "📦 Downloading prime set images and creating part mappings..."

# Check if primesets.json exists
if [ ! -f "public/primesets.json" ]; then
  echo "❌ Error: public/primesets.json not found!"
  exit 1
fi

# Extract unique images and create mapping using Node.js
node -e "
const fs = require('fs');
const primesets = JSON.parse(fs.readFileSync('public/primesets.json', 'utf8'));

// Get unique images
const uniqueImages = [...new Set(primesets.map(set => set.image))];
console.log('=== UNIQUE IMAGES ===');
uniqueImages.forEach(img => console.log(img));

// Create part-to-image mapping
console.log('=== PART MAPPING JSON ===');
const partMapping = {};

primesets.forEach(set => {
  const baseName = set.name.toLowerCase().replace(/\s+/g, '_').replace(/&/g, '_');

  set.components.forEach(component => {
    const partName = baseName + '_' + component.name.toLowerCase().replace(/\s+/g, '_');
    partMapping[partName] = set.image;
  });
});

console.log(JSON.stringify(partMapping, null, 2));
" > download_info.txt

if [ ! -s download_info.txt ]; then
  echo "❌ Error: Failed to process primesets.json"
  exit 1
fi

# Extract the JSON mapping and save it
grep -A10000 "=== PART MAPPING JSON ===" download_info.txt | tail -n +2 > public/images/primeparts/part-mapping.json

# Count unique images
image_count=$(grep -A1000 "=== UNIQUE IMAGES ===" download_info.txt | grep -B1000 "=== PART MAPPING JSON ===" | grep -v "===" | grep -c "\.png")

echo "🔍 Found ${image_count} unique prime set images to download"

success_count=0

# Download unique images
echo "📥 Downloading unique prime set images..."
grep -A1000 "=== UNIQUE IMAGES ===" download_info.txt | grep -B1000 "=== PART MAPPING JSON ===" | grep -v "===" | grep "\.png" | while read image_name; do
  echo "⬇️  Downloading ${image_name}..."

  if curl -L -f -s "https://cdn.warframestat.us/img/${image_name}" -o "public/images/primeparts/${image_name}" 2>/dev/null; then
    echo "✅ Downloaded ${image_name}"
    ((success_count++))
  else
    echo "❌ Failed to download ${image_name}"
  fi

  sleep 0.1
done

# Download fallback unknown image
echo "⬇️  Creating fallback unknown.png..."
if curl -L -f -s "https://cdn.warframestat.us/img/forma.png" -o "public/images/primeparts/unknown.png" 2>/dev/null; then
  echo "✅ Downloaded fallback image"
  ((success_count++))
else
  if command -v convert >/dev/null 2>&1; then
    convert -size 128x128 xc:"#2a2a2a" -gravity center -fill white -pointsize 16 -annotate +0+0 "?" "public/images/primeparts/unknown.png"
    echo "✅ Created placeholder unknown.png"
    ((success_count++))
  else
    echo "❌ Could not create fallback image"
  fi
fi

# Cleanup
rm -f download_info.txt

# Final count
total_images=$(find public/images/primeparts -name "*.png" | wc -l)
mapping_entries=$(grep -c '"' public/images/primeparts/part-mapping.json)

echo ""
echo "🎉 Download complete!"
echo "📊 Downloaded ${success_count} unique images"
echo "📁 Total images: ${total_images}"
echo "🗺️  Part mappings: ${mapping_entries} entries"
echo "📂 Files:"
echo "   • Images: public/images/primeparts/*.png"
echo "   • Mapping: public/images/primeparts/part-mapping.json"
echo ""
echo "💡 Usage in code:"
echo "   1. Load part-mapping.json to get image for each part"
echo "   2. Example: 'akbronco_prime_blueprint' → 'akbronco-prime-e0b3fd0788.png'"
echo "   3. Fallback to 'unknown.png' if mapping not found"