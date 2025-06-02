# Changelog

All notable changes to PlatScanner will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Optimistic results display - items appear in the table as they're detected
- Real-time market data updates - prices load individually as they're fetched
- Item quantity detection from inventory screenshots
- Clickable table rows that link directly to Warframe Market
- Trading volume display in results table

### Changed
- Improved results table UI with clearer ducat value display
- Enhanced market data fetching with individual item processing
- Better error handling for failed market data requests
- More informative loading states for each detected item

### Known Issues
- Queue processing stops after first image in production environment
- Automatic transition between queued images not working in Supabase production deployment
- Rate limiting implementation needs improvement for market data requests
- Progress tracking inconsistent for multi-image processing
- Duplicate detection in image upload queue needs refinement

## [1.1.0] - 2024-03-21
### Added
- Ducat values for Prime parts
- Sorting by ducat values in results table
- Ducat icon display in results table

### Changed
- Updated About page with more detailed features
- Improved Terms and Privacy pages
- Removed processing progress bar for cleaner UI
- Enhanced sorting behavior for price and ducat columns

### Fixed
- Warframe Market API integration to properly fetch ducat values
- Default sort direction for non-name columns

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