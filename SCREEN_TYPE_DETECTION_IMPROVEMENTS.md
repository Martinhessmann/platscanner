# Screen Type Detection & Image Modal Improvements

> Legacy note (2026-02-09): This document references the old Gemini-based OCR workflow. Current screen-type detection is text-based in `src/services/ocrService.ts` using LLMWhisperer output.

## 🐛 Issues Identified

The user reported critical issues with the Gemini image detection system:

1. **Severe screen type misclassification** - Mod inventory screens were being incorrectly detected as "Syndicate" instead of "Mods"
2. **Poor debugging capability** - No way to see what was actually detected in uploaded screenshots
3. **Insufficient feedback** - Users couldn't verify what the AI was seeing

## ✅ Solutions Implemented

### 1. Enhanced Screen Type Detection Prompt

**Completely rewrote the `determineScreenType` prompt** with much more specific detection criteria:

**OLD Prompt Issues:**
- Vague instructions about what to look for
- No specific UI element identification
- Ambiguous classification rules

**NEW Enhanced Prompt:**
```typescript
CRITICAL DETECTION RULES - LOOK FOR THESE SPECIFIC ELEMENTS:

1. **MODS SCREEN** - Look for these indicators:
   - Header says "Mods", "Mod Collection", "Mod Inventory", or similar
   - Mod cards with POLARITY SYMBOLS (V, D, -, etc.) in corners
   - Mod cards with CAPACITY COSTS (numbers like 4, 6, 8, 10, 12, 14, 16) in top-right
   - Mod cards with RANK DOTS at the bottom (blue dots showing level 0-10)
   - Mod names like "Serration", "Vitality", "Primed Flow", "Condition Overload"
   - NO standing costs (no numbers like 5,000, 25,000, 100,000)

2. **SYNDICATE SCREEN** - Look for these indicators:
   - Header says "Syndicate Offerings", "Arbiters of Hexis", "Steel Meridian", etc.
   - Items have STANDING COSTS (numbers like 5,000, 25,000, 100,000)
   - Items are weapons, augments, or syndicate-specific items
   - NO mod polarity symbols or capacity costs
   - NO rank dots at bottom of items
```

**Key Improvements:**
- **Specific UI elements** - Polarity symbols, capacity costs, rank dots
- **Clear exclusions** - What NOT to look for in each screen type
- **Header-first approach** - Check section names first
- **Visual indicators** - Focus on actual UI elements, not just item names

### 2. Enhanced Debug Logging

**Added comprehensive logging** to track detection issues:

```typescript
console.log(`>>> [Gemini Screen Type] Raw response: "${text}" <<<`);
console.log(`>>> [Gemini Screen Type] No match found, defaulting to unknown. Raw text: "${text}" <<<`);
```

### 3. Tappable Image Modal Feature

**Created new `ImageModal` component** to show full analysis results:

**Features:**
- **Full-size image display** - Shows the uploaded screenshot in detail
- **Detected items list** - Shows exactly what the AI found
- **Screen type display** - Shows what type of screen was detected
- **Category breakdown** - Groups items by type with icons
- **Item details** - Shows quantity, rank, rarity, etc.

**Modal includes:**
- Image preview with screen type indicator
- Detailed list of detected items with categories
- Item-specific information (standing costs, ranks, etc.)
- Responsive design for mobile and desktop

### 4. Enhanced Processing Components

**Updated `ProcessingDetails` component:**
- **Clickable image previews** - Tap to open modal
- **Visual feedback** - Hover effects and cursor changes
- **Status-aware interaction** - Only clickable after analysis
- **Tooltip information** - Shows when images are clickable

**Updated `ProcessingPanel` component:**
- **Enhanced feedback messages** - Shows category breakdown
- **Better status reporting** - More detailed progress information

### 5. Screen Type Tracking

**Enhanced data flow:**
- **Modified `analyzeImage` function** - Now returns both items and screen type
- **Updated `ImageState` interface** - Added `screenType` field
- **Enhanced HomePage** - Stores screen type in image state
- **Modal integration** - Displays detected screen type

## 🔧 Technical Implementation

### Files Modified

1. **`src/services/geminiService.ts`**
   - Completely rewrote `determineScreenType` prompt
   - Enhanced debug logging
   - Modified `analyzeImage` to return screen type
   - Added screen type parameter to parsing

2. **`src/components/ImageModal.tsx`** (NEW)
   - Full modal component for image analysis results
   - Category-based item display
   - Responsive design
   - Item-specific information display

3. **`src/components/ProcessingDetails.tsx`**
   - Added clickable image previews
   - Integrated ImageModal component
   - Enhanced user interaction

4. **`src/types/index.ts`**
   - Added `screenType` field to `ImageState` interface

5. **`src/pages/HomePage.tsx`**
   - Updated to handle new `analyzeImage` return format
   - Store screen type in image state
   - Enhanced error handling

### Key Code Changes

**Enhanced Screen Type Detection:**
```typescript
// New specific detection criteria
1. **MODS SCREEN** - Look for these indicators:
   - Mod cards with POLARITY SYMBOLS (V, D, -, etc.) in corners
   - Mod cards with CAPACITY COSTS (numbers like 4, 6, 8, 10, 12, 14, 16) in top-right
   - Mod cards with RANK DOTS at the bottom (blue dots showing level 0-10)
   - NO standing costs (no numbers like 5,000, 25,000, 100,000)
```

**Clickable Image Preview:**
```typescript
<div 
  className="w-10 h-10 rounded overflow-hidden bg-gray-800 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
  onClick={() => {
    if (image.status !== 'queued' && image.status !== 'analyzing') {
      setModalImage({
        src: image.preview,
        fileName: image.file.name,
        items: image.results,
        screenType: image.screenType
      });
    }
  }}
  title={image.status !== 'queued' && image.status !== 'analyzing' ? 'Click to view details' : ''}
>
```

**Enhanced Data Flow:**
```typescript
// New return format from analyzeImage
export const analyzeImage = async (imageFile: File): Promise<{ items: DetectedItem[]; screenType: string }> => {
  // ... analysis logic
  return { items: newItems, screenType };
};
```

## 🎯 Expected Results

### Before Improvements
- Mod inventory screens incorrectly detected as "Syndicate"
- No way to debug what the AI was seeing
- Generic feedback without details
- Poor user experience for troubleshooting

### After Improvements
- **Accurate screen type detection** - Mod screens correctly identified as "Mods"
- **Tappable image previews** - Click to see full analysis results
- **Detailed debugging** - See exactly what was detected
- **Better user experience** - Clear feedback and verification tools

## 🔄 Backward Compatibility

All changes maintain full backward compatibility:
- Existing functionality continues to work
- Old cached results are still valid
- Screen type parameter is optional
- No breaking changes to existing APIs

## ✅ Verification

To verify the improvements work:
1. Upload a mod inventory screenshot - should be classified as "MODS"
2. Click on the image preview - should open modal with details
3. Check the modal shows correct screen type and detected items
4. Verify mods don't appear in syndicate section
5. Test with various screen types

## 🐛 Debugging the User's Issue

**For the specific case "IMG_8701.png - Added 19 items to inventory - 19 Syndicate":**

The enhanced system should now:
1. **Correctly identify** the screen as "MODS" based on polarity symbols and capacity costs
2. **Show detailed breakdown** in the modal of what was actually detected
3. **Provide clear feedback** about the detection process
4. **Allow verification** through the tappable image feature

The new prompt specifically looks for mod-specific UI elements (polarity symbols, capacity costs, rank dots) and explicitly excludes syndicate indicators (standing costs), which should prevent the misclassification the user experienced.
