# AGENTS.md

This file is for coding agents working in this repository. Keep it focused on execution guidance, not product/user documentation.

## Scope

- Use `README.md` for user-facing setup and feature overview.
- Use `ARCHITECTURE.md` for system architecture and deployment details.
- Use `TODO.md` for open issues and follow-ups.
- Keep this file concise and agent-specific.

## Current OCR Reality (2026-02-09)

- OCR is **LLMWhisperer-only** (via `netlify/functions/llmwhisperer.ts`).
- No active Tesseract or Gemini runtime path.
- Known issues:
  - Prime Parts has an active bug, but quantity detection/inventory updates mostly still work.
  - Mods are currently not working.
  - Relics can miscount invisible/unowned entries as quantity `1` instead of `0`.

## Critical Domain Rules

### Prime Parts Tradeability

- Warframe parts:
  - Only **Blueprints** are tradeable.
  - Built warframe components (Chassis/Systems/Neuroptics without Blueprint) are not tradeable.
- Weapon parts:
  - Built parts and blueprints are tradeable.

## Key Code Paths

- OCR entrypoint: `src/services/ocrService.ts`
- LLMWhisperer client: `src/services/llmWhispererService.ts`
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
