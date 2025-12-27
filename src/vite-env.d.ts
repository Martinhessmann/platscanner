/// <reference types="vite/client" />

interface ImportMetaEnv {
  // OCR doesn't require API keys - all processing happens client-side
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Build-time injected variables
declare const __APP_VERSION__: string;
declare const __GIT_HASH__: string;
declare const __BUILD_TIMESTAMP__: string;
declare const __DEV_MODE__: string;