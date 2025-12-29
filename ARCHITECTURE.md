# 🏗️ Prime Parts Scanner - Technical Architecture

## 📊 System Architecture

### Frontend: Netlify
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Domain**: `platscanner.netlify.app`
- **Deployment**: Auto-deploy on push to `main` branch
- **Build**: `npm run build` → `dist/` folder

### Backend: Supabase Edge Functions
- **Purpose**: API proxy for Warframe Market API calls
- **Location**: `supabase/functions/warframe-market/`
- **Deployment**: CLI via `supabase functions deploy warframe-market`
- **Status**: ✅ Active (Version 10)
- **Features**: Batch API support, caching, CORS handling, rate limiting

## 🖼️ Static Data Architecture - CENTRALIZED CACHING ✅

### ✅ **CLEAN CENTRALIZED APPROACH**

**Single Cache Manager**: `staticDataService.ts` loads all static data once at app startup

```typescript
// File: src/services/staticDataService.ts
// Global singleton cache - loaded ONCE and shared by all services

export const initializeStaticData = async (): Promise<void> => {
  await Promise.all([
    loadPrimeSetsData(),  // primesets.json → 148 sets
    loadRelicsData()      // relics.json → 2762 relics
  ]);
};

// All services access the same cache
export const getPrimeSetsCache = (): PrimeSet[] | null
export const getRelicsCache = (): any[] | null
```

### 🏗️ **Service Integration**

#### Consumer Services
```typescript
// primeSetService.ts - Uses centralized cache
import { getPrimeSetsCache as getStaticPrimeSetsCache } from './staticDataService';

export const loadPrimeSets = async (): Promise<PrimeSet[]> => {
  const jsonData = getStaticPrimeSetsCache(); // No fetch, uses cache
  return jsonData.map(transformJsonToPrimeSet);
};

// unifiedImageService.ts - Uses centralized cache
import { getPrimeSetsCache } from './staticDataService';

const getCachedPrimeSets = (): PrimeSet[] => {
  return getPrimeSetsCache() || [];
};

export const getImageUrl = async (itemName: string): Promise<string> => {
  const primeSets = getCachedPrimeSets(); // No fetch, uses cache
  // ... image URL resolution
};
```

#### Initialization Flow
```typescript
// 1. App startup (HomePage.tsx useEffect)
await initializeStaticData();
console.log('✅ Loaded 148 prime sets + 2762 relics');

// 2. All services access cached data instantly
const sets = getPrimeSetsCache();        // primeSetService
const imageUrl = getImageUrl("Valkyr Prime");  // unifiedImageService
const relics = getRelicsCache();         // relicDataService
```

### 📊 **Refactoring Results (2025-10-14)**

#### Architecture Before
```
❌ staticDataService: fetch('/primesets.json')
❌ primeSetService: fetch('/primesets.json')
❌ unifiedImageService: fetch('/primesets.json')
= 3x duplicate loading + 3x separate caches
```

#### Architecture After
```
✅ staticDataService: fetch('/primesets.json') [ONCE]
✅ primeSetService: getPrimeSetsCache()
✅ unifiedImageService: getPrimeSetsCache()
= 1x loading + 1x shared cache
```

#### Benefits Achieved
- **📦 Single Data Source**: `staticDataService` as central cache manager
- **⚡ 3x Faster Startup**: Eliminated duplicate JSON fetches
- **💾 Reduced Memory**: Single cache instead of triple redundancy
- **🎯 Consistent Data**: All services use identical cached data
- **🔧 Maintainable**: Single initialization point
- **🚀 Better Performance**: Parallel loading of prime sets + relics at startup

## 🔄 Data Flow

### Core Processing Pipeline
```
[User Browser]
    ↓ (Upload Screenshot)
[React Frontend]
    ↓ (Gemini AI Analysis)
[Google Gemini API]
    ↓ (Detected Items)
[React Frontend]
    ↓ (Price Lookup)
[Supabase Edge Function OR Direct API]
    ↓ (Warframe Market API)
[Warframe Market API]
    ↓ (Price Data)
[React Frontend]
    ↓ (Display Results)
[User Browser]
```

### Relic Value Analysis Flow
```
[Detected Relics]
    ↓ (Relic Data Lookup)
[Static Database (/public/relics.json)]
    ↓ (Drop Data + Market URLs)
[Batch Price Lookup]
    ↓ (All Drop Prices)
[Expected Value Calculation]
    ↓ (Weighted Average + Recommendations)
[Enhanced Relic Display]
```

## 🛠️ Development vs Production

### Development Mode (localhost)
- **API Calls**: Direct to Warframe Market (bypasses Supabase)
- **Rate Limiting**: 334ms delays between requests
- **Debugging**: Enhanced console logging
- **Version Info**: Shows "DEV" indicator in footer

### Production Mode (Netlify)
- **API Calls**: Via Supabase Edge Function (with fallback)
- **Rate Limiting**: Handled by Edge Function
- **Debugging**: Limited logging
- **Version Info**: Shows version + git hash

## 🔧 Technical Components

### Core Services
- **`geminiService.ts`**: AI image analysis and item detection
- **`warframeMarketService.ts`**: Market data fetching and price calculations
- **`relicDataService.ts`**: Relic database lookup and drop analysis
- **`inventoryService.ts`**: Persistent storage and inventory management

### Key Components
- **`ImageUploader`**: File handling with drag & drop
- **`ProcessingAnimation`**: Real-time processing feedback
- **`InventorySection`**: Categorized item display with controls
- **`RelicAnalysisCard`**: Expected value analysis and recommendations
- **`ApiKeySettings`**: Secure API key management

## 📦 Inventory Sections Architecture

The application has **5 inventory sections**, each with different architectural patterns. This section documents the differences and why they exist.

### Architecture Patterns

#### Pattern 1: Wrapper Pattern (`InventorySection`)

**Used by:**
- Prime Parts (`PrimeParts.tsx`)
- Void Relics (`RelicResultsTable.tsx`)

**Structure:**
```tsx
<InventorySection
  category="prime_parts" | "relics"
  onRefreshAll={(itemsToRefresh?: InventoryItem[]) => void}
  onRefreshItem={(itemName: string) => void}
  onRemoveItem={(itemName: string) => void}
  ...
/>
```

**Characteristics:**
- ✅ Consistent header/accordion UI via wrapper
- ✅ Unified refresh button and progress tracking
- ✅ Filtered refresh support via `visibleItems` state
- ✅ Same prop interface for both sections
- ✅ Refresh handlers in `HomePage.tsx`

**Refresh Flow:**
1. Component calls `onFilteredItemsChange(filteredItems)` → `InventorySection` stores in `visibleItems`
2. User clicks refresh → `InventorySection` calls `onRefreshAll(visibleItems || undefined)`
3. `HomePage` handler receives filtered items and refreshes only those

---

#### Pattern 2: Standalone Pattern

**Used by:**
- Syndicate Rewards (`SyndicateRewardsSection.tsx`)
- Mod Duplicates (`ModDuplicatesSection.tsx`)
- Prime Sets (`PrimeSetsSection.tsx`)

**Structure:**
Each component is fully self-contained with its own:
- Header/accordion UI
- Filtering logic
- Refresh handlers
- Progress tracking

**Differences:**

| Component | Refresh Prop | Filtered Refresh | Cancel Support | Complete Callback |
|-----------|-------------|------------------|----------------|-------------------|
| **SyndicateRewards** | `onRefreshStart(itemsToRefresh?)` | ✅ Yes | ✅ Yes | ✅ Yes |
| **ModDuplicates** | `onRefreshStart(itemsToRefresh?)` | ✅ Yes | ✅ Yes | ✅ Yes |
| **PrimeSets** | Internal `handleRefreshPrimeSets()` | ✅ Yes | ❌ No | ❌ No |

**Why Different?**

1. **SyndicateRewards & ModDuplicates:**
   - More complex refresh logic (progress tracking, cancellation)
   - Custom filtering needs (syndicate types, mod rarity, etc.)
   - Need `onRefreshComplete` callback for state management
   - Similar patterns (ModDuplicates follows SyndicateRewards pattern)

2. **PrimeSets:**
   - Completely different data model (`SetProgress[]` vs `InventoryItem[]`)
   - Self-contained refresh logic (no external handler needed)
   - Complex filtering (vaulted, warframes, weapons, completion status)
   - Investment analysis calculations
   - No need for external refresh callbacks

---

### Filtered Refresh Implementation

**All sections support filtered refresh**, but implementation differs:

#### Wrapper Pattern (Prime Parts, Relics)
```typescript
// InventorySection.tsx
const [visibleItems, setVisibleItems] = useState<InventoryItem[] | null>(null);

// Component reports filtered items
onFilteredItemsChange(filteredItems);

// Refresh passes filtered items
onRefreshAll(visibleItems || undefined);
```

#### Standalone Pattern (Syndicate, Mods, Prime Sets)
```typescript
// Each component checks filters internally
const handleRefresh = async () => {
  const itemsToRefresh = activeFilters.has('all')
    ? allItems
    : filteredItems;
  
  onRefreshStart(itemsToRefresh); // Syndicate/Mods
  // OR
  handleRefreshPrimeSets(); // Prime Sets (internal)
};
```

---

### Component Comparison

| Feature | Prime Parts | Relics | Syndicate | Mods | Prime Sets |
|---------|-------------|--------|-----------|------|------------|
| **Wrapper Component** | ✅ `InventorySection` | ✅ `InventorySection` | ❌ Standalone | ❌ Standalone | ❌ Standalone |
| **Refresh Prop** | `onRefreshAll` | `onRefreshAll` | `onRefreshStart` | `onRefreshStart` | Internal |
| **Filtered Refresh** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Progress Tracking** | Via wrapper | Via wrapper | Via props | Via props | Internal |
| **Cancel Support** | ❌ No | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| **Refresh Complete** | ❌ No | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| **Data Type** | `InventoryItem[]` | `InventoryItem[]` | `SyndicateReward[]` | `ModItem[]` | `SetProgress[]` |

---

### Why Not Standardize?

**Current State:**
- ✅ All sections work correctly
- ✅ All support filtered refresh
- ✅ Each optimized for its specific needs

**Risks of Standardization:**
- 🔴 Breaking changes to working code
- 🔴 Different data types don't map easily
- 🔴 Prime Sets would require major refactoring
- 🔴 Testing burden (5 sections × multiple features)
- 🔴 No user benefit, only developer convenience

**Recommendation:**
- ✅ **Keep as-is** - Document differences (this section)
- ✅ **Standardize incrementally** - Only when adding new features
- ✅ **Don't force uniformity** - Different needs justify different patterns

---

### Future Considerations

**When to Standardize:**
- Adding a new feature that needs consistency across all sections
- Refactoring a specific section for other reasons
- Differences cause actual maintenance problems

**Safe Standardization Steps:**
1. **Low Risk**: Standardize prop names (`onRefreshStart` → `onRefreshAll`)
2. **Medium Risk**: Add missing features (cancel support, complete callbacks)
3. **High Risk**: Full architectural refactor (not recommended)

**Current Priority:**
- ✅ Document differences (done)
- ✅ Ensure filtered refresh works (done)
- ⏸️ Standardization (deferred - not needed)

### Data Storage
- **LocalStorage**: API keys and user preferences
- **SessionStorage**: Temporary processing state
- **Static Files**: Relic database (/public/relics.json)

## 📝 Environment Configuration

### Required Variables
```env
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### Optional Variables (Supabase)
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🚀 Deployment

### Frontend (Netlify)
```bash
# Automatic deployment
git push origin main

# Manual deployment
netlify deploy --prod
```

### Backend (Supabase Edge Functions)
```bash
# Prerequisites
# 1. Docker Desktop must be running
open -a Docker

# 2. Supabase CLI installed
brew install supabase/tap/supabase

# Deploy Edge Function
supabase functions deploy warframe-market
```

**✅ Verified Working**: CLI deployment successfully deploys the warframe-market function
- **Function Size**: ~638kB bundled
- **Current Version**: 10 (Active)
- **Dashboard**: https://supabase.com/dashboard/project/dbhdxrdjlwgclblmoypj/functions

### Edge Function Features
- **Batch API Support**: Handles up to 10 items per request for relic analysis
- **Smart Caching**: 5-minute TTL to reduce Warframe Market API calls
- **CORS Handling**: Proper headers for cross-origin requests
- **Error Recovery**: Comprehensive error handling with fallbacks
- **Rate Limiting**: Respects Warframe Market API limits (3 req/sec)

## ⚡ Performance Optimizations

### API Efficiency
- **Batch Requests**: Single call for multiple relic drops
- **Rate Limiting**: Respects Warframe Market API limits
- **Caching**: 5-minute TTL for market data
- **Fallback Strategy**: Direct API calls when Supabase unavailable

### UI Performance
- **Progressive Loading**: Items appear as processed
- **Batched Updates**: Reduced re-renders during refresh
- **Memoized Calculations**: Cached inventory statistics
- **Image Optimization**: Lazy loading and compression

### Error Handling
- **Graceful Degradation**: App works without Supabase
- **Retry Logic**: Automatic retry for failed requests
- **User Feedback**: Clear error messages and recovery options
- **State Recovery**: Fallback to persistent storage

## 🔍 Debugging

### Development Tools
- **Console Logging**: Comprehensive debug output in dev mode
- **Version Display**: Footer shows current version and environment
- **Network Tab**: Monitor API calls and responses
- **React DevTools**: Component state inspection

### Common Debug Points
```javascript
// Check environment mode
console.log('[Environment] Development Mode:', import.meta.env.DEV)

// Verify API configuration
console.log('[Config] Supabase URL:', !!import.meta.env.VITE_SUPABASE_URL)

// Monitor relic analysis
console.log('[Relic Analysis] Starting analysis for:', relicName)
```

## 📊 Performance Metrics

### Processing Speed
- **Relic Analysis**: ~500ms per relic (5x improvement from v1.4)
- **Image Processing**: ~2-3s per screenshot
- **Market Data**: ~200ms per item (cached)

### API Usage
- **Gemini API**: ~1 request per image
- **Warframe Market**: Batched requests in production
- **Rate Limits**: 3 requests/second (Warframe Market)

## 🔐 Security

### Content Security Policy
- **Strict CSP**: Blocks unauthorized external resources
- **API Domains**: Whitelisted domains for API calls
- **Image Sources**: Allowed sources for item thumbnails

### Data Privacy
- **Local Storage**: API keys stored in browser only
- **No Server Storage**: No user data stored on backend
- **HTTPS Only**: All communications encrypted

## 🚧 Known Limitations

### Current Constraints
- **Gemini API Dependency**: Requires active API key
- **Rate Limiting**: Warframe Market API limits (3 req/sec)
- **Image Quality**: Detection accuracy depends on screenshot quality
- **Browser Storage**: Limited by LocalStorage capacity
- **Docker Requirement**: Supabase CLI deployment requires Docker Desktop

### Future Improvements
- **GitHub Actions**: Automated Edge Function deployment
- **Enhanced AI Prompts**: More reliable item detection
- **Caching Layer**: Redis/Upstash for better performance
- **Real-time Updates**: WebSocket integration
- **Mobile App**: Native mobile application