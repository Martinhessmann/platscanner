# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
```

## Project Architecture

This is a React-based Warframe inventory scanner that uses AI to analyze screenshots of Prime parts and Void relics. The application has a well-structured service-oriented architecture:

### Core Services Architecture

The application is built around several key services located in `src/services/`:

- **geminiService.ts**: Handles Google Gemini Vision API integration for image analysis. Uses multi-step analysis: first determines screen type (prime_parts/relics), then applies specialized prompts for each category.
- **warframeMarketService.ts**: Integrates with Warframe.market API for real-time pricing data
- **unifiedImageService.ts**: Manages local image assets for Prime parts and relics to reduce CDN dependencies
- **inventoryService.ts**: Handles inventory data persistence and local storage management
- **relicDataService.ts**: Manages Void relic data including reward tables and value calculations
- **primeSetService.ts**: Handles Prime set tracking and completion calculations
- **cloudSyncService.ts**: Manages cross-device synchronization via Supabase
- **buildPlanService.ts**: Handles build planning and tracking features
- **dataExportService.ts**: Manages data export functionality

### Component Structure

Key components in `src/components/`:

- **ImageUploader.tsx**: Handles drag-and-drop image uploads with processing queue
- **ResultsTable.tsx**: Displays Prime parts with pricing and market data
- **RelicResultsTable.tsx**: Shows Void relics with refinement analysis and recommendations
- **PrimeSetsSection.tsx**: Tracks Prime set completion and provides build recommendations
- **RelicAnalysisCard.tsx**: Displays detailed relic value analysis and refinement suggestions
- **InventorySection.tsx**: Main inventory management interface
- **ApiKeySettings.tsx**: Handles Gemini API key configuration
- **CloudSyncSection.tsx**: Manages cloud synchronization settings

### Data Flow

1. Images are uploaded via ImageUploader
2. Gemini Vision API analyzes screenshots to detect items
3. Detected items are sent to Warframe.market API for pricing
4. Results are displayed in specialized tables with value analysis
5. Data is persisted locally and optionally synced to cloud

### Key Features

- **Multi-image processing**: Queued batch processing with progress tracking
- **Relic value optimization**: Calculates expected values and refinement recommendations
- **Prime set tracking**: Monitors completion status and suggests builds
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

- Google Gemini Vision API for image analysis
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

## Recent Updates (2025-07-15)

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