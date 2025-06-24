# Changelog

All notable changes to Prime Parts Scanner will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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