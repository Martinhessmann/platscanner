# TODO / Follow-up Issues

This document tracks open issues and follow-up tasks that need to be addressed.

## 🔴 High Priority

### Multiple Items Detection
- **Issue**: Can't detect multiple items properly
- **Status**: Open
- **Notes**: LLM Whisperer extracts text correctly, but parsing may not handle all item variations
- **Related**: May need to improve regex patterns or validation logic

### Void Relics & Rewards Detection
- **Issue**: Have to fix void relics and rewards detection and market fetches
- **Status**: Open
- **Notes**: Detection and market price fetching for relics and syndicate rewards needs improvement
- **Related**: May need separate handling for different item types

## 🟡 Medium Priority

### Prime Sets JSON & Images Update System
- **Issue**: Need a way to safely update `primesets.json` and images from a trusted source, not too often
- **Status**: Open
- **Notes**: 
  - Current manual process is error-prone
  - Need automated script that:
    - Fetches from trusted source (Warframe Market API v2 or official data)
    - Validates data before updating
    - Includes vaulted status information
    - Downloads/updates images automatically
    - Has rate limiting to avoid API abuse
    - Only updates when new items are actually added (not full refresh)
- **Previous Attempts**: 
  - `update-primesets.mjs` - Too slow, timed out
  - `add-new-primes.mjs` - Didn't work correctly, removed
- **Future Solution**: 
  - Consider using GitHub Actions for scheduled updates
  - Use Warframe Market API v2 for item discovery
  - Integrate with official Warframe data sources if available
  - Implement incremental updates (only new items)

## 🟢 Low Priority / Technical Debt

### Warframe Market API v1 Orders Endpoint (403 Errors)
- **Issue**: V1 orders endpoint returns 403 (Forbidden) from Netlify server
- **Status**: Working with fallback
- **Current Behavior**: Falls back to statistics data (avg48h) for pricing, which works
- **Notes**: 
  - V1 API may be rate-limiting or blocking server-side requests
  - V2 API doesn't have orders endpoint yet
  - Current fallback to statistics provides reasonable pricing
- **Future**: Monitor v2 API for orders endpoint availability

### Market Logger UI Integration
- **Issue**: Market logger service exists but UI not integrated
- **Status**: Deferred
- **Notes**: `marketLogger.ts` service created but UI in ApiKeySettings was reverted due to build issues
- **Future**: Add market logs tab to debug modal when needed

## 📝 Notes

- All critical functionality is working (detection, pricing, display)
- v2 API migration complete and functional
- Statistics-based pricing fallback is acceptable until orders endpoint is available
- Focus should be on improving detection accuracy and automation
