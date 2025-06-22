# Changelog

All notable changes to Prime Parts Scanner will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **🎯 Multi-Item Quantity Detection** - Revolutionary detection system that identifies and displays item quantities
  - **🔍 Enhanced AI Detection** - Upgraded Gemini prompts to recognize quantity indicators like "x5", "x10", etc.
  - **📊 Quantity Parsing** - Smart parsing of formats: "5 x Item Name", "x5 Item Name", "2x Item Name"
  - **🖥️ Desktop Table Display** - New "Qty" column with highlighted quantity badges for items >1
  - **📱 Mobile Card Display** - Quantity badges shown next to item names in mobile view
  - **📦 Inventory Quantity Support** - Persistent storage and management of item quantities
  - **📈 Quantity-Aware Statistics** - Total values calculated as price × quantity for accurate inventory worth
  - **⚖️ Enhanced Market Economics** - Refinement analysis and recommendations now account for multiple copies
  - **🧪 Test Framework** - Created standalone test tool (`multi-detection-test.html`) for comparing detection methods

### Enhanced
- **📊 Inventory Statistics** - Total items count now includes quantities (e.g., "5x Lith A1 Relic" counts as 5 items)
- **🎨 UI Visual Improvements** - Quantity badges use consistent Tenno Blue styling with subtle borders
- **💰 Value Calculations** - All inventory value totals now multiply by quantity for accurate portfolio assessment

### Technical
- **🏗️ Type System Updates** - Added `quantity?: number` field to BaseItem, InventoryItem, and all related interfaces
- **🔄 Service Layer Enhancement** - Updated inventoryService to handle quantity storage, retrieval, and calculations
- **🎯 AI Service Improvement** - Enhanced parseDetectedItems() function with robust quantity parsing logic

### Added (Latest)
- **💰 Total Value Column** - Sortable revenue optimization column showing `quantity × price` for maximum profit analysis
  - **📊 Prime Parts**: Shows `quantity × platinum price` for total value sorting
  - **🔮 Void Relics**: Shows `quantity × best option value` for optimal revenue calculation
  - **📱 Mobile Support**: Total value displayed in both desktop tables and mobile cards
  - **🔄 Sortable**: Click Total Value column header to sort by highest revenue potential

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