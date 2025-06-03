# Changelog

All notable changes to PlatScanner will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

#### Story #2: Fresh Price Updates ⭐⭐⭐⭐⭐
**Complexity**: 🔧🔧 (Medium) | **Usefulness**: ⭐⭐⭐⭐⭐ (Essential)
```
As a frequent trader, I want to refresh market prices without re-uploading screenshots
so that I can get current prices for items I've already scanned.

Acceptance Criteria:
- "Refresh Prices" button replaces "Scan Complete" state
- Skip image analysis, directly fetch current market data for stored items
- Show updated timestamp for last price refresh
- Maintain item quantities and detection results
- Handle API failures gracefully with retry options
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

### 📊 Complete Priority Matrix

| Story | Feature | Usefulness | Complexity | Priority | Est. Dev Time |
|-------|---------|------------|------------|----------|---------------|
| #1 | Real-time Item Display | ⭐⭐⭐⭐⭐ | 🔧🔧 | 🚀 High | 3-5 days |
| #2 | Fresh Price Updates | ⭐⭐⭐⭐⭐ | 🔧🔧 | 🚀 High | 2-3 days |
| #3 | Persistent Inventory | ⭐⭐⭐⭐ | 🔧🔧🔧 | 🚀 High | 5-7 days |
| #4 | Multi-Image Processing | ⭐⭐⭐⭐ | 🔧🔧🔧 | 📈 Medium | 4-6 days |
| #5 | Enhanced Error Feedback | ⭐⭐⭐⭐ | 🔧🔧🔧 | 📈 Medium | 3-4 days |
| #6 | Customizable Results | ⭐⭐⭐ | 🔧🔧 | 📈 Medium | 2-4 days |
| #7 | Mobile Optimization | ⭐⭐⭐ | 🔧🔧🔧 | 📈 Medium | 5-7 days |
| #8 | Extended Item Support | ⭐⭐⭐⭐⭐ | 🔧🔧🔧🔧🔧 | 🔮 Future | 3-4 weeks |
| #9 | Advanced Market Analytics | ⭐⭐⭐⭐ | 🔧🔧🔧🔧 | 🔮 Future | 2-3 weeks |
| #10 | Smart Image Processing | ⭐⭐⭐ | 🔧🔧🔧🔧 | 🔮 Future | 1-2 weeks |
| #11 | Smart Error Recovery | ⭐⭐⭐ | 🔧🔧🔧🔧 | 🔮 Future | 1-2 weeks |

### 🎯 Recommended Development Sprint Plan

**Sprint 1 (Week 1)**: Real-time Item Display + Fresh Price Updates
**Sprint 2 (Week 2)**: Persistent Inventory + Enhanced Error Feedback
**Sprint 3 (Week 3)**: Multi-Image Processing + Bug fixes
**Sprint 4+ (Future)**: Extended Item Support (requires research & model training)

### 💡 Technical Implementation Notes

- **Real-time Display**: Modify state management to append items as detected
- **Persistent Storage**: Use IndexedDB with Dexie.js for large data sets
- **Error Handling**: Implement React Error Boundaries + toast notifications
- **Extended Items**: May require partnership with Warframe Market for broader API support