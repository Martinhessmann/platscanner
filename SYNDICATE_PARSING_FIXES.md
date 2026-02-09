# Syndicate Parsing Fixes & Debug Tools

> Legacy note (2026-02-09): This document was written for the previous Gemini pipeline. Current OCR parsing is implemented in `src/services/ocrService.ts` and fed by LLMWhisperer.

## 🐛 Root Cause Analysis

The user identified the core issue: **Syndicate rewards CAN be mods!** This was causing a fundamental problem in our detection logic:

1. **Screen Type Detection**: Gemini was seeing mod names and incorrectly classifying mod inventory screens as "Syndicate"
2. **Parsing Logic**: Even when screen type was correctly detected, the parsing was creating duplicate items
3. **Category Confusion**: Syndicate mods (like "Stinging Truth") were being parsed as both syndicate rewards AND regular mods

## ✅ Critical Fixes Implemented

### 1. Enhanced Screen Type Detection

**Improved the detection criteria** to focus on UI elements rather than item names:

```typescript
// OLD: Vague detection based on item names
- SYNDICATE (if you see items with Standing values...)

// NEW: Specific UI element detection
1. **MODS SCREEN** - Look for these indicators:
   - Mod cards with POLARITY SYMBOLS (V, D, -, etc.) in corners
   - Mod cards with CAPACITY COSTS (numbers like 4, 6, 8, 10, 12, 14, 16) in top-right
   - Mod cards with RANK DOTS at the bottom (blue dots showing level 0-10)
   - NO standing costs (no numbers like 5,000, 25,000, 100,000)

2. **SYNDICATE SCREEN** - Look for these indicators:
   - Header says "Syndicate Offerings", "Arbiters of Hexis", etc.
   - Items have STANDING COSTS (numbers like 5,000, 25,000, 100,000)
   - NO mod polarity symbols or capacity costs
   - NO rank dots at bottom of items
```

### 2. Strict Parsing Logic

**Added critical safeguards** to prevent duplicate parsing:

```typescript
// CRITICAL: Only parse mods if screen type is 'mods' or undefined
// NEVER parse mods in syndicate screens - syndicate rewards can be mods but they're not inventory mods!
else if (screenType !== 'syndicate' && // Never parse mods in syndicate screens
         // ... mod parsing logic

// CRITICAL: If we're in a syndicate screen and this line doesn't match syndicate format, skip it
// This prevents fallback parsing from creating mod items in syndicate screens
if (screenType === 'syndicate' && !line.includes('|')) {
  console.log(`>>> [AI Parsing] Skipping line in syndicate screen (no standing cost format): "${line}" <<<`);
  return; // Skip this line entirely
}
```

### 3. Enhanced Syndicate Analysis

**Improved the syndicate prompt** to be more strict:

```typescript
IMPORTANT: 
- ONLY include items that have standing costs visible
- ONLY include items from the syndicate offerings screen
- If you see mod names but NO standing costs, this is NOT a syndicate screen
- If you cannot clearly see syndicate header, standing costs, or any items, respond with "NONE_DETECTED"
```

### 4. Comprehensive Debug Logging

**Added extensive logging** to track the detection process:

```typescript
console.log(`>>> [Gemini] Screen type: ${screenType} <<<`);
console.log(`>>> [Gemini] Analysis type: ${screenType} <<<`);
console.log(`>>> [Gemini] Analysis response preview:`, analysisText.substring(0, 200) + '...', ` <<<`);
console.log(`>>> [Gemini] Category distribution:`, categoryCounts, ` <<<`);
console.log(`>>> [AI Parsing] Syndicate reward detected: "${name}" with ${standingCost} standing <<<`);
console.log(`>>> [AI Parsing] Skipping line in syndicate screen (no standing cost format): "${line}" <<<`);
```

### 5. Debug Tools

**Created new debug components** to help troubleshoot issues:

- **`DebugInfo` component**: Shows detailed breakdown of detected items
- **Enhanced `ImageModal`**: Added debug toggle to see parsing details
- **Category distribution logging**: Shows exactly how many items of each type were detected

## 🔧 How to Debug the Issue

### Step 1: Check the Console Logs

Look for these log messages when processing an image:

```
>>> [Gemini Screen Type] Raw response: "MODS" <<<
>>> [Gemini] Screen type: mods <<<
>>> [Gemini] Analysis type: mods <<<
>>> [Gemini] Category distribution: {mods: 19} <<<
```

### Step 2: Use the Debug Modal

1. **Upload your problematic image**
2. **Click on the image preview** to open the modal
3. **Click the bug icon** (🐛) to toggle debug information
4. **Check the debug info** to see:
   - Screen type detected
   - Category breakdown
   - Individual item details
   - Parsing results

### Step 3: Verify the Results

The debug info should show:
- **Screen Type**: Should be "mods" for mod inventory screens
- **Category Breakdown**: Should show "19 mods" not "19 syndicate_rewards"
- **Item Details**: Should show mod-specific info (rank, rarity, etc.)

## 🎯 Expected Results

### For Mod Inventory Screens (like IMG_8701.png):
- **Screen Type**: "mods"
- **Category**: All items should be "mods"
- **Feedback**: "Added 19 items to inventory - 19 Mods"

### For Syndicate Screens:
- **Screen Type**: "syndicate"
- **Category**: All items should be "syndicate_rewards"
- **Feedback**: "Added 3 items to inventory - 3 Syndicate"

## 🐛 Troubleshooting the User's Issue

**For "IMG_8701.png - Added 19 items to inventory - 19 Syndicate":**

1. **Check console logs** to see what screen type was detected
2. **Use debug modal** to see the actual parsing results
3. **Verify** that the image shows mod UI elements (polarity symbols, capacity costs)
4. **Confirm** that no standing costs are visible in the image

## 🔄 Backward Compatibility

All fixes maintain backward compatibility:
- Existing functionality continues to work
- Old cached results are still valid
- Screen type parameter is optional
- No breaking changes to existing APIs

## ✅ Verification Steps

To verify the fixes work:

1. **Upload a mod inventory screenshot**
   - Should be classified as "MODS"
   - Should show mod-specific UI elements
   - Should NOT show standing costs

2. **Upload a syndicate offerings screenshot**
   - Should be classified as "SYNDICATE"
   - Should show standing costs
   - Should NOT show mod UI elements

3. **Check the debug information**
   - Use the bug icon in the image modal
   - Verify category breakdown is correct
   - Confirm no duplicate items

4. **Monitor console logs**
   - Look for the new debug messages
   - Verify screen type detection
   - Check parsing logic

The enhanced system should now correctly distinguish between mod inventories and syndicate offerings, preventing the misclassification and duplicate parsing issues the user experienced.
