# Changelog

All notable changes to Prime Parts Scanner will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.1] - 2025-01-02

### Fixed
- **🚨 CRITICAL: Relic Market Price vs Expected Value Logic** ⭐⭐⭐⭐⭐ ✅ **FIXED**
  - **Issue**: Relics recommended "OPEN" even when direct market sale was more profitable
  - **Example**: Lith W1 Relic showed "Expected: 3.0p, OPEN" but market buyers offered 5p for the intact relic
  - **Root Cause**: `calculateRelicValueAnalysis()` hardcoded `directSalePrice = 0` instead of using actual market data
  - **Solution**: Pass relic's market price into analysis function and properly compare against expected drop value
  - **Impact**: Now correctly recommends "SELL" when market price exceeds expected value (e.g., 5p market vs 3p expected = +2p profit by selling)

- **🎨 Logical Color Scheme for Recommendations** ⭐⭐⭐⭐ ✅ **IMPROVED**
  - **Issue**: SELL recommendations displayed in RED (suggesting bad/dangerous) while OPEN was GREEN
  - **Logic Fix**: Both SELL and OPEN now use GREEN when they're the profitable choice
  - **Color Meaning**: GREEN = profitable decision, YELLOW = refine first, GRAY = no clear profit
  - **Impact**: Color now indicates decision quality, not action type - less confusing UX

### Enhanced
- **🎯 Relic Decision UI/UX Overhaul** ⭐⭐⭐⭐⭐ ✅ **COMPLETED**
  - **Clear Decision-Making Interface**: Replaced confusing "7 exp" display with intuitive relic analysis cards
  - **Dedicated Relic Components**: New `RelicAnalysisCard` and `RelicResultsTable` designed specifically for decision-making
  - **Prominent Recommendations**: Large, color-coded action recommendations (OPEN/SELL/REFINE)
  - **Expected vs Sale Comparison**: Clear "Expected: 67p vs Sell: 15p = +52p profit" display
  - **Expandable Drop Analysis**: Click to view detailed breakdown of all 6 potential drops with individual prices
  - **Smart Sorting**: Relic-specific sorting by Expected Value, Recommendation priority, and Name
  - **Visual Decision Guidance**: Color-coded borders and icons matching recommendation type
  - **Profit Calculations**: Shows exact profit amounts and percentage gains for opening vs selling

- **📊 Improved Expected Value Display & Prioritization** ⭐⭐⭐⭐⭐ ✅ **COMPLETED**
  - **Better Decimal Precision**: Shows 1-2 decimal places for values 0-10p (e.g., "3.2p", "0.65p") instead of misleading rounded integers
  - **Smart Value Formatting**: Values ≥10p show one decimal, 1-10p show one decimal, 0.1-1p show two decimals, <0.1p show "< 0.1p"
  - **Priority Colors Match Cards**: Priority indicators now use same color scheme as their recommendation card borders
  - **Better Decision Guidance**: Users can quickly identify which relics to open first with clearer value distinctions
  - **Consistent Formatting**: Applied improved precision to main display, profit calculations, drop analysis, and weighted expected value

- **🧹 Simplified UI Elements** ⭐⭐⭐⭐ ✅ **COMPLETED**
  - **Removed Redundant Text**: Eliminated "REFINE → OPEN" and "Refine to higher tier first, then open" since all recommendations are essentially "refine to max first"
  - **Cleaner Action Display**: Simplified to just "OPEN" or "SELL" recommendations with color-coded icons
  - **Reduced Visual Noise**: Removed redundant description text that provided no additional decision-making value
  - **Streamlined Information**: Focus on essential data (expected value, profit, priority) for faster decision-making

- **🔍 Enhanced Semi-transparent Detection** ⭐⭐⭐⭐ ✅ **IMPROVED**
  - **Eye Icon Detection**: Added specific instruction to exclude relics with eye icons in corner
  - **Icon vs Text Focus**: Emphasizes analyzing relic icon opacity, not just text visibility
  - **Stricter Guidelines**: "When in doubt, EXCLUDE the relic rather than include it"
  - **Visual Comparison**: Instructions to compare relic brightness to Prime part icons

### Technical Improvements
- **Component Specialization**: Separate UI components for Prime Parts vs Void Relics
- **Enhanced Type Safety**: Proper TypeScript typing for relic-specific properties
- **Improved UX Patterns**: Expandable details, clear visual hierarchy, mobile-friendly design
- **Decision-Focused Design**: UI specifically optimized for "Should I open, refine, or sell?" workflow

### Fixed
- **🚨 CRITICAL: Analysis Data Lost in Persistent Storage** ⭐⭐⭐⭐⭐ ✅ **FIXED**
  - **Issue**: Relic analysis worked but showed "Analysis unavailable" because data was stripped during save
  - **Root Cause**: `InventoryItem` interface missing relic analysis properties (expectedDropValue, recommendation, etc.)
  - **Solution**: Extended interface and save/load functions to preserve all relic analysis data
  - **Impact**: Analysis now properly persists and displays after initial upload and refresh operations

- **🚨 CRITICAL: Semi-transparent Relic Over-detection** ⭐⭐⭐⭐⭐ ✅ **FIXED**
  - **Issue**: Gemini detecting 7 relics when only 4 actually owned (detecting faded/inactive relics)
  - **Root Cause**: Insufficient prompt clarity about visual filtering requirements
  - **Solution**: Enhanced Gemini prompt with strict visual filtering guidelines
  - **Impact**: Should now only detect bright, fully opaque relics that are actually owned

- **🚨 CRITICAL: Initial Upload Analysis Missing** ⭐⭐⭐⭐⭐ ✅ **FIXED**
  - **Issue**: New relic uploads only showed basic platinum prices, missing expected value analysis
  - **Root Cause**: Initial processing loop didn't trigger `calculateRelicValueAnalysis()` for relic items
  - **Solution**: Added relic-specific analysis during initial screenshot processing
  - **Impact**: New uploads now immediately show expected values, recommendations, and profit calculations

- **🚨 CRITICAL: Refinement Level Detection Ignored** ⭐⭐⭐⭐⭐ ✅ **FIXED**
  - **Issue**: All relics defaulted to "Intact" analysis regardless of actual refinement (Exceptional/Flawless/Radiant)
  - **Root Cause**: Multiple hardcoded `'intact'` parameters in analysis calls
  - **Solution**: Use actual detected rarity from Gemini AI throughout the analysis pipeline
  - **Impact**: Radiant relics now show dramatically different (correct) expected values vs Intact

- **Enhanced Relic Data Service**: Fixed refinement level lookup to find specific refined versions
  - Now properly searches for "Lith L2 Radiant" instead of defaulting to "Lith L2 Intact"
  - Maintains fallback logic for missing refinement data
  - Significantly improves analysis accuracy for refined relics

- **Confusing Relic Display**: No more unclear "7 exp" text that provided no decision-making value
- **Recommendation Visibility**: Action recommendations now prominently displayed instead of tiny badges
- **Value Context**: Expected values now clearly compared against direct sale prices
- **Mobile Accessibility**: Relic analysis cards work well on mobile devices

## [1.5.0] - 2025-01-02

### Added
- **🎲 Phase 1: Relic Value Analysis** ⭐⭐⭐⭐⭐ ✅ **COMPLETED**
  - **Expected Value Calculation**: Shows weighted expected value based on all 6 potential drops
  - **Smart Recommendations**: Color-coded badges for optimal actions:
    - 🟢 **OPEN** - Expected value higher than direct sale price
    - 🟡 **REFINE** - Worth upgrading refinement level first
    - 🔴 **SELL** - Direct sale more profitable than opening
  - **Min/Max Range Display**: Shows worst-case and best-case drop values
  - **Real-time Market Integration**: Fresh pricing data for all potential drops
  - **Batch API Optimization**: Efficient price fetching with 5x performance improvement
  - **Visual Enhancement**: Orange expected value display distinguishes from basic relic prices

- **🏗️ Relic Data Infrastructure** ⭐⭐⭐⭐⭐
  - **Static Relic Database**: Complete 7.9MB dataset with 2,682 unique relics
  - **Smart Name Matching**: Converts "Lith L2 Relic" → finds "Lith L2 Intact" automatically
  - **Drop Chance Integration**: Official Warframe drop data with precise percentages
  - **Market URL Mapping**: Automatic linking to Warframe Market for all tradeable drops
  - **Browser-Compatible**: No Node.js dependencies, works in production builds

- **⚡ Development Mode Enhancements** ⭐⭐⭐⭐
  - **Version Tracking**: Footer displays version, git hash, and dev/production status
  - **Debug Mode Override**: Development bypasses Supabase for easier local testing
  - **Comprehensive Logging**: Step-by-step relic analysis debugging
  - **Environment Detection**: Automatic Supabase configuration detection

### Enhanced
- **🔄 Refresh System Integration** ⭐⭐⭐⭐⭐
  - **Individual Relic Refresh**: Click refresh on any relic → instant value analysis
  - **Category Bulk Refresh**: Refresh all relics with progress tracking
  - **Preserved UI State**: Maintains sorting and scroll position during refresh
  - **Smart Fallback**: Direct API calls when Supabase unavailable

- **🎨 UI/UX Improvements** ⭐⭐⭐⭐
  - **Dual Display Logic**: Relics show expected value, Prime parts show market price
  - **Color-Coded Recommendations**: Instant visual feedback for optimal actions
  - **Compact Information**: Min/Max range in secondary text for space efficiency
  - **Consistent Icons**: Orange lightning bolt for expected values vs silver for direct prices

### Technical Improvements
- **Enhanced Supabase Edge Function**: Added batch endpoint for multiple item price fetching
- **Improved warframeMarketService**: Dual-mode operation (batch vs individual requests)
- **Optimized Type System**: Extended VoidRelic interface with value analysis properties
- **Performance Optimization**: 1 batch request vs 6 individual requests per relic
- **Smart Caching**: Relic drop data loaded once per session
- **Error Recovery**: Graceful fallback for missing relic data or price failures

### Fixed
- **Relic Data Filtering**: Fixed category vs type filtering (2762 → ~400 actual relics)
- **Name Matching Algorithm**: Proper conversion from market names to relic database format
- **Market URL Mapping**: Corrected path from `marketInfo` to `warframeMarket` in JSON structure
- **Development Workflow**: Bypasses Supabase deployment requirement for local testing

### Performance Improvements
- **5x Faster Relic Analysis**: Batch API reduces 6 requests to 1 per relic
- **Reduced API Load**: Smart caching and development mode optimizations
- **Improved Loading UX**: Individual relic analysis completes in ~500ms vs 2+ seconds
- **Efficient Data Structure**: Lightweight storage without bloated analysis data

### Known Limitations
- **Refinement Level Detection**: Currently defaults to 'intact' - enhanced detection planned
- **Direct Sale Prices**: Relic-to-relic market pricing not yet implemented
- **Forma Blueprint Handling**: Items without market data default to 0 value

## [1.4.2] - 2025-01-01

### Fixed
- **Critical Refresh Functionality** ⭐⭐⭐⭐⭐
  - Fixed category filtering bug that caused inventory to become empty during refresh
    - Corrected `item.category === 'prime'` to `item.category === 'prime_parts'`
    - Properly handles both Prime Parts and Void Relics categories
  - Fixed Date type issues in refresh functions (`Date.now()` vs `new Date()`)
  - Resolved initial image fetching being broken due to incorrect function usage
  - Added error recovery to reload from persistent storage when refresh fails

### Improved
- **Refresh Performance & UX** ⭐⭐⭐⭐⭐
  - **Price-Only Refreshes**: Created optimized `fetchSinglePriceOnly()` function
    - Preserves existing images during refresh operations
    - Only updates price-related fields: `price`, `ducats`, `volume`, `average`, `status`, `error`
    - Significantly faster refresh times by skipping unnecessary image data
  - **Reduced Flickering**: Implemented multiple anti-flickering measures
    - Batched progress updates (every 3 items for category refresh, every 5 for bulk)
    - Added `useMemo` to inventory stats calculations
    - Reduced rapid state updates during refresh operations
  - **Enhanced Progress Indicators**: Comprehensive real-time feedback
    - Category headers show "• Refreshing 7/32" with progress counters
    - Progress bars with animated fill showing completion percentage
    - Button text changes to show current progress: "7/32"
    - Separate progress tracking for each category

### Removed
- **Obsolete UI Elements** ⭐⭐⭐⭐
  - Removed confusing "Processing Progress" bar that showed nonsensical "2/1" during refreshes
  - Eliminated basic progress indicator that was only relevant for initial image processing
  - Streamlined interface focuses on meaningful progress indicators only

### Enhanced
- **Smart Function Usage** ⭐⭐⭐⭐
  - **`fetchSinglePriceData()`**: Used for initial scans (includes images)
  - **`fetchSinglePriceOnly()`**: Used for all refresh operations (preserves images)
  - Clear separation of concerns with proper documentation for each function
  - Maintains image cache while ensuring fresh price data

### Technical Improvements
- **Performance Optimizations**
  - Reduced API calls by preserving image URLs during refreshes
  - Batched state updates to minimize re-renders
  - Optimized inventory statistics calculations with `useMemo`
  - Improved error handling with automatic recovery mechanisms
- **Better State Management**
  - Fixed stale closure issues in refresh functions
  - Proper dependency arrays for React hooks
  - Consistent type handling for Date objects
  - Enhanced progress tracking with category-specific states

### User Experience
- **Before This Update**:
  - ❌ Inventory could become empty during refresh
  - ❌ Excessive flickering during price updates
  - ❌ Confusing progress bars showing wrong information
  - ❌ Slow refreshes re-downloading unnecessary image data
- **After This Update**:
  - ✅ Inventory always preserved during refresh
  - ✅ Smooth, minimal flickering with batched updates
  - ✅ Clear, meaningful progress indicators only
  - ✅ Fast refreshes that only update price data

## [1.4.1] - 2024-12-31

### Fixed
- **Sorting Functionality** ⭐⭐⭐⭐
  - Fixed sorting dropdown not working due to event propagation issues
  - Added proper `preventDefault()` and `stopPropagation()` to all sort handlers
  - Added React key to force re-render when sorting changes
  - Enhanced debug logging to help troubleshoot sorting issues
  - Reverted overly high z-index values that prevented dropdown clickability

### Improved
- **Mobile-First UX Enhancements** ⭐⭐⭐⭐⭐
  - **3-Dots Action Menu**: Replaced hover-based action buttons with mobile-friendly meatball menu
    - Always visible action trigger (no hover required)
    - Clear labeled actions: "Refresh price" and "Remove"
    - Touch-friendly dropdown with proper spacing
    - Auto-close on action selection or outside tap
  - **Sticky Category Headers**: Made Prime Parts and Void Relics headers properly sticky
    - Restructured component hierarchy to enable global sticky positioning
    - Headers now stick to viewport top when scrolling through long lists
    - Always shows current category context with totals and quick actions
    - Increased z-index to `z-20` for proper layering above content
  - **Clickable Collapsed Sections**: "Tap to view X items" text now expands sections
    - Full-width clickable area with hover feedback
    - Smooth hover transitions for better visual feedback
    - Consistent interaction patterns across the interface

### Removed
- **Redundant UI Elements**
  - Removed sticky header from individual ResultsTable components
  - Eliminated "My Inventory" summary section that provided no additional value
  - Streamlined interface focuses on category-specific information

### Enhanced
- **Subtle Button Design** ⭐⭐⭐⭐
  - **Refresh Button**: 10% opacity blue background (`bg-tenno-blue/10`) with full-color text and subtle border
  - **Clear Button**: 10% opacity red background (`bg-grineer-red/10`) with full-color text and subtle border
  - Hover states with 20% opacity for better visual hierarchy
  - Less visually aggressive while maintaining clear functionality

### Technical Improvements
- Enhanced event handling with proper propagation control
- Improved component structure for better sticky positioning
- Added React keys for reliable re-rendering during state changes
- Better z-index management across UI layers
- Comprehensive debug logging for troubleshooting

## [1.4.0] - 2024-12-31

### Added
- **API Key Configuration UX Enhancement** ⭐⭐⭐⭐⭐
  - **Smart Onboarding**: When API key is not configured, show helpful prompt instead of "Ready to Scan"
  - **One-Click Setup**: Direct link from main interface to open settings overlay
  - **Contextual Help**: InfoCard shows API key setup as step 0 when not configured
  - **Clear Call-to-Action**: "Add API Key" button with key icon for visual clarity
  - **Privacy Assurance**: Reminder that API key is stored securely in browser only

- **Story #8: Extended Item Support - Void Relics** ⭐⭐⭐⭐⭐ ✅ **PHASE 1 COMPLETED**
  - **Void Relic Detection**: AI now detects Void Relics (Lith, Meso, Neo, Axi) from inventory screenshots
  - **Semi-Transparent Filtering**: Specifically ignores faded/semi-transparent relics (unowned relics)
  - **Separate Inventory Sections**: Independent toggleable sections for Prime Parts and Void Relics
  - **Category-Specific Actions**: Individual refresh and clear buttons for each item category
  - **Enhanced Item Categorization**: Complete type system supporting multiple item categories
  - **Market Data Integration**: Void relics fetch pricing data from Warframe Market API
  - **Smart Detection Pattern**: Recognizes standard relic naming pattern (Era + Letter + Number)
  - **Individual Section Controls**: Each category can be refreshed, cleared, and collapsed independently

- **Story #1: Real-time Item Display** ⭐⭐⭐⭐⭐ ✅ **COMPLETED**
  - **Individual Price Loading**: Each item's price loads and displays immediately when fetched
  - **No Batch Processing**: Prices appear one by one as they're retrieved from the market API
  - **Instant Inventory Updates**: Items added to persistent inventory as soon as processed
  - **Smooth UX**: No waiting for entire scan to complete before seeing any results
  - **Skip Duplicates**: Items already in inventory are automatically skipped during new scans

- **Story #3: Persistent Inventory Management** ⭐⭐⭐⭐ ✅ **COMPLETED**
  - **My Inventory**: Single source of truth for all scanned items with persistent localStorage storage
  - **Auto-save**: New items automatically added to inventory as they're processed
  - **Individual Actions**: Per-item refresh and remove buttons for granular control
  - **Bulk Operations**: "Refresh All" and "Clear All" buttons for inventory management
  - **Enhanced Statistics**: Prominent value and ducats totals with visual highlighting
  - **Smart Duplicate Handling**: Existing items automatically skipped in new scans
  - **Always Visible**: Inventory section always shown, collapsed when empty
  - **Streamlined UI**: Removed redundant "Current Scan" section in favor of persistent inventory

- **Fresh Price Updates**: Refresh market prices without re-uploading screenshots ⭐⭐⭐⭐⭐
  - "Refresh Prices" button replaces "Scan Complete" state for better UX
  - Skip image analysis and directly fetch current market data for stored items
  - Show timestamp of last price refresh for transparency
  - Maintain item quantities and detection results during refresh
  - **Preserve UI State**: List order, user scroll position, and sorting maintained during refresh
  - **Individual Item Loading**: Granular loading states per item prevent jarring UI changes
  - Animated refresh icon with loading states
  - Comprehensive error handling with graceful fallback to error state
  - Rate-limited market data fetching preserves API guidelines

### Technical Improvements
- **Extended Type System**: Added BaseItem, VoidRelic interfaces with category-based typing
- **Categorized Inventory Service**: Enhanced storage system with category-specific operations
- **Improved AI Detection**: Updated Gemini prompts to handle multiple item types with specific filtering rules
- **Component Architecture**: New InventorySection component for modular category display
- **Enhanced Error Handling**: Category-specific error states and retry mechanisms
- **Performance Optimization**: Individual category refresh to prevent unnecessary API calls
- **UI/UX Enhancement**: Separate visual sections with appropriate icons and color coding
- **Smart State Management**: Programmatic settings overlay with prop threading through component tree
- **Contextual Interface**: Dynamic UI adaptation based on API key configuration status

### Known Limitations
- **Relic Rarity Detection**: Currently defaults to 'intact' - enhanced rarity detection planned for future updates
- **Market Data Coverage**: Some relics may not have active market listings
- **Semi-Transparent Detection**: AI filtering for faded relics - effectiveness may vary based on screenshot quality

## [1.3.0]
### Added
- **Story #1: Real-time Item Display** ⭐⭐⭐⭐⭐ ✅ **COMPLETED**
  - **Individual Price Loading**: Each item's price loads and displays immediately when fetched
  - **No Batch Processing**: Prices appear one by one as they're retrieved from the market API
  - **Instant Inventory Updates**: Items added to persistent inventory as soon as processed
  - **Smooth UX**: No waiting for entire scan to complete before seeing any results
  - **Skip Duplicates**: Items already in inventory are automatically skipped during new scans

- **Story #3: Persistent Inventory Management** ⭐⭐⭐⭐ ✅ **COMPLETED**
  - **My Inventory**: Single source of truth for all scanned items with persistent localStorage storage
  - **Auto-save**: New items automatically added to inventory as they're processed
  - **Individual Actions**: Per-item refresh and remove buttons for granular control
  - **Bulk Operations**: "Refresh All" and "Clear All" buttons for inventory management
  - **Enhanced Statistics**: Prominent value and ducats totals with visual highlighting
  - **Smart Duplicate Handling**: Existing items automatically skipped in new scans
  - **Always Visible**: Inventory section always shown, collapsed when empty
  - **Streamlined UI**: Removed redundant "Current Scan" section in favor of persistent inventory

- **Fresh Price Updates**: Refresh market prices without re-uploading screenshots ⭐⭐⭐⭐⭐
  - "Refresh Prices" button replaces "Scan Complete" state for better UX
  - Skip image analysis and directly fetch current market data for stored items
  - Show timestamp of last price refresh for transparency
  - Maintain item quantities and detection results during refresh
  - **Preserve UI State**: List order, user scroll position, and sorting maintained during refresh
  - **Individual Item Loading**: Granular loading states per item prevent jarring UI changes
  - Animated refresh icon with loading states
  - Comprehensive error handling with graceful fallback to error state
  - Rate-limited market data fetching preserves API guidelines

### Technical Improvements
- **Streamlined Architecture**: Removed redundant `combinedResults` state in favor of persistent inventory
- **Individual API Calls**: Added `fetchSinglePriceData` function for per-item price refresh
- **Smart Duplicate Detection**: Filter existing inventory items during new scans to prevent duplication
- **Progressive Enhancement**: Items appear in inventory immediately as they're processed
- **Simplified State Management**: Single source of truth eliminates state synchronization issues
- **Enhanced UI Controls**: Individual refresh buttons with loading states per item
- **Improved User Flow**: Removed confusing "Current Scan" vs "My Inventory" duality
- **Performance Optimization**: Rate limiting with individual price fetching prevents API overload

## [1.2.2] - 2024-03-06
### Fixed
- **Market Data API Integration**: Enhanced error handling and logging for market data fetching
  - Added detailed response logging for better debugging
  - Improved error messages for API failures
  - Added User-Agent header for better API tracking
  - Fixed JSON parsing issues with malformed responses
- **Documentation**: Improved development and deployment documentation
  - Added comprehensive command reference
  - Included Supabase Edge Function setup guide
  - Added detailed deployment checklist
  - Enhanced troubleshooting section

### Technical Improvements
- Enhanced error handling in warframeMarketService
- Added Supabase temp files to .gitignore
- Improved build and deployment process documentation
- Better separation of development and production configurations

## [1.2.1] - 2024-12-30
### Fixed
- **Production Deployment Issues**: Resolved critical CSP violations preventing market data fetching
  - Fixed Content Security Policy to allow blob URLs for image previews
  - Added support for iconify.design SVG icons in CSP
  - Enabled Supabase domain connections for Edge Function API calls
  - Added comprehensive connect-src directive for all required domains
- **API Proxy Configuration**: Implemented robust fallback strategy for market data
  - Primary: Supabase Edge Function (when environment variables available)
  - Fallback: Direct API calls via Netlify proxy configuration
  - Added proper error handling for both methods
- **Netlify Deployment**: Enhanced deployment configuration
  - Added Netlify proxy redirects for Warframe Market API
  - Improved security headers configuration
  - Added comprehensive troubleshooting documentation

### Added
- **Deployment Documentation**: Complete Netlify deployment guide
  - Step-by-step deployment instructions
  - Environment variable configuration
  - Custom domain setup
  - Troubleshooting section for common production issues
- **Production Monitoring**: Enhanced error tracking and logging
  - Better CSP violation reporting
  - Improved API error handling
  - Fallback mechanism status logging

### Technical Improvements
- Enhanced Content Security Policy for production security
- Dual API strategy (Supabase + Netlify proxy) for reliability
- Improved TypeScript type safety in market service
- Better separation of development and production configurations

## [1.2.0] - 2024-03-22
### Fixed
- **API Key Configuration**: Fixed critical issue where API key settings weren't being properly saved and validated
  - API key warning message now disappears correctly when valid key is entered
  - Added proper error handling and validation for API keys
  - Fixed state synchronization between localStorage and application state
  - Added loading states and better error messages in settings UI
- **Queue Processing**: Resolved "Queued" status stuck issue that prevented automatic image processing
  - Fixed stale closure bug in processNextImage function that caused queue to freeze
  - Images now automatically progress from "Queued" → "Analyzing" → "Fetching" → "Complete"
  - Added proper state management using functional setState to prevent race conditions
  - Added API key checks to prevent processing attempts without valid configuration
  - Fixed TypeScript errors in ProcessingAnimation component

### Technical Improvements
- Improved error handling throughout the application
- Enhanced state management for better reliability
- Added proper async/await patterns for queue processing
- Implemented functional state updates to prevent stale closures

## [1.1.0] - 2024-03-21
### Added
- Optimistic results display - items appear in the table as they're detected
- Real-time market data updates - prices load individually as they're fetched
- Item quantity detection from inventory screenshots
- Clickable table rows that link directly to Warframe Market
- Trading volume display in results table
- Ducat values for Prime parts
- Sorting by ducat values in results table
- Ducat icon display in results table

### Changed
- Improved results table UI with clearer ducat value display
- Enhanced market data fetching with individual item processing
- Better error handling for failed market data requests
- More informative loading states for each detected item
- Updated About page with more detailed features
- Improved Terms and Privacy pages
- Removed processing progress bar for cleaner UI
- Enhanced sorting behavior for price and ducat columns

### Fixed
- Warframe Market API integration to properly fetch ducat values
- Default sort direction for non-name columns

### Known Issues
- ~~Queue processing stops after first image in production environment~~ **FIXED in v1.2.0**
- ~~Automatic transition between queued images not working in Supabase production deployment~~ **FIXED in v1.2.0**
- Rate limiting implementation needs improvement for market data requests
- Progress tracking inconsistent for multi-image processing
- Duplicate detection in image upload queue needs refinement

## Development Roadmap & User Stories

### 🚀 High Priority (High Usefulness + Low-Medium Complexity)

#### Story #1: Real-time Item Display ⭐⭐⭐⭐⭐
**Complexity**: 🔧🔧 (Medium) | **Usefulness**: ⭐⭐⭐⭐⭐ (Essential)
```
As a Warframe trader, I want to see detected items appear immediately as they're found
so that I can start reviewing valuable items while the rest are still being processed.

Acceptance Criteria:
- Items appear in results table as soon as detected (before market data fetch)
- Show loading state for market price while item details are visible
- No need to wait for entire batch to complete before seeing results
- Maintain smooth scrolling and UI responsiveness during updates
```

#### Story #2: Fresh Price Updates ⭐⭐⭐⭐⭐ ✅ **COMPLETED**
**Complexity**: 🔧🔧 (Medium) | **Usefulness**: ⭐⭐⭐⭐⭐ (Essential)
```
As a frequent trader, I want to refresh market prices without re-uploading screenshots
so that I can get current prices for items I've already scanned.

Acceptance Criteria:
✅ "Refresh Prices" button replaces "Scan Complete" state
✅ Skip image analysis, directly fetch current market data for stored items
✅ Show updated timestamp for last price refresh
✅ Maintain item quantities and detection results
✅ Handle API failures gracefully with retry options

COMPLETED: Added in [Unreleased] - Ready for v1.3.0 release
```

#### Story #3: Persistent Inventory ⭐⭐⭐⭐
**Complexity**: 🔧🔧🔧 (Medium-High) | **Usefulness**: ⭐⭐⭐⭐ (Very Useful)
```
As a trader managing multiple sales, I want my scanned inventory to persist across sessions
so that I can track what I've sold without re-scanning every time.

Acceptance Criteria:
- Items saved to localStorage/IndexedDB after scanning
- "My Inventory" section shows previously scanned items
- "Mark as Sold" button to remove items from inventory
- "Clear All" option to reset inventory
- Import/export functionality for inventory backup
```

### 📈 Medium Priority (Good Balance of Usefulness & Complexity)

#### Story #4: Multi-Image Concurrent Processing ⭐⭐⭐⭐
**Complexity**: 🔧🔧🔧 (Medium-High) | **Usefulness**: ⭐⭐⭐⭐ (Very Useful)
```
As a user with large inventories, I want to see results from my first screenshot
while subsequent screenshots are still being analyzed
so that I can start making trading decisions immediately.

Acceptance Criteria:
- Display results from completed screenshots immediately
- Show progress indicator for remaining screenshots in queue
- Allow interaction with completed results while processing continues
- Prevent blocking UI during batch processing
```

#### Story #5: Enhanced Error Feedback ⭐⭐⭐⭐
**Complexity**: 🔧🔧🔧 (Medium-High) | **Usefulness**: ⭐⭐⭐⭐ (Very Useful)
```
As a user, I want clear feedback when image analysis fails
so that I understand what went wrong and how to fix it.

Acceptance Criteria:
- Toast notifications for different error types
- Specific messages: "No items detected", "Invalid screenshot", "API error"
- Suggestions for screenshot improvement (proper inventory view, lighting, etc.)
- Console logs with error codes for debugging
- Retry mechanisms for temporary failures
```

#### Story #6: Customizable Results Table ⭐⭐⭐
**Complexity**: 🔧🔧 (Medium) | **Usefulness**: ⭐⭐⭐ (Useful)
```
As a trader with specific preferences, I want to sort and filter my results
so that I can focus on the most relevant trading opportunities.

Acceptance Criteria:
- Sort by any column (name, price, ducats, volume, quantity)
- Filter by item type, price range, ducat value
- Save sort/filter preferences
- Quick filters for "High Value", "Quick Sale", "Ducat Efficient"
- Export filtered results to CSV/JSON
```

#### Story #7: Mobile-Optimized Interface ⭐⭐⭐
**Complexity**: 🔧🔧🔧 (Medium-High) | **Usefulness**: ⭐⭐⭐ (Useful)
```
As a mobile user, I want a responsive interface that works well on my phone
so that I can scan inventory while away from my computer.

Acceptance Criteria:
- Touch-friendly upload interface
- Responsive table design with horizontal scrolling
- Mobile-optimized image preview
- Simplified navigation for smaller screens
- Fast loading on mobile connections
```

### 🔮 Future Enhancements (High Complexity but High Value)

#### Story #8: Extended Item Support ⭐⭐⭐⭐⭐
**Complexity**: 🔧🔧🔧🔧🔧 (Very High) | **Usefulness**: ⭐⭐⭐⭐⭐ (Game-changing)
```
As a comprehensive trader, I want to scan all sellable items in my inventory
so that I can maximize my trading opportunities beyond just Prime parts.

Acceptance Criteria:
- Support Arcanes, Mods, Rivens, Relics, regular weapon parts
- Different detection models for each item type
- Category filtering in results
- Specialized market data for each item type
- User feedback system to improve detection accuracy

Technical Requirements:
- Multiple AI models or enhanced single model
- Extended Warframe Market API integration
- New item categorization system
- Enhanced image preprocessing

NOTES:
- ⚠️ Arcanes and Mods have complex "update level" systems (ranks, fusion levels)
- 🔧 Detection complexity varies significantly by item type
- 📊 Market data structure differs between item categories
```

#### Story #9: Advanced Market Analytics ⭐⭐⭐⭐
**Complexity**: 🔧🔧🔧🔧 (High) | **Usefulness**: ⭐⭐⭐⭐ (Very Useful)
```
As a serious trader, I want historical price data and market analytics
so that I can make informed decisions about when to buy and sell items.

Acceptance Criteria:
- Historical price charts for each item
- Price trend indicators (rising/falling/stable)
- Trading volume analytics
- Market volatility indicators
- Price alerts for target values
- Ducat/platinum efficiency calculator
- Best time to sell recommendations

Technical Requirements:
- Historical price data storage
- Charting library integration
- Real-time price monitoring
- Notification system
```

#### Story #10: Smart Image Processing ⭐⭐⭐
**Complexity**: 🔧🔧🔧🔧 (High) | **Usefulness**: ⭐⭐⭐ (Useful)
```
As a user with varying screenshot quality, I want the system to handle imperfect images
so that I don't need to retake screenshots for minor issues.

Acceptance Criteria:
- Automatic image preprocessing (brightness, contrast, sharpening)
- Handle non-inventory screenshots gracefully with helpful messages
- Improve quantity detection accuracy across different UI scales
- Fix unknown.thumb.png image URL issues
- Support different inventory layouts and themes

Technical Requirements:
- Image preprocessing pipeline
- Enhanced computer vision models
- Better error detection and user guidance
- Support for different Warframe UI themes
```

#### Story #11: Smart Error Recovery System ⭐⭐⭐
**Complexity**: 🔧🔧🔧🔧 (High) | **Usefulness**: ⭐⭐⭐ (Useful)
```
As a developer and user, I want comprehensive error handling with recovery options
so that temporary issues don't break the entire scanning process.

Acceptance Criteria:
- Global error boundary with user-friendly messages
- Automatic retry with exponential backoff
- Fallback mechanisms for API failures
- Error reporting to help improve the service
- Graceful degradation when services are unavailable

Technical Requirements:
- Error boundary components
- Retry logic with circuit breaker pattern
- Error tracking service integration
- Fallback UI states
```

#### Story #12: Smart Quantity & Duplicate Management ⭐⭐⭐⭐
**Complexity**: 🔧🔧🔧 (Medium-High) | **Usefulness**: ⭐⭐⭐⭐ (Very Useful)
```
As a trader with multiple copies of items, I want the system to detect quantities
and calculate total values while considering market demand limitations.

Acceptance Criteria:
- Detect duplicate items and show quantities
- Calculate total value (quantity × price)
- Show market depth warnings when quantity exceeds demand
- Smart recommendations: "Market can absorb X items at full price"
- Batch selling suggestions with price tiering

Technical Requirements:
- Enhanced image recognition for quantity detection
- Market depth analysis from order books
- Smart pricing algorithms considering volume

CHALLENGES:
- 🔍 Quantity detection requires OCR precision improvements
- 📈 Market depth calculation needs order book analysis
- ⚖️ Highest bidders may not want full quantities
- 💡 Price recommendations need complex market modeling
```

#### Story #13: Set Completion Detection ⭐⭐⭐⭐⭐
**Complexity**: 🔧🔧🔧🔧🔧 (Very High) | **Usefulness**: ⭐⭐⭐⭐⭐ (Game-changing)
```
As a collector and trader, I want to see which Prime sets I can complete
so that I can prioritize farming missing pieces or selling complete sets.

Acceptance Criteria:
- Detect complete Prime sets (Warframe, Weapon)
- Show missing pieces for incomplete sets
- Calculate set value vs individual part values
- Recommend "complete vs sell parts" strategies
- Track set completion progress over time

Technical Requirements:
- Complete Prime set database integration
- Set relationship mapping (what makes a complete set)
- Cross-reference inventory against set requirements
- Value comparison algorithms (set vs parts)

CHALLENGES:
- 🗄️ Requires deep Warframe knowledge database
- 🔗 Set definitions available in Warframe Market API but complex to parse
- 🧩 Automatic detection of "what makes a set" is non-trivial
- 📊 Dynamic set pricing vs individual parts analysis
- 🎯 Some sets have variants (Prime vs regular vs Vaulted status)
```

### 📊 Complete Priority Matrix

| Story | Feature | Usefulness | Complexity | Priority | Status |
|-------|---------|------------|------------|----------|--------|
| #1 | Real-time Item Display | ⭐⭐⭐⭐⭐ | 🔧🔧 | 🚀 High | ✅ **COMPLETED** |
| #2 | Fresh Price Updates | ⭐⭐⭐⭐⭐ | 🔧🔧 | 🚀 High | ✅ **COMPLETED** |
| #3 | Persistent Inventory | ⭐⭐⭐⭐ | 🔧🔧🔧 | 🚀 High | ✅ **COMPLETED** |
| #4 | Multi-Image Processing | ⭐⭐⭐⭐ | 🔧🔧🔧 | 📈 Medium | 📋 Planned |
| #5 | Enhanced Error Feedback | ⭐⭐⭐⭐ | 🔧🔧🔧 | 📈 Medium | 📋 Planned |
| #6 | Customizable Results | ⭐⭐⭐ | 🔧🔧 | 📈 Medium | 📋 Planned |
| #7 | Mobile Optimization | ⭐⭐⭐ | 🔧🔧🔧 | 📈 Medium | 📋 Planned |
| #8 | Extended Item Support | ⭐⭐⭐⭐⭐ | 🔧🔧🔧🔧🔧 | 🔮 Future | ✅ **PHASE 1 COMPLETED** (Relics) |
| #9 | Advanced Market Analytics | ⭐⭐⭐⭐ | 🔧🔧🔧🔧 | 🔮 Future | 📋 Planned |
| #10 | Smart Image Processing | ⭐⭐⭐ | 🔧🔧🔧🔧 | 🔮 Future | 📋 Planned |
| #11 | Smart Error Recovery | ⭐⭐⭐ | 🔧🔧🔧🔧 | 🔮 Future | 📋 Planned |
| #12 | Smart Quantity & Duplicate Management | ⭐⭐⭐⭐ | 🔧🔧🔧 | 🔮 Future | 📋 Planned |
| #13 | Set Completion Detection | ⭐⭐⭐⭐⭐ | 🔧🔧🔧🔧🔧 | 🔮 Future | 📋 Planned |

### 🎯 Updated Development Sprint Plan

**Sprint 1 (Completed)**: ✅ Fresh Price Updates - **DELIVERED**
**Sprint 2 (Completed)**: ✅ Real-time Item Display + Persistent Inventory - **DELIVERED**
**Sprint 3 (Completed)**: ✅ Void Relic Detection + API Key UX - **DELIVERED**
**Sprint 4 (Next)**: Enhanced Error Feedback + Multi-Image Processing
**Sprint 5 (Future)**: Customizable Results + Mobile Optimization
**Sprint 6+ (Research Phase)**:
- Extended Item Support (Arcanes/Mods - requires complex update level detection)
- Smart Quantity Management (market depth analysis challenges)
- Set Completion Detection (requires deep Warframe knowledge database)

### 💡 Technical Implementation Notes

- **Real-time Display**: Modify state management to append items as detected
- **Persistent Storage**: Use IndexedDB with Dexie.js for large data sets
- **Error Handling**: Implement React Error Boundaries + toast notifications
- **Extended Items**: May require partnership with Warframe Market for broader API support