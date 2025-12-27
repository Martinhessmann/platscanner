# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
