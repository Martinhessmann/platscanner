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

## Open Issues / TODOs
### Item Detection
- [ ] Support for non-Prime items (Mods, Arcanes, etc.)
- [ ] Image preprocessing for better accuracy
- [ ] Handle non-inventory screenshots gracefully
- [ ] Fix unknown.thumb.png image URLs
- [ ] Improve quantity detection accuracy

### Market Analysis
- [ ] Historical price tracking
- [ ] Trading volume analytics
- [ ] Market volatility indicators
- [ ] Price alerts for high-value items
- [ ] Ducat/platinum value comparison

### User Experience
- [ ] Customizable sorting and filtering
- [ ] Batch processing improvements
- [ ] Export functionality
- [ ] User feedback mechanism
- [ ] Mobile UI optimizations
- [ ] Enhanced error messaging