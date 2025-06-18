# 🏗️ Prime Parts Scanner - Architecture Documentation

## 📊 **Current Deployment Architecture**

### **Frontend: Netlify**
- **Main App**: React + Vite deployed on Netlify
- **Domain**: `platscanner.netlify.app`
- **Auto-deploy**: On push to `main` branch
- **Build**: `npm run build` → `dist/` folder
- **Environment Variables**: Set in Netlify Dashboard

### **Backend: Supabase Edge Functions**
- **API Proxy**: Warframe Market API calls via Edge Function
- **Location**: `supabase/functions/warframe-market/`
- **Deploy**: Manual via `supabase functions deploy warframe-market`
- **Environment**: Separate from Netlify (has own Supabase config)

## 🔄 **Data Flow Architecture**

```
[User Browser]
    ↓ (Upload Screenshot)
[Netlify Frontend]
    ↓ (Gemini AI Analysis)
[Google Gemini API]
    ↓ (Detected Items)
[Netlify Frontend]
    ↓ (Price Lookup)
[Supabase Edge Function]
    ↓ (Warframe Market API)
[Warframe Market API]
    ↓ (Price Data)
[Supabase Edge Function]
    ↓ (Formatted Response)
[Netlify Frontend]
    ↓ (Display Results)
[User Browser]
```

## 🔧 **Current Issues & Solutions**

### **Issue 1: Relic Value Analysis Not Working**
**Problem**: Relics show basic price (3p) instead of expected value analysis
**Root Cause**: New batch API not being called correctly

**Debug Steps Added:**
1. ✅ Version info in footer (`v1.4.2 (git-hash) • DEV`)
2. ✅ Console logging for environment detection
3. ✅ Development mode bypass for Supabase (forces direct API calls)
4. ✅ Comprehensive logging in `calculateRelicValueAnalysis()`

### **Issue 2: Supabase Function Deployment**
**Problem**: Docker requirement for local deployment
**Solutions**:
- Use Supabase Dashboard (web interface)
- Install Docker Desktop
- Set up GitHub Actions for auto-deployment

## 🛠️ **Development vs Production**

### **Development Mode** (localhost:5173)
- **Relic Analysis**: Uses direct Warframe Market API calls (bypasses Supabase)
- **Rate Limiting**: 334ms delays between requests
- **Debugging**: Enhanced console logging enabled
- **Version Info**: Shows in footer with "DEV" indicator

### **Production Mode** (Netlify)
- **Relic Analysis**: Uses Supabase Edge Function for batch requests
- **Rate Limiting**: Handled by Edge Function
- **Debugging**: Limited logging
- **Version Info**: Shows version + git hash

## 📝 **Environment Variables**

### **Netlify (Frontend)**
```env
VITE_GEMINI_API_KEY=your_gemini_key
VITE_SUPABASE_URL=your_supabase_project_url  # Optional
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key  # Optional
```

### **Supabase (Edge Functions)**
```env
# Automatically available in Edge Functions
SUPABASE_URL=auto_provided
SUPABASE_ANON_KEY=auto_provided
```

## 🚀 **Deployment Commands**

### **Frontend (Netlify)**
```bash
# Auto-deploy on git push main
git push origin main

# Manual deploy
netlify deploy --prod
```

### **Backend (Supabase)**
```bash
# Method 1: CLI (requires Docker)
supabase functions deploy warframe-market

# Method 2: Dashboard (no Docker needed)
# Copy code → Supabase Dashboard → Functions → Update

# Method 3: GitHub Actions (future)
# Automated on push to main
```

## 🔍 **Debugging Checklist**

### **1. Check Version Info**
- ✅ Footer shows: `v1.4.2 (abc123) • DEV`
- ✅ Console logs: `[App Version] Frontend: v1.4.2`

### **2. Check Relic Analysis**
- ✅ Console logs: `[Relic Analysis] Starting analysis for: Lith W2 Relic`
- ✅ Should see: `[Batch Request] Using direct API calls (dev mode override)`
- ✅ Should see: `[Relic Analysis] Completed for Lith W2 Relic`

### **3. Check API Configuration**
- ✅ Console logs: `[Config] Supabase URL: configured/not configured`
- ✅ Console logs: `[Environment] Development Mode: true`

## 📈 **Performance Comparison**

### **Before (v1.4.2)**
- **Single Item Requests**: 6 individual API calls per relic
- **Rate Limiting**: 334ms × 6 = ~2 seconds per relic
- **UI Update**: Shows basic relic price (3p)

### **After (v1.5.0)**
- **Batch Requests**: 1 batch API call per relic
- **Rate Limiting**: ~500ms total per relic
- **UI Update**: Shows expected value analysis (67p exp, OPEN recommendation)

## 🔮 **Future Improvements**

1. **Auto-Deploy Supabase**: GitHub Actions for Edge Functions
2. **Error Recovery**: Fallback from batch to individual requests
3. **Caching**: Redis/Upstash for market data caching
4. **Monitoring**: Sentry for error tracking
5. **Analytics**: Usage tracking and performance monitoring