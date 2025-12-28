# Changelog

All notable changes to this project will be documented in this file.

## [1.17.0] - 2025-12-28

### Added
- **LLMWhisperer OCR Integration**: New AI-powered OCR option using Unstract's LLMWhisperer API
  - Dramatically improved text extraction accuracy compared to Tesseract (28+ items detected vs 0)
  - Works with stylized game fonts that Tesseract struggles with
  - Configure via Settings → API → LLMWhisperer OCR section
  - Get a free API key from [unstract.com](https://unstract.com)
- `netlify/functions/llmwhisperer.ts`: Netlify proxy function to handle LLMWhisperer API calls (bypasses CORS restrictions)
- Cloud sync now supports LLMWhisperer API key as user identifier (in addition to Gemini key)

### Changed
- **OCR Priority**: LLMWhisperer is now used as the primary OCR method when configured, with Tesseract as fallback
- **Logging toggle**: Renamed "Verbose logging" to "Enable logging" - now disables ALL logs when off (not just debug logs)
- Grid-based Tesseract extraction is now skipped when LLMWhisperer is used (faster processing)

### Fixed
- CORS issue with direct LLMWhisperer API calls (now proxied through Netlify Functions)
- Inventory storage now works with LLMWhisperer API key, not just Gemini key

## [1.16.3] - Previous Release

### Changed
- **Migrated from Supabase Edge Functions to Netlify Functions**: The `warframe-market` API proxy has been moved from Supabase Edge Functions to Netlify Functions for simpler deployment and management
  - Netlify Functions deploy automatically with the main site (no separate deployment step needed)
  - Updated `warframeMarketService.ts` to use Netlify Functions as primary method with fallback to direct API calls
  - Removed all Supabase Edge Function dependencies for market data fetching
  - Supabase is now only used for optional cloud sync functionality

### Added
- `netlify/functions/warframe-market.ts`: New Netlify Function for Warframe Market API proxying
- `netlify.toml`: Updated to configure Netlify Functions directory

### Removed
- Supabase Edge Function deployment workflow (deprecated, kept for reference only)

### Technical Details
- Netlify Functions provide the same functionality as Supabase Edge Functions (rate limiting, caching, CORS handling)
- Functions automatically deploy when pushing to main branch
- Local development falls back to direct API calls
- Production automatically uses Netlify Functions with graceful fallback
