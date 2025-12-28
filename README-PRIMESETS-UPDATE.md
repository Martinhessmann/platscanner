# Updating Prime Sets Data

This document explains how to update `public/primesets.json` with new Prime items like Gyre Prime.

## Quick Start

Run the update script:

```bash
node update-primesets.mjs
```

This will:
1. Fetch prime items from Warframe Market API v2
2. Update `public/primesets.json` with new items
3. Preserve existing image filenames
4. Add new items with generated image filenames

## How It Works

The script:
- Fetches items from Warframe Market API v2 using item slugs (e.g., `gyre_prime_blueprint`)
- Groups components by their Prime set name
- Determines category (warframe, primary, secondary, melee, etc.) from API tags
- Merges new items with existing data
- Preserves existing image filenames when updating

## Adding New Primes

To add a new Prime set (e.g., "Gyre Prime"):

1. **Edit `update-primesets.mjs`** and add the Prime name to the `primeSetNames` array:
   ```javascript
   const primeSetNames = [
     'Gyre Prime',  // Add new primes here
     'Kullervo Prime',
     // ...
   ];
   ```

2. **Run the script**:
   ```bash
   node update-primesets.mjs
   ```

3. **Download images** (if needed):
   - The script generates image filenames, but you'll need to download the actual images
   - Images should be placed in `public/images/primeparts/`
   - You can get images from Warframe Market or other sources

## Alternative: Using warframe-nexus-query

You can also use the [warframe-nexus-query](https://wfcd.github.io/warframe-nexus-query/) project:

1. Clone the repository
2. Use their API to fetch Prime set data
3. Transform the data to match our `primesets.json` format
4. Merge with existing data

## Manual Update

If you prefer to update manually:

1. Open `public/primesets.json`
2. Add a new entry following this format:
   ```json
   {
     "name": "Gyre Prime",
     "image": "gyre-prime-{hash}.png",
     "category": "warframe",
     "components": [
       {"name": "Blueprint", "count": 1},
       {"name": "Chassis", "count": 1},
       {"name": "Neuroptics", "count": 1},
       {"name": "Systems", "count": 1}
     ]
   }
   ```
3. Sort alphabetically by name
4. Download the image and place it in `public/images/primeparts/`

## Notes

- The script respects API rate limits (~3 requests/second)
- Existing items are updated with latest component data
- New items get auto-generated image filenames
- The script preserves all existing data
