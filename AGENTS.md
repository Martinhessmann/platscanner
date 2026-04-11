# AGENTS.md

This file is for coding agents working in this repository. Keep it focused on execution guidance, not product/user documentation.

## Scope

- Use `README.md` for user-facing setup and feature overview.
- Use `ARCHITECTURE.md` for system architecture and deployment details.
- Use `TODO.md` for open issues and follow-ups.
- Keep this file concise and agent-specific.

## Current OCR Reality (2026-03-14)

- OCR is **LLMWhisperer-only** (via `netlify/functions/llmwhisperer.ts`).
- No active Tesseract or Gemini runtime path.
- Known issues:
  - Prime Parts: `npm run ocr:fixture:prime` passes on `primeparts_inventory`; other screenshots may still mis-parse (mods unchanged below).
  - Mods are currently not working.
  - Relic grid parsing is improved for `Void Relics / Refinement`, but broader relic screenshot coverage still needs tuning and fixtures.

## Critical Domain Rules

### Prime Parts Tradeability

- Warframe parts:
  - Only **Blueprints** are tradeable.
  - Built warframe components (Chassis/Systems/Neuroptics without Blueprint) are not tradeable.
- Weapon parts:
  - Built parts and blueprints are tradeable.

## Key Code Paths

- OCR entrypoint: `src/services/ocrService.ts`
- Image OCR result cache (`localStorage`): keyed by `platscanner_image_cache_${__APP_VERSION__}` in `src/services/ocr/stepCache.ts` so bumping `package.json` version invalidates cached analysis for the same screenshot hash.
- OCR fixture regression: `scripts/run-ocr-fixture-test.mts` (`npm run ocr:fixture:prime`, etc.); frozen Whisper JSON under `debug/fixtures/` (see `.gitignore` whitelist).
- LLMWhisperer client: `src/services/llmWhispererService.ts`
- Netlify body limit (large screenshots): `src/services/imageNetlifyLimit.ts` (downscale/JPEG before POST; Netlify buffers binary with base64 overhead ~4.5MB effective)
- LLMWhisperer proxy: `netlify/functions/llmwhisperer.ts`
- Main processing orchestration: `src/pages/HomePage.tsx`
- Pricing: `src/services/warframeMarketService.ts`
- Inventory persistence: `src/services/inventoryService.ts`

## Working Conventions

- Prefer minimal, focused changes.
- Avoid duplicating architecture or roadmap prose here.
- When behavior changes, update:
  - `README.md` (if user-facing),
  - `CHANGELOG.md`,
  - `TODO.md` (if it affects known issues),
  - and this file only if agent guidance changed.
