# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Warframe Trading Rules

### Prime Parts Trading Restrictions
- **Only BLUEPRINTS are tradeable** - Built/crafted parts cannot be traded
- Example: `Acceltra Prime Blueprint` ✅ tradeable vs `Acceltra Prime Receiver` ❌ not tradeable (built part)
- The Prime Parts inventory section only tracks tradeable blueprints for market value
- Built parts still count toward Prime Set completion but have no market value

## Development Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# GitHub CLI commands for deployment management
gh workflow list                                    # List all workflows
gh run list --workflow="Deploy Supabase Edge Functions"  # List recent runs
gh run rerun <RUN_ID>                              # Retry a failed workflow
gh run watch <RUN_ID>                              # Watch a run in real-time
gh run view <RUN_ID> --log-failed                  # View failed run logs
```

## Project Architecture

This is a React-based Warframe inventory scanner that uses AI to analyze screenshots of Prime parts and Void relics. The application has a well-structured service-oriented architecture:

### Core Services Architecture

The application is built around several key services located in `src/services/`:

- **geminiService.ts**: Handles Google Gemini Vision API integration for image analysis using Gemini 2.5 Flash model. Uses multi-step analysis: first determines screen type (prime_parts/relics/syndicate), then applies specialized prompts for each category.
- **syndicateService.ts**: Manages Syndicate reward data with user-specific storage, intelligent item type detection, and standing cost estimation for owned items
- **warframeMarketService.ts**: Integrates with Warframe.market API for real-time pricing data
- **unifiedImageService.ts**: Manages local image assets for Prime parts and relics to reduce CDN dependencies
- **inventoryService.ts**: Handles inventory data persistence and local storage management with intentional deletion tracking
- **relicDataService.ts**: Manages Void relic data including reward tables and value calculations
- **primeSetService.ts**: Handles Prime set tracking and completion calculations
- **cloudSyncService.ts**: Manages cross-device synchronization via Supabase with protection against restoring intentionally deleted data
- **buildPlanService.ts**: Handles build planning and tracking features
- **dataExportService.ts**: Manages data export functionality

### Component Structure

Key components in `src/components/`:

- **ImageUploader.tsx**: Handles drag-and-drop image uploads with processing queue
- **ResultsTable.tsx**: Displays Prime parts with pricing and market data
- **RelicResultsTable.tsx**: Shows Void relics with refinement analysis and recommendations
- **PrimeSetsSection.tsx**: Tracks Prime set completion and provides build recommendations
- **RelicAnalysisCard.tsx**: Displays detailed relic value analysis and refinement suggestions
- **SyndicateRewardsSection.tsx**: Displays syndicate rewards with market value analysis and plat/standing efficiency tracking
- **InventorySection.tsx**: Main inventory management interface
- **ApiKeySettings.tsx**: Handles Gemini API key configuration
- **CloudSyncSection.tsx**: Manages cloud synchronization settings

### Data Flow

1. Images are uploaded via ImageUploader
2. Gemini Vision API analyzes screenshots to detect items (Prime Parts, Relics, or Syndicate Rewards)
3. Detected items are sent to Warframe.market API for pricing
4. Results are displayed in specialized tables with value analysis
5. Data is persisted locally and optionally synced to cloud

### Key Features

- **Multi-image processing**: Queued batch processing with progress tracking
- **Relic value optimization**: Calculates expected values and refinement recommendations
- **Prime set tracking**: Monitors completion status and suggests builds
- **Syndicate reward analysis**: Market value analysis with plat/standing efficiency calculations
- **Cloud synchronization**: Cross-device inventory sync using Supabase
- **Local image assets**: Reduces external dependencies with bundled item images
- **Responsive design**: Mobile-first approach with touch-friendly interface

### Static Data Sources

The application uses local static data files to reduce external dependencies:

- **`public/primesets.json`**: Contains all Prime set definitions with component requirements and images. Each entry includes the Prime item name, category (warframe/primary/secondary/melee/etc.), image filename, and required components with quantities.
- **`public/relics.json`**: Contains comprehensive Void relic reward tables with drop chances and rarity information (7.7MB file with detailed reward data).
- **`public/images/primeparts/`**: Local images for all Prime parts, named to match the JSON data (e.g., `acceltra-prime-5628f3e466.png`).
- **`public/images/relics/`**: Local images for relic types by era and refinement level (e.g., `axi_radiant.png`, `lith_intact.png`).

This local data approach eliminates CDN dependencies and provides faster, more reliable access to item information and images.

### Supabase Edge Function

The `supabase functions deploy warframe-market` command deploys a critical Edge Function located at `supabase/functions/warframe-market/index.ts`. This function serves as:

- **API Rate Limiting**: Protects against Warframe.market API rate limits by implementing intelligent caching (5-minute cache duration)
- **Batch Processing**: Handles batch requests for relic value analysis (up to 10 items per request)
- **Error Handling**: Gracefully handles API failures and "item not found" responses
- **Performance Optimization**: Reduces direct API calls from the client, improving response times
- **CORS Support**: Enables cross-origin requests from the web application

The Edge Function is essential for production deployment as it provides a reliable intermediary between the client and Warframe.market API, preventing API abuse and improving user experience.

### External Dependencies

- Google Gemini Vision API for image analysis (Gemini 2.5 Flash via @google/genai SDK)
- Warframe.market API for pricing data (accessed via Supabase Edge Function)
- Supabase for cloud sync (optional) and Edge Functions
- React Router for navigation
- Tailwind CSS for styling
- Lucide React for icons

### Important Configuration

The app requires a Gemini API key to function, stored in localStorage. Cloud sync is optional and requires Supabase configuration. The app gracefully degrades when external services are unavailable.

### Development Notes

- The app uses TypeScript with strict typing
- All components are functional with React hooks
- Services are designed to be stateless and testable
- Error handling is comprehensive with user-friendly messages
- The architecture supports easy extension for new item types or analysis features

### Prime Part Image Service Bug Fix (2025-08-25)

#### Problem Resolution
- **Image display bug**: Fixed issue where prime parts with compound suffixes (like "Oberon Prime Neuroptics Blueprint") showed `/images/primeparts/unknown.png` instead of proper images
- **Root cause**: The `getParentSetName` function in `unifiedImageService.ts` only removed single suffixes, causing incorrect parent set name extraction
- **Example**: "Oberon Prime Neuroptics Blueprint" → extracted "Oberon Prime Neuroptics" instead of "Oberon Prime"

#### Technical Fix
- **Enhanced suffix removal algorithm**: Updated `getParentSetName` function to iteratively remove multiple suffixes until no more can be removed
- **Compound suffix handling**: Now properly handles items like "Neuroptics Blueprint", "Systems Blueprint", etc.
- **Algorithm improvement**: Uses a while loop to remove suffixes sequentially rather than just once
- **Files affected**: `src/services/unifiedImageService.ts`

#### User Impact
- **Fixed image display**: All prime parts now show correct parent set images instead of unknown.png placeholders  
- **Better visual experience**: Proper thumbnails help with item identification and inventory management
- **Consistent UI**: No more broken image displays across the prime parts inventory

### Built Sets Filter Enhancement (2025-08-24)

#### Prime Parts "Built Sets" Filter
- **New filter option**: Added "Built Sets" filter to Prime Parts section for identifying parts from completed sets
- **Smart completion detection**: Integrates with Prime Sets service to identify which sets are already built/mastered
- **Safe selling identification**: Shows parts that are safe to sell for ducats since the parent set is already completed
- **UI integration**: Filter appears as "Built Sets - Safe to Sell" with proper item count display
- **Files affected**: `src/components/InventorySection.tsx`, `src/services/primeSetService.ts`

### Prime Sets Enhancement & Owned Items System (2025-01-28)

#### Owned Items Management System
- **Distinction between inventory and owned items**: New system allows users to mark items as "owned" (keep for personal use) vs "in inventory" (available for trading)
- **Owned items service**: `src/services/ownedItemsService.ts` manages localStorage-based owned status tracking
- **Completion percentage accuracy**: Only truly owned items count toward set completion percentage
- **Flexible trading**: Users can sell complete sets even when parts are in inventory (if not marked as owned)
- **Visual indicators**: Clear color coding (green = owned, blue = in inventory, yellow = from relics, gray = missing)

#### Enhanced Progress Bar System
- **Multi-segment progress bars**: Shows different colored segments based on refinement levels needed for missing parts
- **Void trace cost sorting**: Progress bar segments sorted by total void trace cost (lowest to highest) for efficient farming prioritization
- **Refinement level colors**:
  - Yellow = Radiant (100 traces)
  - Blue = Flawless (50 traces)
  - Green = Exceptional (25 traces)
  - Gray = Intact (0 traces)
- **Smart tooltips**: Hover over segments to see exact part count and total trace cost
- **Completion + traces display**: Progress labels show "50% + 50 traces" to explain sorting priority

#### Trading Comparison Feature
- **Complete set vs individual parts**: Shows market value comparison between selling as complete set vs individual parts
- **Profit difference calculation**: Displays the difference in platinum between selling strategies
- **Market data integration**: Uses existing Warframe.market API data for accurate pricing
- **Strategy recommendations**: Provides trading strategy suggestions based on market analysis

#### Technical Implementation
- **Enhanced primeSetService.ts**: Updated `ownsItem()` and `hasItemInInventory()` functions with improved name matching for different inventory formats
- **Multi-format inventory matching**: Handles both space-separated ("Acceltra Prime Barrel") and underscore-separated ("acceltra_prime_barrel") naming conventions
- **UI component updates**: PrimeSetsSection.tsx enhanced with owned status toggles, trading comparison, and improved progress visualization
- **Event system integration**: Relic focus functionality with proper section expansion and navigation

#### User Benefits
- **Accurate completion tracking**: Only counts items you want to keep toward completion percentage
- **Flexible trading options**: Can sell complete sets while maintaining personal collection tracking
- **Efficient farming prioritization**: Progress bar shows most efficient parts to farm first based on void trace cost
- **Market intelligence**: Trading comparison helps optimize selling strategies
- **Visual clarity**: Clear distinction between owned, inventory, and obtainable parts

## Recent Updates

### Unified Refresh System & Mobile UX Overhaul (2025-08)

#### Comprehensive Refresh System
- **Unified refresh controls**: All three inventory modules (Prime Parts, Void Relics, Prime Sets) now have consistent refresh interfaces
- **Progress tracking**: Real-time progress bars showing current/total items during refresh operations
- **Persistent state**: Accordion states saved to localStorage for better user experience
- **Last refresh timestamps**: Shows "last refreshed X minutes ago" with auto-updating display
- **Smart caching**: Avoids unnecessary API calls unless manually refreshed

#### Mobile-First Syndicate Rewards Redesign
- **Card-based layout**: Replaced table layout with mobile-friendly cards
- **Touch-friendly controls**: Properly sized buttons and touch targets
- **Progressive disclosure**: Essential info first, details on demand
- **Consistent styling**: Matches other inventory sections' design patterns
- **Smart filtering**: Non-tradable items hidden by default for cleaner interface

#### Technical Improvements
- **LastRefreshInfo component**: Reusable component for consistent timestamp display
- **Persistent accordion states**: `accordion_prime_parts`, `accordion_relics`, `accordion_prime_sets`
- **Auto-scroll behavior**: Smooth scrolling when collapsing sections
- **Loading states**: Skeleton animations during price fetching
- **Error handling**: Graceful error states with helpful messaging

### Market Data Bug Fixes (2025-08)

#### Fixed Average Calculation Bug
- **Problem**: Average prices were calculated from buy orders only, causing current == average in many cases
- **Solution**: Now calculates average from all valid orders (buy + sell) for true market average
- **Impact**: More accurate price comparisons and market trend analysis
- **Files affected**: `warframeMarketService.ts`, `supabase/functions/warframe-market/index.ts`

#### Enhanced Data Display
- **Historic data restoration**: Added back average price and trade volume display in syndicate rewards
- **Smart display logic**: Only shows average when different from current price
- **Volume information**: Trade volume displayed in separate section for clarity
- **Loading states**: Proper skeleton animations during data fetching

### GitHub Actions Deployment (2025-08)

#### Automated Supabase Deployment
- **GitHub Actions workflow**: `.github/workflows/deploy-supabase.yml` for automated Edge Function deployment
- **Trigger conditions**: Automatically deploys when `supabase/functions/**` files change
- **Official Supabase action**: Uses `supabase/setup-cli@v1` for reliable CLI installation
- **Secret management**: Requires `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` (CLI token)
- **No Docker required**: GitHub Actions handles all deployment infrastructure

#### Deployment Process
- **Token types**: CLI access token (`sbp_...`) for deployment vs service role token (`eyJ...`) for API access
- **Error handling**: Proper error messages for token format issues
- **Retry capability**: GitHub CLI commands for easy workflow retries
- **Monitoring**: Real-time deployment status tracking

### Gemini 2.5 Flash Upgrade (2025-01)

### Mobile UX Improvements (2025-01)

- **Collapsible cards by default**: All inventory sections start collapsed for better mobile experience
- **Enhanced collapsed summaries**: Shows key metrics (item count, total value, ducats, buildable sets)
- **Unified sorting dropdown**: Mobile-friendly sorting for RelicResultsTable with all sort options
- **Responsive design**: Improved touch targets, spacing, and mobile-first patterns throughout

### Inventory Management Fixes (2025-01)

- **Prime Sets persistence**: Fixed issue where Prime Sets would disappear when inventory cleared
- **Debounced reloading**: Added 500ms debounce to prevent excessive recalculation during image processing
- **State synchronization**: Fixed "owned" button functionality with immediate UI updates
- **Cloud sync protection**: Added 24-hour protection against restoring intentionally deleted data

### Major Prime Sets UI/UX Overhaul (2025-07-15)

### Major Prime Sets UI/UX Overhaul

The Prime Sets section has been completely refactored with improved filtering and sorting:

#### Combinable Filter System
- **Multi-select filters**: Users can combine filters (e.g., "vaulted + weapons")
- **New filter logic**: `activeFilters` Set-based state management instead of single activeTab
- **Filter categories**:
  - All Sets (148 total)
  - Planner (129 - all non-built sets)
  - Priority (2 - starred builds)
  - Built (19 - completed sets)
  - Vaulted, Warframes, Weapons, Misc (companions/sentinels)

#### Advanced Sorting Algorithm
- **Priority-first sorting**: Starred sets always appear at top
- **Weighted completion scoring**: `(owned × 10 + obtainable) / (total × 10)`
- **Logic**: Owned parts worth 10x more than obtainable parts in sorting
- **Examples**: `2/3 owned` > `1+1/3 owned+obtainable` > `1/3 owned`

#### Fixed Relic Logic & Progress Tracking
- **Accurate yellow bars**: Only show for parts obtainable from YOUR owned relics, not all relics in game
- **Unified matching algorithms**: `getRelicsForPart` UI function now uses same logic as `canObtainFromRelics` service
- **Sophisticated part matching**: Handles exact matches, base name matching, and part type validation
- **RELIC tags**: Only shown for parts actually obtainable from owned relics

#### Simplified Build Management
- **Removed market analysis**: Eliminated warframe.market API calls and trading strategy complexity
- **Unified mastery storage**: Fixed inconsistency between UI (`getSetState`) and service (`toggleSetMastery`)
- **Storage mechanism**: Uses centralized `platscanner_mastery` array instead of individual localStorage keys
- **"Mark as done" functionality**: Now works correctly with proper state synchronization

### Technical Improvements

#### Service Layer Changes
- **primeSetService.ts**: Removed market analysis, simplified to focus on build progress
- **buildPlanService.ts**: Enhanced with priority system and proper reservation logic
- **PrimeSetsSection.tsx**: Complete rewrite with Set-based multi-select filtering

#### Key Functions Fixed
- `analyzeSetProgress()`: Now used instead of market-heavy `analyzeSetProgressWithMarketData()`
- `canObtainFromRelics()`: Properly matches parts to owned relics with sophisticated algorithms
- `toggleSetMastery()`: Fixed storage inconsistency between component and service layers
- `getRelicsForPart()`: Synchronized matching logic with service layer for consistent results

#### Console Log Analysis
From recent debugging, the system now shows clean logs:
- Static data initialization (prime sets: 148, relics: 2762)
- Image migration system working properly
- Cloud sync functioning correctly
- No more market API calls
- Clean ownership checks without debug spam

The application is now focused on core build planning functionality without the complexity of market analysis, providing a cleaner and more maintainable codebase.

### Syndicate Rewards Feature (2025-08)

A comprehensive syndicate market analysis feature was implemented to help players optimize their syndicate standing investments:

#### Core Functionality
- **Screenshot-based detection**: Upload syndicate offerings screenshots to automatically detect available rewards
- **Market value analysis**: Fetch real-time prices from Warframe.market for all tradable syndicate items
- **Efficiency calculations**: Calculate plat per 1000 standing for easy comparison across items and syndicates
- **Intelligent categorization**: Auto-detect item types (weapons, mods, cosmetics) with appropriate standing cost estimates
- **Smart filtering**: Non-tradable items hidden by default for cleaner interface

#### User-Centric Design
- **Personal inventory storage**: Syndicate rewards are stored in user inventory (not static data)
- **Progressive rank tracking**: Upload new screenshots as you progress through syndicate ranks
- **Duplicate handling**: Smart deduplication across multiple screenshot uploads
- **Cross-device sync**: Syndicate data syncs via cloud storage alongside other inventory items
- **Mobile-first interface**: Card-based layout with touch-friendly controls and progressive disclosure

#### Technical Implementation
- **Multi-step AI analysis**: Gemini Vision API first detects syndicate screen type, then extracts syndicate name and item details
- **Smart standing estimation**: For owned items (showing checkmarks), auto-estimates standing costs:
  - Weapons: 125,000 standing
  - Augment mods: 25,000 standing
  - Cosmetics: 5,000 standing
- **Integrated pricing pipeline**: Uses existing market data infrastructure for consistent price fetching
- **Enhanced UI display**: Shows "plat/1k standing" ratios for better readability (vs tiny decimals)
- **Fixed average calculation**: True market average from all orders (buy + sell) for accurate comparisons

#### Key Files
- `src/services/syndicateService.ts`: Core service with item type detection and standing cost logic
- `src/components/SyndicateRewardsSection.tsx`: Mobile-friendly UI component with filtering, sorting, and market analysis
- `src/types/index.ts`: SyndicateReward type definition with market and standing fields
- Integration points in `geminiService.ts`, `inventoryService.ts`, and `HomePage.tsx`

#### User Benefits
- **Investment optimization**: Easily identify highest-value syndicate rewards
- **Standing efficiency**: Compare plat/standing ratios across all syndicates
- **Progress tracking**: Visual progression as new ranks unlock more rewards
- **Market awareness**: Real-time pricing helps with trading decisions
- **Clean interface**: Non-tradable items filtered out by default
- **Mobile experience**: Touch-friendly design works great on all devices

### Mod Duplicates Feature & Rarity Detection System (2025-08-29)

A comprehensive mod inventory management system was implemented to help players optimize their mod collections and identify profitable trading opportunities:

#### Core Mod Detection & Processing
- **AI-powered mod recognition**: Enhanced Gemini Vision API prompts specifically for mod screenshots with sophisticated duplicate detection
- **Visual rarity distinction**: AI instructions to differentiate between:
  - **Active blue dots** (leveled mods) = Ignore from duplicate counting
  - **Semi-transparent grey dots** (unranked mods) = Count as sellable duplicates
- **Quantity detection**: Accurate parsing of duplicate indicators (small numbers in top-left corner of mod cards)
- **Explanatory text filtering**: Advanced parsing filters to prevent AI explanation text from being treated as mod names

#### Market-Driven Rarity System
- **Warframe Market API authority**: Uses official market data as the definitive source for mod rarity instead of name-based guessing
- **Real-time rarity updates**: During price fetching, mod rarity is updated from Market API data (`rarity: "rare"` → UI displays golden color)
- **Type extraction from tags**: Automatically determines mod type (stance, weapon, warframe) from Market API tags
- **Fallback handling**: Graceful degradation when Market API unavailable, using 'unknown' rarity with appropriate UI styling

#### Smart Tradeability Logic  
- **Non-tradeable mod detection**: Intelligent filtering prevents API calls for mods that don't exist on Warframe Market:
  - **Stance mods** (Burning Wasp, Brutal Tide) → Marked as "Not tradeable"
  - **Common mods** → Not worth trading, skip price fetch
  - **Flawed mods** → Not tradeable by design
  - **Pattern-based detection** → Known non-tradeable mod patterns
- **Efficient API usage**: Only makes Market API calls for genuinely tradeable mods
- **Clear UI messaging**: Shows "Not tradeable" instead of confusing error states

#### Advanced Filtering & Analysis System
- **Smart filter tabs**: Dynamic filter system with real-time counts:
  - **With Buyers** (tradeable mods with active market)
  - **All Duplicates** (quantity > 1) 
  - **Rarity-based filters** (dynamically generated from available mods)
- **Multi-dimensional sorting**: Sort by Plat/Endo ratio, Market Value, Endo Value, Recommendation, Rarity, Name
- **Duplicate analysis**: Calculates total duplicates, market value, endo value, and best Plat/Endo ratios
- **Recommendation engine**: AI-powered suggestions for each mod (Keep All, Keep One Sell Rest, Trade on Market, Sell for Endo)

#### Mobile-First UI Design
- **Card-based layout**: Touch-friendly mod cards with all essential information
- **Progressive disclosure**: Essential details first, advanced info on demand  
- **Visual hierarchy**: Clear mod images, rarity colors, quantity indicators, and action buttons
- **Real-time refresh**: Individual mod price refresh with loading states and error handling
- **Responsive filtering**: Collapsible filter panels that work well on mobile screens

#### Technical Architecture Improvements
- **Duplicate processing elimination**: Fixed multiple useEffect hooks that were causing duplicate API calls and processing
- **Status type consistency**: Aligned mod status values ('loaded', 'error') across all processing paths
- **Enhanced error handling**: Proper error states for failed API calls with user-friendly messages
- **Image URL integration**: Automatic mod thumbnail URLs from Warframe Market API
- **Debug logging**: Comprehensive logging system for troubleshooting rarity detection and API issues

#### Market Data Integration  
- **fetchSinglePriceData enhancement**: Updated to return rarity, tags, and thumbnail fields from Market API
- **Batch processing support**: Efficient handling of multiple mod price requests with progress tracking
- **Edge Function deployment**: Updated Supabase Edge Function with latest mod processing logic
- **Caching optimization**: Intelligent caching to prevent unnecessary API calls while maintaining fresh data

#### Key Files & Components
- **`src/components/ModDuplicatesSection.tsx`**: Main UI component with filtering, sorting, and mod management
- **`src/services/modService.ts`**: Core service with tradeability logic, rarity detection, and market integration  
- **`src/services/geminiService.ts`**: Enhanced AI prompts and parsing logic for accurate mod detection
- **`src/services/warframeMarketService.ts`**: Updated to support mod-specific data fields (rarity, tags, thumbnails)
- **`src/pages/HomePage.tsx`**: Integrated mod processing pipeline with Market API rarity updates

#### User Experience Benefits
- **Accurate visual feedback**: Mod rarity colors match actual in-game frame colors (yellow = rare, blue = uncommon)
- **Efficient inventory management**: Quick identification of valuable mods vs. endo-only duplicates  
- **Smart trading decisions**: Real-time market data helps optimize selling strategies
- **Time-saving automation**: No manual mod categorization - AI handles detection and Market API provides accurate data
- **Mobile accessibility**: Full-featured mod management that works seamlessly on phones and tablets
- **Clear actionability**: Each mod shows specific recommendations (trade, keep, sell for endo) with reasoning

#### Bug Fixes & Technical Improvements
- **Rarity assignment bug**: Fixed type casting issues where Market API rarity data wasn't properly mapped to internal types
- **Duplicate processing**: Eliminated race conditions causing mods to be processed multiple times
- **Status consistency**: Standardized status values across mod processing pipeline  
- **API efficiency**: Prevented unnecessary API calls for non-tradeable mods
- **Parsing improvements**: Enhanced text filtering to prevent AI explanations from creating duplicate mod entries
- **Edge Function updates**: Deployed latest processing logic to production Supabase Edge Function

This comprehensive mod management system transforms how players interact with their mod collections, providing intelligent automation, accurate market data, and actionable insights for optimizing both endo farming and platinum trading strategies.