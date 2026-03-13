# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed
- Refactored OCR into step modules under `src/services/ocr/*` (screen-type detection, cache, parsers, pipeline, test-kit helpers).
- Prime parts OCR now runs a single-pass parser per image after inventory type detection (removed grid slice fallback reruns).
- Debug-image uploads (`/debug/*`) continue to bypass cache, and cache writes are skipped for these fixtures.
- Added OCR step comparison helpers to build step snapshots and compare parsed output against expected JSON fixtures.

### Logging
- OCR `debug` logs now require the Debug UI `Verbose` toggle; `info/warn/error` logging remains enabled by default.

## [1.17.4] - 2026-02-09

### Changed
- OCR configuration and readiness checks now align with the active LLMWhisperer-only pipeline.
- Removed legacy Gemini/Tesseract wording from user-facing OCR flows.

### Removed
- Removed legacy `geminiService.ts` implementation from the active codebase.
- Removed bundled `public/tesseract/*` runtime artifacts.
- Removed unused OCR dependencies tied to the old stack.

### Documentation
- Updated OCR documentation to reflect current architecture (LLMWhisperer + Netlify proxy).
- Added explicit current OCR status:
  - Prime Parts has an active bug but still supports quantity detection and inventory updates.
  - Mods are currently not working.
  - Relics have an active bug where invisible relics can be counted as `1` instead of `0`.

## [1.17.3] - 2025-12-29

### Fixed
- **Prime Parts Type Filter Counts**: Fixed issue where Warframes and Weapons filter counts showed 0
  - Updated `getPrimePartSetType` to handle both raw JSON format (with `category` field) and transformed PrimeSet format (with `type` field)
  - Added support for underscore-separated item names (e.g., `wisp_prime_chassis`)
  - Filter counts now correctly display the number of items in each category
- **Prime Sets Refresh Progress**: Fixed progress bar not updating incrementally during refresh
  - Progress bar now updates after each set is processed (instead of only at the end)
  - Provides real-time feedback during long refresh operations
  - Similar progressive updates as Prime Parts refresh functionality

### Added
- **Prime Sets Sorting**: New comprehensive sorting options for Prime Sets section
  - **ROI Sorting**: Sort by expected profit from investment analysis (ascending/descending)
  - **Set Value Sorting**: Sort by complete set price (ascending/descending)
  - **Parts Value Sorting**: Sort by current individual parts value (ascending/descending)
  - **Completion Sorting**: Sort by completion percentage (ascending/descending)
  - **Priority Sorting**: Smart completion-based sorting (default, with priority sets always first)
  - Sort dropdown menu in Prime Sets header with visual indicators
  - Priority sets always appear first regardless of selected sort field
  - Click same sort option to toggle ascending/descending direction

### Changed
- **Prime Sets Filter Logic**: Updated filter behavior for better sellable sets management
  - "Built" and "Non-Priority" filters can now be combined (OR logic)
  - Allows showing all sellable sets: built sets + non-priority sets you could build but aren't prioritizing
  - "Planner" and "Priority" filters remain mutually exclusive with others
  - More flexible filtering for inventory management and trading decisions

## [1.17.2] - 2025-12-29

### Added
- **Reservation Debugging System**: New comprehensive logging system to debug prime part reservation issues
  - New "Reservations" log category in Settings → Debug/Logs tab
  - Tracks reservation checks, updates, set planning, cleanup, and cloud sync operations
  - Helps identify orphaned reservations (parts reserved for sets not in build plans)
  - Logs name matching issues, cloud sync conflicts, and cleanup failures
  - Verbose mode available for detailed debug-level logging
- **Prime Parts Type Filters**: Added Warframes and Weapons filter buttons to Prime Parts section
  - Filter by set type (Warframes, Weapons) similar to Prime Sets section
  - Shows real-time counts of items by type
  - Can be combined with other filters (e.g., "Warframes" + "Reserved")

### Fixed
- **Built Warframe Parts Detection**: Fixed issue where built warframe components (chassis, systems, neuroptics without blueprint) were showing "No buyers" instead of "Built (Not Tradeable)"
  - Built warframe parts now correctly skip price fetching (no API calls)
  - UI properly displays "Built (Not Tradeable)" status with orange text
  - Prevents 404 errors from trying to fetch non-tradeable items
  - Single item refresh and category refresh now skip built warframe parts
- **Reservation Cleanup**: Enhanced reservation removal logic with detailed logging
  - Better tracking of which items are affected when sets are removed from build plans
  - Warns about orphaned reservations (reservations for sets not in build plans)

### Changed
- **Price Fetching Logic**: Built warframe parts are now detected and skipped before API calls
  - Prevents unnecessary API requests for non-tradeable items
  - Reduces API rate limit usage
  - Faster processing for items that can't be traded anyway

## [1.17.1] - 2025-12-28

### Changed
- **Warframe Market API v2 Migration**: Updated to use Warframe Market API v2 for item data
  - Uses v2 API (`/v2/items/{slug}`) for item information (better structure, includes i18n support)
  - Uses v1 API (`/v1/items/{slug}/orders` and `/v1/items/{slug}/statistics`) for orders and statistics (v2 doesn't have these endpoints yet)
  - Hybrid approach ensures compatibility while benefiting from v2's improved item data structure
  - Market prices and statistics now working correctly again

### Fixed
- Market price fetching restored after API migration issues
- LLM Whisperer prime parts detection working correctly again

### Removed
- Removed broken `add-new-primes.mjs` and `update-primesets.mjs` scripts (didn't work correctly)

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
