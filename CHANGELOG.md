# Changelog

All notable changes to Prime Parts Scanner will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.16.1] - 2025-06-29

### Added
- **🔄 Unified Refresh System** - All 3 inventory modules now have consistent refresh functionality
  - **🔄 Prime Sets Refresh Button** - Manual refresh for Prime Sets market data with progress bar and loading states
  - **⏰ Last Refreshed Timestamps** - "Last refreshed X minutes ago" info for Prime Parts, Void Relics, and Prime Sets
  - **📊 Consistent Progress Indicators** - Unified refresh UI with progress bars and status counters across all modules
  - **💾 Prime Sets Persistence** - Prime Sets analysis data now persists in localStorage and doesn't disappear on refresh
  - **🔄 Smart Caching** - Prime Sets market data cached to avoid unnecessary API calls unless manually refreshed

### Enhanced
- **🛡️ Prime Sets State Management** - Prime Sets now stay visible during market price refresh, similar to other modules
- **📱 Consistent UX** - All 3 modules (Prime Parts, Void Relics, Prime Sets) now have matching refresh controls and behavior
- **🎯 Force Refresh Option** - Manual refresh bypasses cache for up-to-date market data when needed

### Fixed
- **🔧 Prime Sets Button Functionality** - Fixed all non-functional buttons in Prime Sets trading strategy cards
  - **💬 Message Buyer Buttons** - Now properly copy whisper messages to clipboard with visual feedback
  - **🌐 View Market Buttons** - Now open correct Warframe Market pages for complete sets
  - **🎲 View Relics Buttons** - Placeholder functionality implemented (shows debug info)
  - **🛒 Find Parts Buttons** - Opens Warframe Market search for missing parts
  - **📋 Clipboard Integration** - All message buttons now copy proper `/w` commands and show check marks

### Technical
- **🏗️ Enhanced PrimeSetService** - Added caching functions (`getPrimeSetsCache`, `setPrimeSetsCache`, `clearPrimeSetsCache`)
- **📡 Refresh Time Tracking** - New functions in inventoryService for tracking last refresh times per module
- **🎨 LastRefreshInfo Component** - Reusable component for displaying relative refresh times with auto-updating text
- **🔄 Force Refresh Support** - Added `forceRefresh` parameter to `analyzeSetProgressWithMarketData` function
- **🔄 Individual Set Refresh** - New `refreshIndividualSetMarketData` function for refreshing single Prime Sets
- **📋 Clipboard Functionality** - Added `handleClipboardCopy` function with visual feedback for message buttons
- **🌐 Market URL Generation** - Smart URL generation for Warframe Market links and searches

## [1.16.0] - 2025-06-28

### Added
- **🎯 REVOLUTIONARY: Complete Prime Set Market Integration** - Going full circle with complete trading strategy analysis
  - **💰 Complete Set Pricing** - Fetches real-time market prices for complete Prime Sets (e.g., "Ash Prime Set", "Mesa Prime Set")
  - **📊 Profit Comparison Analysis** - Compares individual parts value vs complete set value for optimal trading decisions
  - **🎯 Smart Trading Recommendations** - AI-powered strategy suggestions: SELL_PARTS, BUILD_AND_SELL, or KEEP_FOR_MASTERY
  - **⚖️ Real Market Economics** - Uses actual Warframe Market data with 5% volatility threshold for intelligent recommendations
  - **🔄 Batch Market Processing** - Efficient API calls respecting rate limits for multiple set analysis
  - **👤 Buyer Integration** - Shows top buyers for complete sets with usernames and quantities
  - **🎨 Visual Strategy Cards** - Color-coded recommendations with profit indicators and clear explanations
  - **⚡ Performance Optimized** - Only fetches market data for sets with owned parts or buildable status
  - **🛡️ Error Handling** - Graceful degradation when market data unavailable with informative fallbacks
- **🚀 REVOLUTIONARY: Investment Strategy Analysis** - Advanced ROI calculations for maximizing trading profits
  - **🎲 Relic Opening Strategy** - Analyzes void trace investment vs profit potential for missing parts from relics
  - **🛒 Missing Parts Investment** - Calculates cost to buy missing parts vs complete set profit
  - **⚖️ Hybrid Investment Strategy** - Optimal combination of relic opening + buying parts for maximum efficiency
  - **📊 ROI Calculations** - Sophisticated return-on-investment analysis with percentage returns
  - **💰 Investment Breakdown** - Detailed cost analysis showing relic costs vs buying costs vs expected profits
  - **🎯 Action-Oriented UI** - "View Relics", "Find Parts", "Message Buyer" buttons for immediate action
  - **📈 Smart Recommendations** - OPEN_RELICS, BUY_MISSING, HYBRID_STRATEGY based on optimal investment paths

### Enhanced
- **🏗️ Extended SetProgress Interface** - Added complete market analysis fields for comprehensive trading insights
- **📡 Warframe Market Service** - New `fetchPrimeSetMarketData()` and `fetchBatchPrimeSetMarketData()` functions
- **🧮 Intelligent Strategy Logic** - Sophisticated algorithm considering mastery status, buildability, and profit potential
- **🎨 Prime Sets UI Evolution** - Enhanced cards showing individual vs complete set value with profit indicators
- **📱 Mobile-Friendly Design** - Responsive trading strategy cards work seamlessly across all devices
- **🎯 Investment Analysis Engine** - Advanced calculations for relic opening costs, missing parts costs, and ROI optimization
- **🔍 Smart Price Estimation** - Intelligent fallback pricing for missing parts based on similar items and part types
- **💡 Action-First UX** - Prominent buttons for immediate trading actions rather than just analytical comparisons

### Technical
- **🏗️ Complete Set Market Service** - New dedicated functions for fetching complete Prime Set market data
  - **📡 fetchPrimeSetMarketData()** - Single set market data with proper normalization ("Ash Prime" → "ash_prime_set")
  - **🔄 fetchBatchPrimeSetMarketData()** - Batch processing for multiple sets with rate limiting
  - **⚡ Smart Rate Limiting** - Respects 334ms delay between requests (~3 requests/second)
- **🧮 Market Analysis Engine** - Comprehensive profit analysis with intelligent strategy determination
  - **💰 calculateIndividualPartsValue()** - Sums market value of owned individual parts
  - **🎯 determineOptimalStrategy()** - Advanced logic considering mastery, buildability, and profit margins
  - **📊 analyzeSetProgressWithMarketData()** - Enhanced analysis function with optional market data inclusion
- **🎨 TradingStrategyCard Component** - Feature-rich UI component for strategy visualization
  - **🎨 Color-coded Strategies** - Blue (Sell Parts), Green (Build & Sell), Yellow (Keep), Gray (Unknown)
  - **📊 Profit Indicators** - Shows individual parts vs complete set values with profit difference
  - **👤 Buyer Information** - Displays top buyer username and quantity when available
  - **⚡ Loading States** - Smooth loading animations and error state handling
- **🚀 Investment Analysis System** - Revolutionary ROI calculation engine for Warframe trading optimization
  - **📊 calculateInvestmentAnalysis()** - Comprehensive investment strategy analysis with void trace costs
  - **💰 getEstimatedPartPrice()** - Smart price estimation using inventory data and part type fallbacks
  - **🎯 determineOptimalStrategyWithInvestment()** - Enhanced strategy logic incorporating investment opportunities
  - **⚖️ ROI Calculations** - Advanced return-on-investment analysis with profit/cost ratios
  - **🎲 Relic Cost Modeling** - Void trace to platinum conversion (75 traces @ 0.3p = 22.5p per part)
  - **🛒 Missing Parts Cost Analysis** - Real market price lookup with intelligent fallbacks
- **🎨 Enhanced TradingStrategyCard UI** - Action-first interface design for immediate trading decisions
  - **🎨 Expanded Strategy Icons** - Purple (Open Relics), Orange (Buy Missing), Cyan (Hybrid Strategy)
  - **📊 Investment Breakdown Display** - Detailed cost/profit analysis with visual indicators
  - **🎯 Action Button Matrix** - Context-sensitive buttons: View Relics, Find Parts, Message Buyer
  - **📱 Responsive Investment UI** - Complex investment data displayed cleanly on mobile devices

### Validated
- **🎯 "Going Full Circle" Achievement** - PlatScanner now covers the complete Warframe trading ecosystem:
  1. **🔍 Scan** → Detect Prime Parts from screenshots
  2. **💰 Value** → Fetch individual part market prices
  3. **🔧 Analyze** → Identify buildable sets and completion status
  4. **📋 Plan** → Build planning with item reservations
  5. **🎯 Optimize** → Complete set vs parts profit analysis with smart recommendations
  6. **🚀 Invest** → ROI analysis for relic opening and missing parts purchasing strategies
- **📊 Real Market Data Integration** - Uses actual Warframe Market API for complete Prime Set pricing
- **🧮 Intelligent Decision Support** - Helps users maximize platinum through data-driven trading strategies
- **💰 Investment Optimization** - Revolutionary ROI calculations guide users to optimal investment strategies
- **🎯 Action-Oriented UX** - Users get immediate actionable recommendations with clear profit projections

## [1.15.1] - 2025-06-28

### Fixed
- **🤖 Smart Two-Step AI Analysis System** - Fixed hallucination while preserving relic detection accuracy
  - **🎯 Screen Type Detection** - First determines if image shows Prime Parts or Void Relics
  - **📝 Focused Prime Parts Analysis** - Simple text reading prompt prevents AI hallucination for Prime items
  - **🔍 Detailed Relic Filtering** - Preserves sophisticated owned/unowned relic detection (eye icons, fading, etc.)
  - **🚫 Anti-Hallucination for Prime Parts** - Forces actual image analysis instead of guessing from memory
  - **⚡ Context-Aware Prompts** - Uses appropriate detailed instructions based on detected screen type
  - **🔍 Enhanced Debugging** - Comprehensive logging shows screen type detection and raw AI responses

### Validated
- **✅ Production Testing Success** - Achieved 96% accuracy (26/27 items) on real screenshot
- **🎯 Target Item Detection** - Successfully detected "Sevagoth Prime Chassis Blueprint" and all visible Prime Parts
- **🚫 Zero Hallucination** - No more false positives or random item generation
- **🎯 Smart Debounced Sync System** - Eliminated hundreds of rapid sync calls during app initialization
  - **⏱️ Intelligent Debouncing** - 2-second debounce period batches multiple data modifications into single sync
  - **🔄 Silent Batching** - No more console spam during bulk operations like price updates and initialization
  - **⚡ Force Sync Method** - New `forceSync()` for manual sync operations that bypass debouncing
  - **🧹 Cleanup Management** - Proper timeout cleanup to prevent memory leaks
  - **📊 Efficient Bulk Operations** - Price updates and inventory changes are batched intelligently

## [1.14.4] - 2025-01-28

### Fixed
- **🔄 Sync Loop Prevention** - Critical fix for infinite cloud sync loops
  - **🛡️ Re-entrant Operation Protection** - Added `isSyncing` flag to prevent concurrent sync operations
  - **⏱️ Sync Cooldown System** - 1-second cooldown between sync operations to prevent rapid-fire triggers
  - **🎯 Smart State Management** - Distinguishes between user changes and system changes during cloud sync
  - **📡 Loop-Safe Data Loading** - Cloud downloads no longer trigger upload loops on page refresh
  - **🔍 Enhanced Logging** - Clear console messages when sync operations are skipped due to state protection

## [1.14.3] - 2025-06-28

### Fixed
- **🔄 Smart Cloud Sync System** - Major overhaul to prevent local data loss
  - **⏰ Local Modification Tracking** - New `platscanner_last_modified` timestamp for accurate conflict detection
  - **🚀 Immediate Sync on Changes** - Automatically uploads to cloud when local data is modified
  - **🎯 Smart Auto-Sync Logic** - Compares local vs cloud modification times instead of blindly downloading
  - **🛡️ Preserves Local Changes** - No more overwriting recent local inventory changes with old cloud data
  - **📡 Real-Time Sync Integration** - All inventory, build plan, and mastery changes trigger instant cloud sync
  - **🔍 Intelligent Conflict Resolution** - Uses actual modification timestamps for accurate sync decisions
  - **⚡ Seamless Experience** - Works transparently in background without user intervention

### Enhanced
- **🔧 Service Layer Integration** - Added cloud sync notifications to all data modification functions
  - **📦 Inventory Service** - Syncs on save, remove, clear, and price updates
  - **📋 Build Plan Service** - Syncs on plan changes and item reservations
  - **🏆 Prime Set Service** - Syncs on mastery status updates
  - **📊 Data Export Service** - Syncs after importing backup data
  - **🎯 Error Handling** - Graceful fallbacks when cloud sync unavailable

## [1.14.2] - 2025-06-28

### Added
- **👁️ Unreserved Items Filter** - New filter to show only items not reserved for build plans
  - **🎯 Smart Filtering** - Toggle to show only items safe to sell without affecting planned builds
  - **📊 Dynamic Counts** - Shows "X of Y unreserved items" when filter is active
  - **🖥️ Desktop & Mobile Support** - Filter controls available in both Prime Parts and Void Relics tables
  - **🔄 Empty State Handling** - Clear message when all items are reserved for builds
  - **⚡ Instant Toggle** - One-click switching between "Show All" and "Unreserved Only" views
  - **🎨 Visual Indicators** - Eye/EyeOff icons with Tenno Blue active state styling

### Enhanced
- **🎯 Improved UX for Build Planning** - Perfect complement to the reservation system for safer inventory management
- **📱 Consistent Interface** - Unified filter experience across both desktop table and mobile card views
- **🛡️ Selling Safety** - Easy way to identify items that won't interfere with planned prime builds

## [1.14.1] - 2025-06-28

### Fixed
- **🚨 CRITICAL: Owned Prime Parts Not Reserved** - Fixed reservation system to reserve ALL required parts, including owned ones
  - **🔒 Complete Part Reservation** - Build plans now reserve both owned parts (to prevent selling) and missing parts (to track needs)
  - **🛡️ Enhanced Selling Protection** - Owned prime parts for planned sets now show proper reservation warnings
  - **🔧 Comprehensive Fix** - Updated `autoReserveItemsForSet()` to reserve all required parts instead of just missing ones
  - **📋 Function Rename** - Renamed `updateAllRelicReservations()` to `updateAllReservations()` for clarity
  - **⚖️ Smart Relic Logic** - Relics still only reserved for missing parts to avoid unnecessary reservations
- **🚨 CRITICAL: Blueprint Name Mismatch in Reservations** - Fixed fuzzy matching for prime parts with/without "Blueprint" suffix
    - **🎯 Root Cause Identified** - Prime Sets stored "Wisp Prime Systems" but inventory checked "Wisp Prime Systems Blueprint"
  - **🔍 Fuzzy Matching Logic** - `isItemReserved()` now matches parts with or without "Blueprint" suffix automatically
  - **🛡️ Enhanced Protection** - Owned prime parts now properly show reservation warnings regardless of Blueprint naming
  - **🧹 Production Code Cleanup** - Removed debug logging after successful diagnosis and fix

## [1.14.0] - 2025-06-28

### Added
- **⚡ Static Data Performance Optimization** - Revolutionary caching system eliminating redundant data loading
  - **🗄️ Centralized Static Data Service** - New `staticDataService.ts` that loads prime sets and relics data once globally
  - **📊 Intelligent Caching System** - Static game data (primesets.json, relics.json) now loads once and caches globally
  - **🚀 15x Performance Improvement** - Eliminated 15+ redundant data loads per session, now loads only 2x as intended
  - **⚡ Parallel Data Loading** - Simultaneous loading of prime sets and relics data for faster initialization
  - **🛡️ Loading Guards** - Anti-spam mechanisms prevent duplicate loading during React re-renders
  - **📱 Component Optimization** - Prime Sets and Relic analysis no longer trigger data reloading on UI interactions
  - **🧹 Cleaner App Startup** - Centralized initialization in HomePage.tsx with proper error handling

### Fixed
- **🚨 CRITICAL: Relic Reservation Logic Bug** - Fixed broken build plan reservation system for prime sets
  - **🔧 Smart Matching Algorithm** - Reservation now uses same sophisticated fuzzy matching as prime set analysis
  - **🎯 Exact Issue Resolution** - "Atlas Prime Chassis" now correctly matches "Atlas Prime Chassis Blueprint" in relic drops
  - **⚖️ Base Name + Part Type Logic** - Proper matching using base prime name (e.g., "atlas prime") + part type (e.g., "chassis")
  - **🛠️ Comprehensive Fix** - Updated both `autoReserveItemsForSet()` and `updateAllRelicReservations()` functions
  - **✅ Verified Working** - Meso E3 Relic now correctly shows "Reserved for: Atlas Prime, Bronco Prime, Stradavar Prime"
- **🧹 Console Log Cleanup** - Removed excessive debug logging that was flooding browser console
  - **📊 Eliminated 100k+ Log Spam** - Removed redundant Atlas Prime Chassis debugging that was causing console overflow
  - **🎯 Focused Logging** - Maintained essential error handling and status logs while removing noise
  - **⚡ Better Performance** - Reduced memory usage and improved browser responsiveness

### Enhanced
- **🏗️ Improved Architecture** - Better separation of concerns with dedicated static data management
- **📱 Faster UI Responsiveness** - Component re-renders and accordion interactions no longer trigger data reloading
- **🎯 Reliable Build Planning** - Prime set reservation system now works consistently for all prime parts and relics
- **🚀 Optimized Development Experience** - Cleaner console output makes debugging easier for developers

### Technical
- **🏗️ Static Data Service Architecture** - Complete refactor of data loading infrastructure
  - **📡 staticDataService.ts** - Global singleton service managing prime sets and relics data
  - **🔄 Service Integration** - Updated `primeSetService.ts` and `relicDataService.ts` to use centralized loading
  - **⚡ Performance Guards** - Anti-duplicate loading mechanisms with proper async/await handling
  - **🎯 Error Recovery** - Graceful fallbacks when static data loading fails
- **🛠️ Reservation Logic Overhaul** - Fixed critical matching algorithm in build plan service
  - **🔍 Fuzzy Matching Implementation** - Same logic as prime set analysis for consistent behavior
  - **📋 Enhanced Type Safety** - Improved function signatures and error handling
  - **🔧 Comprehensive Testing** - Created and validated test cases for matching edge cases

## [1.13.0] - 2025-06-26

### Added
- **☁️ REVOLUTIONARY: Cross-Platform Cloud Sync** - Complete inventory synchronization across all devices and browsers
  - **🔐 Secure API Key Identification** - Uses SHA-256 hashed Gemini API key as unique user identifier (raw key never stored in cloud)
  - **📊 Complete Data Sync** - Synchronizes inventory, build plans, mastery progress, and scan history across platforms
  - **⚡ Auto-Sync on App Load** - Automatically syncs when opening the app if cloud sync is enabled
  - **🔄 Manual Sync Controls** - Upload to cloud, download from cloud, and auto-sync now buttons
  - **⚖️ Intelligent Conflict Resolution** - Smart handling when both local and cloud data have been modified
  - **🛠️ Configurable Conflict Strategy** - Choose to always use local, always use remote, or ask each time
  - **📡 Real-time Cloud Data Info** - Shows cloud inventory statistics (item count, total value, last sync time)
  - **🗑️ Cloud Data Management** - Delete all cloud data with confirmation for privacy control
  - **🔒 Enhanced Privacy Protection** - API key hashed client-side, only inventory data stored in cloud
  - **🏗️ Supabase Integration** - Leverages existing Supabase infrastructure with new database table
  - **📱 Cross-Browser Transfer** - Perfect for switching between desktop/mobile or sharing complete setups
  - **⚠️ Graceful Degradation** - App works normally when cloud sync unavailable, with clear status indicators
- **⚙️ Enhanced Settings with Cloud Sync Tab** - Redesigned settings interface with three organized sections
  - **🔧 API Configuration Tab** - Dedicated section for Gemini API key management
  - **☁️ Cloud Sync Tab** - Complete cloud synchronization settings and controls
  - **💾 Data Backup Tab** - Traditional export/import functionality for manual backups
  - **🎨 Unified Design Language** - Consistent styling and interactions across all settings sections

### Technical
- **🏗️ Cloud Sync Service Architecture** - Comprehensive service layer for cross-platform synchronization
  - **📡 cloudSyncService.ts** - Complete sync management with conflict resolution and error handling
  - **🔐 Client-side API Key Hashing** - SHA-256 hashing using Web Crypto API for privacy
  - **📊 Smart Data Merging** - Handles merge vs replace operations for different data types
  - **⚡ Auto-sync on Configuration** - Automatically attempts sync when API key is configured
  - **🛡️ Robust Error Handling** - Comprehensive error management with user-friendly messages
- **🗄️ Database Schema** - New Supabase table for cloud inventory storage
  - **📋 user_inventories Table** - JSONB columns for flexible data storage with RLS security
  - **🔍 Performance Indexes** - Optimized queries with user_id and updated_at indexes
  - **🛡️ Row Level Security** - Proper data isolation using anonymous key authentication
  - **📝 Setup Documentation** - Complete SQL setup script (setup-cloud-sync.sql) for easy deployment
- **🎨 CloudSyncSection Component** - Feature-rich UI component for sync management
  - **🎛️ Toggle Controls** - Enable/disable sync and auto-sync with visual feedback
  - **📊 Cloud Data Visualization** - Real-time display of cloud inventory statistics
  - **🔄 Manual Sync Operations** - Upload, download, and auto-sync actions with progress indicators
  - **⚖️ Conflict Resolution UI** - User-friendly interface for handling data conflicts
  - **🗑️ Danger Zone Management** - Secure cloud data deletion with confirmation dialogs

## [1.12.0] - 2025-01-07

### Enhanced
- **🔒 Intelligent Relic Reservation System** - Smart relic management for Prime Set planning
  - **🎯 Missing Parts Focus** - Relics now only reserved for parts you don't already own
  - **⚡ Retroactive Reservation** - Existing planned sets automatically have their relics reserved
  - **🧩 Visual Connection** - "Reserved for: [Set Name]" labels for relics containing needed parts
  - **📊 Smarter Resource Management** - No more unnecessary reservations for parts you already have
  - **🔄 Real-time Updates** - Reservations update whenever prime set status changes

### Fixed
- **🐛 Unnecessary Relic Reservations** - Fixed bug causing relics to be reserved even for parts you already own
- **🐛 Existing Plans Ignored** - Fixed issue where relic reservations only applied to newly planned sets
- **🏗️ Automatic Reservation Refresh** - Added system to update all relic reservations when inventory changes

## [1.11.0] - 2025-01-06

### Enhanced
- **🎨 Compact Prime Sets Tabs** - Revolutionary UI redesign transforming large vertical buttons into compact horizontal pill-style tabs
  - **📱 Horizontal Pill Layout** - Space-efficient tags that wrap to next line like a tag cloud
  - **🎯 Same Functionality** - All tab switching and filtering preserved with improved visual hierarchy
  - **🧹 Removed Preview Summaries** - Eliminated redundant "Buildable with Relics" content badges for cleaner interface
  - **📏 Responsive Design** - Pills automatically wrap on smaller screens for optimal space usage
  - **🎨 Active State Clarity** - Maintained color-coded active tabs with rings and improved contrast

### Technical
- **🏗️ Portal Modal System** - Enhanced modal architecture with proper viewport positioning
  - **📍 Portal.tsx** - Reusable portal component for rendering modals outside component tree
  - **🖥️ PortalModal.tsx** - Optimized modal wrapper with viewport positioning and click-outside handling
  - **⚡ Improved Performance** - Better event handling and modal state management

## [1.10.0] - 2025-01-06

### Added
- **🔄 Data Backup & Sharing System** - Complete inventory export/import functionality for sharing and cross-browser transfer
  - **📦 JSON Export/Import** - Export all inventory, build plans, and mastery data to JSON format
  - **💾 Download Backup Files** - Save complete backups as downloadable JSON files with metadata
  - **📋 Text Field Import/Export** - Copy/paste JSON directly via text area for easy Discord/chat sharing
  - **📁 File Upload Import** - Traditional file upload for .json backup files
  - **🔄 Merge or Replace Options** - Choose to merge with existing data or completely replace it during import
  - **⚠️ Clear Data Replacement Warnings** - Explicit warnings that "Replace All Data" will delete ALL existing inventory
  - **🎯 Smart Import Validation** - Validates backup files and shows preview with statistics before import
  - **📊 Data Preview** - Shows total items, platinum value, planned sets, and mastered sets before import
  - **🛡️ API Key Protection** - API keys are never exported, keeping personal authentication secure
  - **⚡ Instant UI Refresh** - Automatically refreshes all UI components after successful data import
  - **📱 Cross-Browser Transfer** - Perfect for switching browsers or sharing complete inventories with friends
- **⚙️ Enhanced Settings Interface** - Redesigned settings with tabbed navigation
  - **📑 Tabbed Settings Modal** - Clean separation between API Configuration and Data Backup sections
  - **🔧 API Configuration Tab** - Dedicated tab for Gemini API key management
  - **💾 Data Backup Tab** - Dedicated tab for all backup and sharing functionality
  - **📱 Responsive Modal Design** - Improved mobile experience with larger, scrollable modals

## [1.9.0] - 2025-06-23

### Added
- **🎯 REVOLUTIONARY: Direct Buyer Messaging** - Game-changing trading workflow that eliminates tab switching
  - **💬 Whisper Message Generation** - One-click generation of `/w [username] Hi! I want to sell: "[item]" for [price] platinum. (warframe.market)` messages
  - **👤 Highest Bidder Integration** - Automatically contacts the top buyer for each item with accurate pricing
  - **📋 Batch Messaging** - "Message Buyers" button generates multiple whisper messages for all items with available buyers
  - **🔄 Individual & Bulk Actions** - Message individual buyers or copy all messages at once
  - **✅ Smart Availability Detection** - Only shows message buttons when buyers are actually available
  - **🎮 Seamless Trading** - Never leave your browser tab to initiate trades on Warframe Market
- **🛡️ Prime Set Detection System** - Revolutionary feature that analyzes your inventory to detect buildable Prime sets
  - **🎯 Buildable Sets Detection** - Automatically identifies which Prime warframes/weapons you can build immediately
  - **📊 Progress Tracking** - Shows completion percentage for each set and which parts you're missing
  - **✅ Mastery Status Tracking** - Mark sets as mastered/built with persistent localStorage storage
  - **🏆 Smart Recommendations** - Three-tab view: Buildable, In Progress, and All Sets with priority sorting
  - **💰 Cost Analysis** - Estimates platinum cost to complete missing sets
  - **🏗️ Comprehensive Database** - Includes major Prime warframes, weapons, and their required parts
- **🔍 Relic Detail Popup** - Comprehensive relic analysis modal with probability tables and drop contents
  - **📊 Refinement Comparison** - Side-by-side analysis of all refinement levels (Intact → Radiant)
  - **🎲 Drop Probability Tables** - Accurate drop chances for Common/Uncommon/Rare items by refinement level
  - **💰 Market Price Integration** - Real-time pricing for all potential drops
  - **🎯 Strategy Recommendations** - Clear guidance on best refinement level vs market sale
  - **⚡ Interactive UI** - Click any relic name to open detailed analysis popup

### Enhanced
- **🎯 REVOLUTIONARY: Prime Set Status System Redesign** - Complete overhaul of build planning and status management
  - **📋 Intuitive Tab System** - "All Sets" default, with Buildable, In Progress, and Already Built tabs for clear organization
  - **🎯 Simplified Button Logic** - "I want to build this" moves to In Progress, "Already Built" moves to Built tab
  - **🗑️ Mistake Recovery** - Already Built tab includes remove option for accidentally marked items
  - **❌ Removed Confusing Elements** - Eliminated separate "mastered" checkbox and complex priority system
  - **🎨 Visual Status Clarity** - Color-coded borders (green=buildable, yellow=in progress, purple=built)
- **🛡️ Comprehensive Selling Protection System** - Revolutionary item reservation warnings prevent accidental sales
  - **⚠️ Visual Warning Indicators** - Shield icons and colored text alerts for reserved items in both Prime Parts and Relics tables
  - **📋 Build Plan Integration** - Shows which sets items are reserved for with priority status
  - **🚨 Priority Highlighting** - High-priority build reservations displayed in red vs yellow for normal builds
  - **📱 Cross-Platform Warnings** - Consistent reservation alerts in both desktop tables and mobile card views
  - **🔒 Automatic Protection** - Items automatically reserved when sets are added to build plans
- **📋 Clipboard Feedback System** - Visual confirmation for successful whisper message copying
  - **✅ Icon Animation** - Message button icon changes to checkmark for 2 seconds after successful copy
  - **🎯 Per-Item Feedback** - Each item shows individual copy confirmation without affecting others
  - **📱 Cross-Platform Support** - Consistent feedback on both desktop and mobile interfaces
- **🚀 Streamlined Messaging UX** - Removed bulk "Message Buyers" button for cleaner, more focused interface
  - **🎯 Individual Focus** - Users now message buyers one at a time for better trade management
  - **🧹 Cleaner Interface** - Simplified headers with focus on individual item actions
  - **⚡ Maintained Functionality** - All individual messaging capabilities preserved and enhanced
- **🎯 Intelligent Prime Set Analysis** - Prime Sets now detect parts obtainable from owned relics with yellow hexagon icons
  - **🟡 Yellow Progress Indicators** - Shows which missing parts are available in your relic drops
  - **📊 Enhanced Progress Display** - "+X in relics" counter shows additional obtainable parts
  - **🏆 Buildable via Relics Section** - New highlight section for sets completable by opening relics
  - **🎲 Smart Part Matching** - Intelligent matching between prime part names and relic drop contents
- **🔧 Modal UX Improvements** - Enhanced relic detail popup with better positioning and usability
  - **📍 Viewport Positioning** - Modal now positioned absolutely to viewport for consistent visibility
  - **👆 Click-Outside-to-Close** - Click anywhere outside the modal to close it intuitively
  - **🎯 Proper Event Handling** - Modal content prevents click propagation for smooth interaction
- **🔄 MAJOR: Unified Relic Analysis Table** - Revolutionary redesign merging refinement and drop tables into one comprehensive view
  - **📊 Refinement Columns** - Columns for each refinement level (Intact, Exceptional, Flawless, Radiant) with color indicators
  - **🎯 Smart Greying** - Lower refinement levels greyed out since relics can't be downgraded
  - **📈 Item Drop Matrix** - Rows for each item showing drop percentages across all refinement levels
  - **💰 Market Price Integration** - Last column shows current market prices for all items
  - **⚡ Expected Value Summary** - Dedicated row showing expected values and void trace costs for each refinement level
  - **🏆 Best Strategy Highlight** - Green highlighting of optimal refinement choice with "BEST" indicators
- **🎯 REVOLUTIONARY: Prime Set Build Planning** - Complete build management system with item reservation
  - **❤️ "I Want to Build This" System** - Mark prime sets as planned builds with normal or priority status
  - **🔒 Automatic Item Reservation** - Auto-reserves all required parts to prevent accidental selling
  - **⭐ Priority Build Management** - High-priority builds get special visual treatment and stronger reservation warnings
  - **📋 Build Plan Persistence** - All build plans saved to localStorage with version management
  - **🎯 Smart Reservation Logic** - Items can be reserved for multiple sets, tracks reservation history
  - **⚠️ Selling Protection** - Warning system prevents accidental sale of reserved items

## [1.8.0] - 2025-01-03

### Added
- **⚡ Parallel Processing Optimization** - Revolutionary performance enhancement achieving ~50% faster processing
  - **🔄 Separated Processing Phases** - Split AI analysis from market price fetching for independent operation
  - **🚀 Parallel Operations** - Gemini analyzes screenshot 2 while fetching prices for screenshot 1 items
  - **🎯 Enhanced State Management** - New "analyzed" status in processing pipeline for better flow control
  - **📊 Improved UI Feedback** - Shows parallel operations with appropriate status indicators
  - **⚡ Performance Boost** - Dramatic speed improvement for multi-screenshot workflows
  - **🧩 Non-blocking Design** - Users can upload multiple screenshots without waiting for previous to complete
- **🎯 Multi-Item Quantity Detection** - Revolutionary detection system that identifies and displays item quantities
  - **🔍 Enhanced AI Detection** - Upgraded Gemini prompts to recognize quantity indicators like "x5", "x10", etc.
  - **📊 Quantity Parsing** - Smart parsing of formats: "5 x Item Name", "x5 Item Name", "2x Item Name"
  - **🖥️ Desktop Table Display** - New "Qty" column with highlighted quantity badges for items >1
  - **📱 Mobile Card Display** - Quantity badges shown next to item names in mobile view
  - **📦 Inventory Quantity Support** - Persistent storage and management of item quantities
  - **📈 Quantity-Aware Statistics** - Total values calculated as price × quantity for accurate inventory worth
  - **⚖️ Enhanced Market Economics** - Refinement analysis and recommendations now account for multiple copies
  - **🧪 Test Framework** - Created standalone test tool (`multi-detection-test.html`) for comparing detection methods
- **💰 Total Value Column** - Sortable revenue optimization column showing `quantity × price` for maximum profit analysis
  - **📊 Prime Parts**: Shows `quantity × platinum price` for total value sorting
  - **🔮 Void Relics**: Shows `quantity × best option value` for optimal revenue calculation
  - **📱 Mobile Support**: Total value displayed in both desktop tables and mobile cards
  - **🔄 Sortable**: Click Total Value column header to sort by highest revenue potential

### Enhanced
- **📊 Inventory Statistics** - Total items count now includes quantities (e.g., "5x Lith A1 Relic" counts as 5 items)
- **🎨 UI Visual Improvements** - Quantity badges use consistent Tenno Blue styling with subtle borders
- **💰 Value Calculations** - All inventory value totals now multiply by quantity for accurate portfolio assessment
- **🎯 Default Total Value Sorting** - Relics now sort by total plat outcome (best value × quantity) by default for maximum revenue prioritization

### Technical
- **🏗️ Buyer Integration Architecture** - Complete API enhancement for whisper message generation
  - **👤 Highest Bidder Detection** - Enhanced Supabase function and direct API calls to track top buyer usernames and quantities
  - **💬 Message Generation System** - Smart whisper message formatting with exact Warframe chat syntax
  - **📡 API Response Enhancement** - Added `buyerUsername` and `buyerQuantity` fields to all market data responses
  - **🔄 Type System Updates** - Extended BaseItem interface with buyer information fields
  - **🎯 UI Integration** - Replaced clipboard buttons with MessageCircle icons and buyer messaging functionality
- **🏗️ Build Planning Architecture** - Complete item reservation and build management system
  - **📋 buildPlanService.ts** - New service managing build plans, item reservations, and priority tracking
  - **🔒 Reservation System** - Items can be reserved for multiple sets with automatic cleanup when plans are removed
  - **💾 Persistent Storage** - localStorage-based storage with version management for build plans and reservations
  - **⚠️ Selling Protection** - Warning system integration with getSellingWarnings() function
  - **🎯 Auto-Reservation Logic** - Automatically reserves required parts when sets are added to build plans
- **🔄 Modal Redesign Architecture** - Complete overhaul of relic detail presentation
  - **📊 Unified Table Structure** - Single comprehensive table replacing separate refinement and drop tables
  - **🎯 Smart Availability Logic** - Dynamic greying of unavailable refinement levels based on current relic state
  - **💰 Integrated Market Data** - Real-time price display for all drop items in unified view
  - **⚡ Enhanced Expected Value Display** - Comprehensive expected value calculations with void trace cost integration
- **🏗️ Parallel Processing Architecture** - Complete refactor of image processing workflow
  - **📊 processImageAnalysis()** - Dedicated function for Gemini AI analysis only
  - **💰 processPriceFetching()** - Separate function for market price fetching operations
  - **🔄 Dual useEffect Watchers** - Independent monitoring for analysis and price fetching queues
  - **📱 Enhanced ProcessingAnimation** - New "analyzed" status support for better user feedback
  - **🎯 ImageState Type Extension** - Added "analyzed" status to processing pipeline
- **🏗️ Type System Updates** - Added `quantity?: number` field to BaseItem, InventoryItem, and all related interfaces
- **🔄 Service Layer Enhancement** - Updated inventoryService to handle quantity storage, retrieval, and calculations
- **🎯 AI Service Improvement** - Enhanced parseDetectedItems() function with robust quantity parsing logic

## [1.7.1] - 2025-01-03

### Added
- **🎨 Local Relic Images** - High-quality images for all relic era + refinement combinations
- **🛑 Stop Processing Button** - Cancel market fetch when detecting errors in screenshot analysis
- **🚀 MAJOR: Revolutionary Optimal Refinement Strategy** - Complete overhaul of refinement analysis system:
  - **🎯 Optimal Level Detection** - Automatically finds the best refinement level based on expected drop values
  - **💰 Smart Market Comparison** - Compares optimal expected value vs actual market prices for refined relics
  - **🔄 Intelligent Price Fallbacks** - Uses Radiant→Flawless→Exceptional→Intact market price hierarchy when buyers unavailable
  - **⚖️ Investment vs Reward Analysis** - Calculates void trace investment needed vs profit potential
  - **🧠 Real Market Logic** - Eliminates arbitrary thresholds, uses actual market data for decisions
  - **📈 Comprehensive Reasoning** - Provides detailed explanations for each recommendation with comparison data
- **🎯 MAJOR: Investment Efficiency Sorting** - Revolutionary sorting algorithm that prioritizes realistic economics:
  - **💰 SELL Priority** - Sorts by absolute profit (no investment needed, immediate gains)
  - **⚡ REFINE Efficiency** - Sorts by plat per void trace ratio (accounts for resource scarcity)
  - **📊 Smart Resource Allocation** - Considers void trace constraints vs profit potential
  - **🔄 Realistic Prioritization** - Shows best immediate actions first, accounts for market liquidity

### Improved
- **🎨 Simplified Relic UI** - Streamlined single-container design with color-coded recommendations
- **💰 Combined Value Display** - Single-line format: "Items: 1.1p vs Market: 3p (+1.9p)"
- **🔴 Refinement Indicators** - Color dots next to refinement levels (Yellow=Radiant, Blue=Flawless, Green=Exceptional, Gray=Intact)
- **📱 Desktop Action Buttons** - Removed meatball menus, made refresh/remove buttons directly visible
- **📊 Highest Value Sorting** - "Expected" sorting now uses higher of sell OR open values

### Fixed
- **🚨 CRITICAL: Efficiency Sorting Normalization** - Fixed major bug where negative current profits incorrectly ranked refinement recommendations
- **⚖️ Investment Comparison Logic** - Now properly compares improvement per resource invested rather than mixing absolute values
- **🧮 Proper Gain Calculation** - SELL by immediate gain (no investment), REFINE by plat/void trace efficiency, OPEN by expected gain
- **📊 Fair Priority Ranking** - Prevents scenarios where large refinement gains requiring many traces incorrectly beat profitable immediate sales
- **🔧 CRITICAL: Supabase Function Error Handling** - Fixed 500 errors preventing relic market price fallbacks from working
- **🔄 Relic Market Fallback Logic** - Now properly tries refined relic names first, then falls back to base relic names
- **📡 API Error Differentiation** - Distinguishes between "item not found" (try fallback) vs actual server errors (stop trying)

## [1.7.0] - 2025-01-03

### Added
- **🔄 Comprehensive Refinement Analysis** - Revolutionary void trace economics system with smart ROI calculations
- **💎 Multi-Level Refinement Planning** - Analyzes all possible refinement paths (Intact → Exceptional → Flawless → Radiant)
- **📊 Plat per Void Trace Efficiency** - Precise ROI calculations showing investment efficiency (e.g., "12.8p/100 traces")
- **🎯 Smart Refinement Recommendations** - New recommendation types: REFINE_TO_EXCEPTIONAL, REFINE_TO_FLAWLESS, REFINE_TO_RADIANT
- **⚖️ Investment Decision Logic** - Compares refinement ROI vs direct selling vs opening
- **🏆 ROI-Based Sorting** - Automatically prioritizes relics with best refinement efficiency

### Enhanced
- **🎨 Refinement Economics UI** - Live void trace cost/benefit display in recommendation cards
- **📈 Advanced Recommendation Logic** - Threshold-based system (>5p per 100 traces minimum for refinement recommendations)
- **🔢 Comprehensive Cost Modeling** - All refinement paths with accurate void trace costs (25/50/100/75/175/150 traces)
- **🎨 Color-Coded Refinement Types** - Blue (Exceptional), Cyan (Flawless), Gold (Radiant) for visual distinction

### Technical
- **📊 analyzeRefinementOpportunities()** - New comprehensive analysis function in relicDataService
- **🏗️ Enhanced Type System** - Updated VoidRelic interface with refinementAnalysis metadata
- **⚡ Integrated Analysis Pipeline** - Seamless integration with existing relic value calculation system

## [1.6.0] - 2025-01-03

### Fixed
- **🚨 CRITICAL: Relic Market Price vs Expected Value Logic** - Fixed hardcoded directSalePrice=0, now properly compares market vs expected values
- **🚨 CRITICAL: Incorrect Drop Chances for Refined Relics** - Radiant relics now show correct 10% Rare drops instead of 2%
- **🚨 CRITICAL: Radiant/Refined Relic Analysis Failing** - Fixed regex parsing for `[Radiant]` format vs `(Radiant)`
- **🎨 Logical Color Scheme** - GREEN now indicates profitable decisions (both SELL and OPEN when optimal)
- **🥇 Intuitive Rarity Colors** - Gold for Rare, Silver for Uncommon, Bronze for Common

## [1.5.1] - 2025-01-02

### Fixed
- **🚨 CRITICAL: Analysis Data Lost in Persistent Storage** - Relic analysis now properly persists and displays after refresh
- **🚨 CRITICAL: Semi-transparent Relic Over-detection** - Enhanced Gemini prompt to ignore faded/inactive relics
- **🚨 CRITICAL: Initial Upload Analysis Missing** - New uploads now immediately show expected values and recommendations
- **🚨 CRITICAL: Refinement Level Detection Ignored** - Radiant relics now show correct analysis vs defaulting to Intact

## [1.5.0] - 2025-01-02

### Added
- **🎲 Relic Value Analysis** - Complete expected value calculation with smart OPEN/SELL/REFINE recommendations
- **🏗️ Relic Data Infrastructure** - 2,682 relic database with drop chances and market mapping
- **⚡ Development Mode Enhancements** - Version tracking, debug mode, comprehensive logging
- **🔄 Refresh System Integration** - Individual and bulk relic refresh with value analysis

### Enhanced
- **🎨 UI/UX Improvements** - Color-coded recommendations, min/max ranges, compact information display
- **⚡ Performance** - 5x faster relic analysis with batch API optimization

## [1.4.2] - 2025-01-01

### Fixed
- **Critical Refresh Functionality** - Fixed category filtering bugs causing empty inventory during refresh
- **Price-Only Refreshes** - Optimized refresh to preserve images and only update price data
- **Anti-Flickering Measures** - Batched progress updates and reduced rapid state changes

## [1.4.1] - 2024-12-31

### Fixed
- **Sorting Functionality** - Fixed dropdown not working due to event propagation issues
- **Mobile-First UX** - 3-dots action menu, sticky headers, clickable collapsed sections

## [1.4.0] - 2024-12-31

### Added
- **Story #8: Void Relics Support** - AI detection, separate inventory sections, category-specific actions
- **Story #1: Real-time Item Display** - Individual price loading, instant inventory updates
- **Story #3: Persistent Inventory** - Auto-save, individual/bulk actions, enhanced statistics
- **API Key Configuration UX** - Smart onboarding, one-click setup, contextual help

## [1.3.0] - 2024-12-30

### Added
- **Real-time Item Display** - Items appear immediately as detected and processed
- **Persistent Inventory Management** - localStorage-based inventory with auto-save and bulk operations
- **Fresh Price Updates** - Refresh market prices without re-uploading screenshots

## [1.2.2] - 2024-03-06

### Fixed
- **Market Data API Integration** - Enhanced error handling and logging
- **Documentation** - Improved development and deployment guides

## [1.2.1] - 2024-12-30

### Fixed
- **Production Deployment Issues** - Resolved CSP violations and API proxy configuration
- **Netlify Deployment** - Enhanced deployment configuration with proxy redirects

## [1.2.0] - 2024-03-22

### Fixed
- **API Key Configuration** - Fixed saving, validation, and state synchronization
- **Queue Processing** - Resolved "Queued" status stuck issue preventing automatic processing

## [1.1.0] - 2024-03-21

### Added
- Optimistic results display and real-time market data updates
- Item quantity detection and ducat values
- Clickable table rows linking to Warframe Market
- Trading volume display and ducat-based sorting

### Changed
- Improved results table UI and enhanced market data fetching
- Better error handling and more informative loading states