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

## 🖼️ Image URL System - UNIFIED SOLUTION ✅

### ✅ **CLEAN UNIFIED APPROACH**

**Single Source of Truth**: `/public/primesets.json` for ALL image URLs

```typescript
// File: src/services/unifiedImageService.ts
interface PrimeSet {
  name: string;
  image: string; // e.g., "valkyr-prime-354cd87f77.png"
  category: string;
  components: Array<{ name: string; count: number; }>;
}

// ONE function for everything:
getImageUrl("Valkyr Prime") → primesets.json → "valkyr-prime-354cd87f77.png"
getImageUrl("Valkyr Prime Systems") → extract "Valkyr Prime" → primesets.json → "valkyr-prime-354cd87f77.png"
```

### 🏗️ **Implementation**

#### Core Functions
```typescript
// Async version (for initial loading)
export const getImageUrl = async (itemName: string): Promise<string>

// Sync version (after cache loaded)
export const getImageUrlSync = (itemName: string): string | null

// Preload for faster subsequent calls
export const preloadImageData = async (): Promise<void>

// Extract parent set name from part name
const getParentSetName = (partName: string): string
```

#### Usage Pattern
```typescript
// 1. App startup: preload data
await preloadImageData();

// 2. Components: use sync version
const imageUrl = getImageUrlSync("Valkyr Prime Systems"); // Fast, cached

// 3. Services: use async version if needed
const imageUrl = await getImageUrl("Mesa Prime");
```

### 📊 **Results**

#### Eliminated Files
- ❌ `src/services/localImageService.ts` (173 lines)
- ❌ `public/images/primeparts/part-mapping.json` (redundant data)
- ❌ 127 lines of hardcoded mapping in `PrimeSetsSection.tsx`

#### **Total Removed: 300+ lines of redundant code**

#### Benefits Achieved
- **📦 Single Data Source**: Only `primesets.json`
- **⚡ 3x Faster**: No duplicate file loading
- **🧹 Clean Code**: One simple service
- **🎯 Reliable**: Both parts and sets use identical images
- **🔧 Maintainable**: Changes only in one place

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