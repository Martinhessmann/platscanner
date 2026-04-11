# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed
- OCR image analysis cache: `localStorage` key now includes the app version (`platscanner_image_cache_<version>`), so releases invalidate cached OCR results for the same image without manual cache bumps. Legacy unversioned key is removed on first access; “clear cache” removes all versioned OCR cache keys.

## [1.17.5] - 2026-04-11

### Removed
- Cursor debug-session HTTP ingest hooks from `stepPrimePartsWhisperParser` (no more side-channel telemetry to a local ingest server).
- Ad-hoc OCR utility scripts: `scripts/inspect-prime-grid-crops.mjs` and `scripts/test-ocr-parsing.ts` (manual experiments; use `npm run ocr:fixture:*` for regression).

### Changed
- Refactored OCR into step modules under `src/services/ocr/*` (screen-type detection, cache, parsers, pipeline, test-kit helpers).
- Prime parts OCR now runs a single-pass parser per image after inventory type detection (removed grid slice fallback reruns).
- Relic OCR for `Void Relics / Refinement` inventory grids now uses a metadata-aware parser instead of the generic text parser.
- Debug-image uploads (`/debug/*`) continue to bypass cache, and cache writes are skipped for these fixtures.
- Added OCR step comparison helpers to build step snapshots and compare parsed output against expected JSON fixtures.

### Fixed
- Home / OCR: `analyzeImage` now returns `parsedItemCount` (parser output before inventory dedupe). The console line no longer labels post-filter counts as “Detected N items”, which was easy to read as “OCR only found 9” when the OCR log showed a higher `totalItems` and the rest were already in inventory.
- Prime parts Whisper parser: `splitPrimeRowGroups` no longer starts a new group **before** a quantity-only line (that flushed name/component lines without their qty row, so quantities landed in a separate group and metadata-aware parsing under-detected items, e.g. ~11 instead of a full grid). Rows still split on large line gaps. Splitting when a quantity row is followed by a non-quantity line only runs if the current group already has name/component lines, so the header quantity row stays attached to the first name row instead of forming a discarded-only-qty group.
- Prime parts Whisper text heals: handle `Gyre Prime` on its own line before a jammed `Dual Kamas Prime Neuroptics Paris Prime Upper Zylok Prime…` continuation (with optional blank lines in between); apply the existing Dual Kamas component-line fix via a shared helper; normalize split `0 3` quantity tokens. Quantity rows that append `TAP ON ITEMS` / `SELL ITEMS` on the same line are treated as quantity-only after stripping that trailing UI so they stay in the parse stream and preserve row boundaries.
- Prime parts metadata-aware rows: layout vs text fallback uses `< 4` → richer source, `6–7/8` layout hits → merge up to missing slots from fallback (capped), otherwise `preferLayout` (layout if `>= 7` or layout ties/beats fallback with `>= 4`). This avoids discarding six-hit rows and avoids noisy fallback adding spurious parts on thinner layout rows.
- Prime parts Whisper: column inference accepts slightly wider set-name spacing (`<= 30` vs `22` char deltas) and column quantization tolerates a bit more horizontal slop (`width * 1.05`), so real screenshots with different scale/wrapping still map fragments into eight slots. When merged items look sparse for the row count, the parser logs a warning with per-row layout vs fallback lengths.
- `import.meta.env` is optional-chained in `llmWhispererService` and `WhisperResult` uses `import type` where possible so OCR fixture scripts run under Node/tsx without Vite’s `import.meta.env`.
- Large screenshots (>~4.5MB raw binary) no longer hit Netlify’s platform 500 (“Internal Error”) before the LLMWhisperer proxy runs: images are downscaled/JPEG-recompressed client-side to stay under Netlify’s effective body limit (binary payloads are base64-buffered server-side).
- Local Vite dev (`npm run dev`) no longer cross-origin fetches the deployed Netlify LLMWhisperer function: the client uses `/.netlify/functions/llmwhisperer` in dev and Vite proxies to `VITE_DEV_NETLIFY_FUNCTIONS_ORIGIN` (default `https://platscanner.martinhessmann.com`), avoiding browser CORS when `VITE_PROD_FUNCTIONS_URL` pointed at production.
- `relic_inventory` expected JSON now includes `Axi A1`–`A3 Relic` rows present in `relic_inventory_whisper_result.json` (fixture was five items, parser + Whisper text eight).
- OCR fixture runner: missing optional image path no longer throws (warns and parses without `File`); `ocr:fixture:relic-multi` no longer points at a non-existent PNG so `multi_relics` runs fixture-only.
- Prime parts grid: column-aware quantity badges (with layout), skip OCR-jammed bare `Chassis <Name>` warframe blueprint rows, drop duplicate `Octavia Prime Blueprint` when component blueprints exist, and clamp `Khora Prime Chassis Blueprint` quantity when `Chassis Khora` jam appears in the Whisper text. `primeparts_inventory` OCR fixture passes again; Okina Blade expected quantity aligned to the frozen Whisper text (single stack digit).
- Relic grid parsing no longer merges adjacent relic names in the local `Void Relics / Refinement` fixtures.
- Hidden/unowned relic slots are now omitted in metadata-backed relic grid parsing when the card marker is detected from the image crop.
- Added local relic OCR fixtures covering a multi-card grid and hidden-slot omission.

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
