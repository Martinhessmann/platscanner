# Syndicate Detection Improvements

> Legacy note (2026-02-09): This document references the older Gemini-specific implementation. Active OCR detection now runs through `src/services/ocrService.ts` with LLMWhisperer text extraction.

## 🐛 Issues Identified

The user reported two main issues:

1. **Mods falsely listed in syndicate section** - Some mods were being incorrectly detected as syndicate rewards
2. **Poor feedback** - The system didn't show which inventory section items were added to

## ✅ Solutions Implemented

### 1. Enhanced Screen Type Detection

**Improved `determineScreenType` function:**
- **Added explicit header checking** - Now looks for section names in the top-left area first
- **Stricter syndicate detection** - Only classifies as syndicate if both syndicate header AND standing costs are visible
- **Better mod detection** - Explicitly checks for "Mods" or "Mod Collection" headers

**New detection logic:**
```typescript
// OLD: Vague detection based on item names
- SYNDICATE (if you see items with Standing values...)

// NEW: Strict header-based detection
- SYNDICATE (ONLY if you see "Syndicate Offerings" or syndicate names in header, AND items with Standing costs)
- MODS (if you see "Mods" or "Mod Collection" in header, OR mod cards with ranks/polarity)
```

### 2. Enhanced Syndicate Analysis

**Improved `analyzeSyndicate` function:**
- **Added critical validation** - Must see syndicate header visible
- **Stricter requirements** - Must see both syndicate name AND standing costs
- **Better error handling** - Returns "NONE_DETECTED" if no syndicate header found

**New validation rules:**
```typescript
CRITICAL: This MUST be a Syndicate Offerings screen with syndicate header visible!
- MUST see syndicate name in header
- MUST see standing costs on items
- If this looks like a regular mod inventory, respond with "NONE_DETECTED"
```

### 3. Screen Type-Aware Parsing

**Enhanced `parseDetectedItems` function:**
- **Added screen type parameter** - Now receives the detected screen type
- **Mod parsing safeguards** - Never parses mods in syndicate screens
- **Category enforcement** - Ensures items are categorized correctly based on screen type

**New parsing logic:**
```typescript
// Only parse mods if screen type is 'mods' or undefined (backward compatibility)
else if (screenType !== 'syndicate' && // Never parse mods in syndicate screens
         // ... mod parsing logic
```

### 4. Enhanced Feedback Messages

**Improved ProcessingPanel and ProcessingDetails components:**
- **Category breakdown** - Shows which inventory sections items were added to
- **Better user feedback** - Clear indication of where items went
- **Detailed reporting** - Includes counts for each category

**New feedback format:**
```typescript
// OLD: Generic feedback
"Added 5 items to inventory"

// NEW: Detailed feedback
"Added 5 items to inventory - 2 Prime Parts, 3 Mods"
"Added 3 items (2 duplicates skipped) - 1 Syndicate, 2 Relics"
```

**Category mapping:**
- `prime_parts` → "Prime Parts"
- `relics` → "Relics" 
- `syndicate_rewards` → "Syndicate"
- `mods` → "Mods"

## 🔧 Technical Implementation

### Files Modified

1. **`src/services/geminiService.ts`**
   - Enhanced `determineScreenType` prompt
   - Improved `analyzeSyndicate` validation
   - Updated `parseDetectedItems` with screen type awareness
   - Added screen type parameter to `analyzeImage`

2. **`src/components/ProcessingPanel.tsx`**
   - Added `getCategoryBreakdown` helper function
   - Enhanced status text with category information

3. **`src/components/ProcessingDetails.tsx`**
   - Added `getCategoryBreakdown` helper function
   - Enhanced status text with category information

### Key Changes

**Screen Type Detection:**
```typescript
// Enhanced prompt with header-first approach
CRITICAL: Check the TOP-LEFT area of the screen for section names/headers first!

IMPORTANT: 
- If you see mod names but NO syndicate header, classify as MODS, not SYNDICATE
- Only classify as SYNDICATE if you see both syndicate header AND standing costs
```

**Parsing Safeguards:**
```typescript
// Screen type-aware mod parsing
const parseDetectedItems = (responseText: string, screenType?: string): DetectedItem[] => {
  // ... parsing logic
  else if (screenType !== 'syndicate' && // Never parse mods in syndicate screens
           // ... mod detection logic
```

**Feedback Enhancement:**
```typescript
// Category breakdown helper
const getCategoryBreakdown = (items: DetectedItem[]) => {
  const categories = items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(categories)
    .map(([category, count]) => {
      const categoryName = category === 'prime_parts' ? 'Prime Parts' :
                          category === 'relics' ? 'Relics' :
                          category === 'syndicate_rewards' ? 'Syndicate' :
                          category === 'mods' ? 'Mods' : category;
      return `${count} ${categoryName}`;
    })
    .join(', ');
};
```

## 🎯 Expected Results

### Before Improvements
- Mods could be incorrectly detected as syndicate rewards
- Generic feedback: "Added 5 items to inventory"
- No way to know which section items went to

### After Improvements
- **Accurate syndicate detection** - Only true syndicate screens are classified as such
- **No false mod detection** - Mods are never parsed in syndicate screens
- **Detailed feedback** - "Added 5 items to inventory - 2 Prime Parts, 3 Mods"
- **Better user experience** - Clear indication of where items were added

## 🔄 Backward Compatibility

All changes maintain backward compatibility:
- Existing functionality continues to work
- Old cached results are still valid
- Screen type parameter is optional in parsing
- No breaking changes to existing APIs

## ✅ Verification

To verify the improvements work:
1. Upload a mod inventory screenshot - should be classified as "MODS"
2. Upload a syndicate offerings screenshot - should be classified as "SYNDICATE"
3. Check feedback messages show category breakdown
4. Verify mods don't appear in syndicate section
5. Test with mixed content screens

The enhanced system should now correctly distinguish between mod inventories and syndicate offerings, preventing false categorizations and providing better user feedback.
